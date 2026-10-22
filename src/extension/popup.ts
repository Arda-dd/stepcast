import type { StatusResponse } from './messages';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const idle = $('idle');
const recording = $('recording');
const status = $('status');
const hint = $('hint');
const startButton = $<HTMLButtonElement>('start');

const send = <T>(message: unknown) => chrome.runtime.sendMessage(message) as Promise<T>;

function render(state: StatusResponse) {
  idle.hidden = !!state.recording;
  recording.hidden = !state.recording;
  if (state.recording) {
    const n = state.recording.steps;
    status.textContent = `Recording · ${n} step${n === 1 ? '' : 's'}`;
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const recordable = !!tab?.url && /^(https?|file):/.test(tab.url);
  if (!recordable) {
    startButton.disabled = true;
    hint.textContent = "This page can't be recorded. Open a website and try again.";
  }
  render(await send<StatusResponse>({ type: 'status' }));

  startButton.addEventListener('click', async () => {
    if (!tab?.id) return;
    render(await send<StatusResponse>({ type: 'start', tabId: tab.id }));
    window.close();
  });
  $('stop').addEventListener('click', async () => {
    await send({ type: 'stop' });
    window.close();
  });
  $('discard').addEventListener('click', async () => {
    render(await send<StatusResponse>({ type: 'discard' }));
  });
  $('library').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
    window.close();
  });
}

void init();
