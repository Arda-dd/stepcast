// Records the sample flow with the real extension, polishes it and produces the showcase assets:
//   public/sample/orbit.html            live demo on the website
//   public/sample/orbit.stepcast.json   the same demo as a project, to open in the editor
//   docs/editor-light.png, docs/editor-dark.png
//   test-results/gif/*.png              frames for docs/demo.gif (assembled by scripts/make-gif.py)
// Run `npm run build` first.
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readDemo, recordSampleFlow, root, sleep, waitForDownload, writeDemo } from './harness.mjs';

const REPO = 'https://github.com/Arda-dd/stepcast';
const out = join(root, 'test-results/showcase');
const frames = join(root, 'test-results/gif');
rmSync(out, { recursive: true, force: true });
rmSync(frames, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
mkdirSync(frames, { recursive: true });
mkdirSync(join(root, 'public/sample'), { recursive: true });
mkdirSync(join(root, 'docs'), { recursive: true });

console.log('Recording…');
const { editor, demoId, close } = await recordSampleFlow();

try {
  // ---- Polish the recorded demo ----
  const demo = await readDemo(editor, demoId);
  const texts = [
    'Start by creating a project for your team.',
    'Give it a name everyone will recognise.',
    'Pick a template and create the project.',
    'Your project is ready. Open it.',
    'Now bring in the people you work with.',
    'Enter a teammate’s email address…',
    '…and send the invite. That’s it!',
  ];
  const zooms = [1, 1.5, 1.6, 1.25, 1, 1.4, 1.4];
  demo.steps.forEach((step, i) => {
    step.tooltip = texts[i];
    step.zoom = zooms[i];
  });
  // Hide the typed email on the last step.
  demo.steps[6].blurs = [{ x: 0.34, y: 0.46, w: 0.32, h: 0.11 }];
  // An intro card before the first click.
  demo.steps.unshift({
    ...demo.steps[0],
    id: crypto.randomUUID(),
    hotspot: null,
    zoom: 1,
    blurs: [],
    tooltip: 'Welcome to Orbit 👋\nLet’s set up your first project and invite a teammate. It takes 30 seconds.',
  });
  demo.title = 'Orbit: your first project';
  demo.settings = { color: '#6d5efc', showProgress: true, cta: { text: 'Make your own with Stepcast', url: REPO } };
  await writeDemo(editor, demo);
  await editor.reload();
  await editor.waitForSelector('.step img');

  // ---- Editor screenshots ----
  for (const scheme of ['light', 'dark']) {
    await editor.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await editor.click('.steps .step:nth-child(8)');
    await sleep(500);
    // Select the hidden area so its handles show.
    await editor.click('.blur-box');
    await sleep(300);
    await editor.screenshot({ path: join(root, `docs/editor-${scheme}.png`) });
  }
  await editor.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

  // ---- Export ----
  const cdp = await editor.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: out });
  await editor.click('.topbar .btn.primary');
  await editor.waitForSelector('.modal');
  await sleep(300);
  await editor.screenshot({ path: join(root, 'docs/export.png') });
  await editor.click('.modal .option:nth-child(1) .btn.primary');
  const html = await waitForDownload(out, '.html', readdirSync);
  await editor.click('.modal .option:nth-child(3) .btn');
  const project = await waitForDownload(out, '.stepcast.json', readdirSync);
  if (!html || !project) throw new Error('Export failed');
  copyFileSync(join(out, html), join(root, 'public/sample/orbit.html'));
  copyFileSync(join(out, project), join(root, 'public/sample/orbit.stepcast.json'));
  console.log('Exported the sample demo to public/sample/');

  // ---- GIF frames: play the export with a visible cursor ----
  const page = await editor.browser().newPage();
  await page.setViewport({ width: 1000, height: 600 });
  await page.goto(`file:///${join(out, html).replaceAll('\\', '/')}`);
  await page.addStyleTag({ content: 'body{background:#eef0f5 !important;padding:0 24px} #stepcast{max-width:952px}' });
  await page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.id = 'fake-cursor';
    cursor.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 3l14 8-6.5 1.5L9.5 19z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    cursor.style.cssText = 'position:fixed;left:520px;top:520px;z-index:99;pointer-events:none;transition:left .55s cubic-bezier(.4,0,.2,1),top .55s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))';
    document.body.append(cursor);
  });
  let n = 0;
  const shoot = async (count, gap = 90) => {
    for (let i = 0; i < count; i++) {
      await page.screenshot({ path: join(frames, `${String(n++).padStart(4, '0')}.png`) });
      await sleep(gap);
    }
  };
  const shadowRect = (selector) =>
    page.evaluate((sel) => {
      const el = document.querySelector('#stepcast').shadowRoot.querySelector(sel);
      if (!el || el.hidden) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, selector);
  const moveCursor = (p) => page.evaluate(({ x, y }) => Object.assign(document.getElementById('fake-cursor').style, { left: `${x - 4}px`, top: `${y - 3}px` }), p);

  await sleep(600);
  for (let step = 0; step < demo.steps.length; step++) {
    await shoot(step === 0 ? 14 : 9); // the zoom animation plays while reading
    const target = (await shadowRect('.hotspot')) ?? (await shadowRect('.nav .primary'));
    await moveCursor(target);
    await shoot(6);
    await page.mouse.click(target.x, target.y);
    await shoot(2, 60);
  }
  await shoot(16);
  console.log(`Captured ${n} GIF frames in test-results/gif`);
} finally {
  await close();
}
