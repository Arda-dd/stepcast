// Injected into the recorded tab. Reports clicks to the service worker, which takes the screenshots.
//
// A screenshot taken *after* a click often shows the result of the click (an opened dialog) instead of the
// button that was clicked. So while recording, the page is screenshotted whenever it settles after a change,
// and a click is recorded with that frame when nothing changed since. Only if the page changed in the last
// moments is a new screenshot taken at click time.
import { elementLabel } from '../core/label';
import type { CaptureRequest, CaptureResponse } from './messages';

declare global {
  interface Window {
    __stepcastRecorder?: boolean;
  }
}

const SETTLE_MS = 350;

if (!window.__stepcastRecorder) {
  window.__stepcastRecorder = true;

  // The recording indicator lives in a closed shadow root so that the page's CSS cannot touch it.
  const host = document.createElement('stepcast-recorder');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:16px;bottom:16px;';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      .bar{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 12px;border-radius:999px;background:#15171c;color:#fff;
        font:600 13px/1 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3)}
      .dot{width:10px;height:10px;border-radius:50%;background:#e5484d;animation:b 1.2s ease-in-out infinite}
      @keyframes b{50%{opacity:.35}}
      button{font:inherit;border:0;border-radius:999px;padding:7px 12px;cursor:pointer;background:#fff;color:#15171c}
      button:hover{background:#e9eaee}
    </style>
    <div class="bar"><span class="dot"></span><span class="count">Recording · 0 steps</span><button type="button">Stop</button></div>`;
  const count = shadow.querySelector('.count')!;
  const stopButton = shadow.querySelector('button')!;
  document.documentElement.append(host);

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const updateCount = (steps: number) => {
    count.textContent = `Recording · ${steps} step${steps === 1 ? '' : 's'}`;
  };

  /** Runs `fn` with the indicator hidden, so it never appears in a screenshot. */
  let hiding = 0;
  const withoutIndicator = async <T>(fn: () => Promise<T>): Promise<T> => {
    hiding++;
    host.style.visibility = 'hidden';
    await nextFrame();
    try {
      return await fn();
    } finally {
      if (--hiding === 0) host.style.visibility = '';
    }
  };

  // ---- Keeping a fresh frame of the settled page ----
  let changeSeq = 0; // increases on every visible change
  let frameSeq = -1; // changeSeq at the time the current frame was taken
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const takeFrame = async () => {
    if (stopped) return;
    const seq = changeSeq;
    await withoutIndicator(() => chrome.runtime.sendMessage({ type: 'frame' }));
    // Only trust the frame if nothing changed while it was taken.
    if (seq === changeSeq) frameSeq = seq;
  };

  const changed = () => {
    changeSeq++;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => void takeFrame(), SETTLE_MS);
  };

  const observer = new MutationObserver((records) => {
    // Showing and hiding the indicator is not a change of the page.
    if (records.every((r) => r.target === host)) return;
    changed();
  });
  observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  addEventListener('input', changed, true);
  addEventListener('scroll', changed, { capture: true, passive: true });
  addEventListener('resize', changed);

  chrome.runtime.sendMessage({ type: 'status' }).then((status: { recording: { steps: number } | null }) => {
    if (status?.recording) {
      updateCount(status.recording.steps);
      changed();
    } else {
      stop();
    }
  });

  // ---- Recording clicks ----
  let busy = false;

  const onPointerDown = async (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || busy) return;
    if (event.composedPath().includes(host)) return;
    // Decide before the page reacts to this click: the page's own handlers run after this capture-phase listener.
    const useFrame = frameSeq === changeSeq;
    busy = true;
    const request: CaptureRequest = {
      type: 'capture',
      x: event.clientX,
      y: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      label: elementLabel(event.target as Element),
      url: location.href,
      title: document.title,
      useFrame,
    };
    try {
      const send = () => chrome.runtime.sendMessage(request) as Promise<CaptureResponse>;
      const response = useFrame ? await send() : await withoutIndicator(send);
      if (response?.ok) updateCount(response.steps);
    } finally {
      busy = false;
    }
  };

  document.addEventListener('pointerdown', onPointerDown, { capture: true });
  stopButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'stop' });
  });

  function stop() {
    stopped = true;
    clearTimeout(settleTimer);
    observer.disconnect();
    document.removeEventListener('pointerdown', onPointerDown, { capture: true });
    removeEventListener('input', changed, true);
    removeEventListener('scroll', changed, { capture: true });
    removeEventListener('resize', changed);
    host.remove();
    window.__stepcastRecorder = false;
  }

  chrome.runtime.onMessage.addListener((message: { type: string }) => {
    if (message.type === 'stopped') stop();
  });
}
