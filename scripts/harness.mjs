// Shared by e2e.mjs and showcase.mjs: starts Chrome for Testing with the built extension,
// serves the sample app and records the "create a project and invite a teammate" flow.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

export const root = fileURLToPath(new URL('..', import.meta.url));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const FLOW = [
  ['#new-project'],
  ['#project-name', 'Customer portal'],
  ['#create'],
  ['#new-card'],
  ['#invite'],
  ['#invite-email', 'jordan.lee@acme-corp.com'],
  ['#send-invite'],
];

function serveSampleApp() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const server = createServer((req, res) => {
    const path = join(root, 'examples/sample-app', req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    if (!existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(readFileSync(path));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** Reads a demo from the editor's IndexedDB. */
export function readDemo(page, id) {
  return page.evaluate(async (demoId) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('stepcast');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return new Promise((res) => {
      const q = db.transaction('demos').objectStore('demos').get(demoId);
      q.onsuccess = () => res(q.result);
    });
  }, id);
}

/** Writes a demo to the editor's IndexedDB. */
export function writeDemo(page, demo) {
  return page.evaluate(async (d) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('stepcast');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction('demos', 'readwrite');
      tx.objectStore('demos').put(d);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }, demo);
}

/**
 * Records the sample flow with the real extension. `onStep(i, ok)` is called after each click.
 * Returns the browser, the editor page that opens after recording, and the demo id.
 */
export async function recordSampleFlow({ headless = !process.env.HEADFUL, onStep = () => {}, beforeStart = async () => {}, lang } = {}) {
  const extensionPath = join(root, 'dist/extension');
  if (!existsSync(join(extensionPath, 'manifest.json'))) throw new Error('Run `npm run build` first.');
  const server = await serveSampleApp();
  const appUrl = `http://127.0.0.1:${server.address().port}/`;
  const browser = await puppeteer.launch({
    headless,
    defaultViewport: null,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--window-size=1280,800',
      '--hide-scrollbars',
      ...(lang ? [`--lang=${lang}`] : []),
    ],
  });
  const close = async () => {
    await browser.close();
    server.close();
  };

  try {
    const worker = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('/background.js'), { timeout: 15_000 });
    const extensionId = new URL(worker.url()).host;
    const [app] = await browser.pages();
    await app.goto(appUrl, { waitUntil: 'load' });

    // An extension page to talk to the service worker, like the toolbar popup does.
    const control = await browser.newPage();
    await control.goto(`chrome-extension://${extensionId}/popup.html`);
    const send = (message) => control.evaluate((m) => chrome.runtime.sendMessage(m), message);
    await beforeStart({ control, app });
    const tabId = await control.evaluate(async (url) => (await chrome.tabs.query({})).find((t) => t.url?.startsWith(url))?.id, appUrl);
    await send({ type: 'start', tabId });
    await app.bringToFront();
    await sleep(1200); // the recorder takes its first frame once the page has settled

    const waitForSteps = async (n) => {
      for (let i = 0; i < 50; i++) {
        if ((await send({ type: 'status' })).recording?.steps >= n) return true;
        await sleep(100);
      }
      return false;
    };
    for (const [i, [selector, text]] of FLOW.entries()) {
      await app.click(selector);
      await onStep(i, await waitForSteps(i + 1), selector, app);
      if (text) await app.type(selector, text, { delay: 20 });
      await sleep(900); // let the page settle so the next click uses a fresh frame
    }

    await send({ type: 'stop' });
    const editorTarget = await browser.waitForTarget((t) => t.url().includes('/editor.html#/demo/'), { timeout: 10_000 });
    const editor = await editorTarget.page();
    await editor.setViewport({ width: 1440, height: 860 });
    await editor.bringToFront();
    await editor.waitForSelector('.step img');
    const demoId = editor.url().split('/').pop();
    return { browser, editor, extensionId, demoId, close };
  } catch (err) {
    await close();
    throw err;
  }
}

/** Waits for a file with the given suffix to appear in `dir`. */
export async function waitForDownload(dir, suffix, readdir) {
  for (let i = 0; i < 150; i++) {
    const file = readdir(dir).find((f) => f.endsWith(suffix) && !f.endsWith('.crdownload'));
    if (file) return file;
    await sleep(100);
  }
  return undefined;
}
