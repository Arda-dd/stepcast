import { createDemo, createStep, defaultTooltip, toHotspot } from '../core/demo';
import { deleteDemo, getDemo, saveDemo, saveImage } from '../core/storage';
import type { CaptureRequest, CaptureResponse, Message, RecordingState, StatusResponse } from './messages';

// The service worker can be stopped at any time, so the recording state lives in session storage
// and every step is written to IndexedDB as soon as it is captured.
const STATE_KEY = 'recording';

async function getState(): Promise<RecordingState | null> {
  const stored = await chrome.storage.session.get(STATE_KEY);
  return (stored[STATE_KEY] as RecordingState | undefined) ?? null;
}

const setState = (state: RecordingState | null) =>
  state ? chrome.storage.session.set({ [STATE_KEY]: state }) : chrome.storage.session.remove(STATE_KEY);

async function setBadge(recording: boolean) {
  await chrome.action.setBadgeText({ text: recording ? 'REC' : '' });
  if (recording) await chrome.action.setBadgeBackgroundColor({ color: '#e5484d' });
}

async function injectRecorder(tabId: number) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (err) {
    // Pages like chrome:// or the Web Store cannot be scripted.
    console.warn('Stepcast: could not inject the recorder', err);
  }
}

async function start(tabId: number): Promise<StatusResponse> {
  const tab = await chrome.tabs.get(tabId);
  const demo = createDemo(tab.title?.trim() || 'Untitled demo');
  await saveDemo(demo);
  const state: RecordingState = { tabId, windowId: tab.windowId, demoId: demo.id, startedAt: Date.now(), title: demo.title, steps: 0 };
  await setState(state);
  await setBadge(true);
  await injectRecorder(tabId);
  return { recording: state };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** captureVisibleTab is rate-limited (about 2 calls per second); retry once after a short pause. */
async function captureTab(windowId: number): Promise<string> {
  try {
    return await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  } catch {
    await wait(600);
    return chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  }
}

// Captures are queued so that steps keep the order of the clicks and frames.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task);
  queue = result.catch(() => undefined);
  return result;
}

/** The latest screenshot of the settled page, per tab. Kept in memory: if the worker restarts, clicks fall back to a fresh capture. */
const frames = new Map<number, string>();

function takeFrame(tabId: number | undefined): Promise<{ ok: boolean }> {
  return enqueue(async () => {
    const state = await getState();
    if (!state || state.tabId !== tabId) return { ok: false };
    frames.set(state.tabId, await captureTab(state.windowId));
    return { ok: true };
  }).catch(() => ({ ok: false }));
}

function capture(request: CaptureRequest, tabId: number | undefined): Promise<CaptureResponse> {
  const task = enqueue(async (): Promise<CaptureResponse> => {
    const state = await getState();
    if (!state || state.tabId !== tabId) return { ok: false, steps: 0, error: 'Not recording this tab' };
    const frame = request.useFrame ? frames.get(state.tabId) : undefined;
    const dataUrl = frame ?? (await captureTab(state.windowId));
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const imageId = crypto.randomUUID();
    await saveImage(imageId, blob);

    const demo = await getDemo(state.demoId);
    if (!demo) return { ok: false, steps: 0, error: 'Demo not found' };
    const step = createStep(imageId, bitmap.width, bitmap.height, {
      hotspot: toHotspot(request.x, request.y, request.viewportWidth, request.viewportHeight),
      tooltip: defaultTooltip(request.label),
      url: request.url,
      pageTitle: request.title,
    });
    bitmap.close();
    demo.steps.push(step);
    demo.updatedAt = Date.now();
    await saveDemo(demo);
    await setState({ ...state, steps: demo.steps.length });
    return { ok: true, steps: demo.steps.length };
  });
  return task.catch((err: unknown) => ({ ok: false, steps: 0, error: String(err) }));
}

async function stop(): Promise<StatusResponse> {
  await queue;
  const state = await getState();
  if (state) frames.delete(state.tabId);
  await setState(null);
  await setBadge(false);
  if (!state) return { recording: null };
  chrome.tabs.sendMessage(state.tabId, { type: 'stopped' }).catch(() => undefined);
  const demo = await getDemo(state.demoId);
  if (demo && demo.steps.length === 0) {
    await deleteDemo(demo);
    await chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
  } else {
    await chrome.tabs.create({ url: chrome.runtime.getURL(`editor.html#/demo/${state.demoId}`) });
  }
  return { recording: null };
}

async function discard(): Promise<StatusResponse> {
  await queue;
  const state = await getState();
  if (state) frames.delete(state.tabId);
  await setState(null);
  await setBadge(false);
  if (state) {
    chrome.tabs.sendMessage(state.tabId, { type: 'stopped' }).catch(() => undefined);
    const demo = await getDemo(state.demoId);
    if (demo) await deleteDemo(demo);
  }
  return { recording: null };
}

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  const handle = async () => {
    switch (message.type) {
      case 'start':
        return start(message.tabId);
      case 'stop':
        return stop();
      case 'discard':
        return discard();
      case 'status':
        return { recording: await getState() };
      case 'capture':
        return capture(message, sender.tab?.id);
      case 'frame':
        return takeFrame(sender.tab?.id);
    }
  };
  handle().then(sendResponse, (err: unknown) => sendResponse({ ok: false, error: String(err) }));
  return true; // Keep the channel open for the async response.
});

// Keep recording when the recorded tab navigates to another page.
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete') return;
  const state = await getState();
  if (state?.tabId === tabId) await injectRecorder(tabId);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (state?.tabId === tabId) await stop();
});
