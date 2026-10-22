// End-to-end test of the real extension in Chrome for Testing:
// record a flow in the sample app, edit it in the editor, export HTML and play it back.
// Run `npm run build` first. Screenshots and exports go to test-results/.
//   node scripts/e2e.mjs            headless
//   HEADFUL=1 node scripts/e2e.mjs  watch it run
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { FLOW, readDemo, recordSampleFlow, root, sleep, waitForDownload } from './harness.mjs';

const results = join(root, 'test-results');
const downloads = join(results, 'downloads');
rmSync(results, { recursive: true, force: true });
mkdirSync(downloads, { recursive: true });

const failures = [];
const check = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) failures.push(message);
};

console.log('Recording the sample flow with the extension…');
const { editor, demoId, close } = await recordSampleFlow({
  onStep: (i, ok, selector) => check(ok, `step ${i + 1} recorded (click on ${selector})`),
});

try {
  // ---- What was recorded ----
  const demo = await readDemo(editor, demoId);
  check(demo.steps.length === FLOW.length, `the demo has ${FLOW.length} steps (got ${demo.steps.length})`);
  check(demo.steps[0].tooltip === 'Click "+ New project"', `tooltip from the button label: ${demo.steps[0].tooltip}`);
  check(demo.steps[1].tooltip === 'Click "Project name"', `tooltip from the field label: ${demo.steps[1].tooltip}`);
  const hs = demo.steps[0].hotspot;
  check(hs.x > 0.8 && hs.y < 0.15, `hotspot of step 1 is on the "New project" button (${hs.x.toFixed(2)}, ${hs.y.toFixed(2)})`);
  check(demo.steps.every((s) => s.width > 0 && s.height > 0), 'every step has a screenshot');

  // Step 1 must show the page *before* the click: the dialog is not open yet.
  const brightness = await editor.evaluate(async () => {
    const img = document.querySelector('.canvas-frame > img');
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    // The middle of the page is dark when the dialog backdrop is visible.
    const [r, g, b] = ctx.getImageData(Math.round(c.width * 0.55), Math.round(c.height * 0.25), 1, 1).data;
    return (r + g + b) / 3;
  });
  check(brightness > 200, `step 1 shows the page before the click, not the opened dialog (brightness ${brightness.toFixed(0)})`);

  // ---- Edit: rewrite a tooltip, zoom into step 3 and hide the email on step 7 ----
  await editor.click('.steps .step:nth-child(1)');
  await editor.$eval('#tooltip', (el) => {
    el.focus();
    el.select();
  });
  await editor.keyboard.type('Start by creating a project for your team');

  await editor.click('.steps .step:nth-child(3)');
  await editor.$eval('#zoom', (el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1.6');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  check((await editor.$eval('#zoom', (el) => el.value)) === '1.6', 'zoom set to 1.6× on step 3');

  await editor.click('.steps .step:nth-child(7)');
  await editor.keyboard.press('b');
  const frame = await editor.$eval('.canvas-frame', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await editor.mouse.move(frame.x + frame.w * 0.34, frame.y + frame.h * 0.46);
  await editor.mouse.down();
  await editor.mouse.move(frame.x + frame.w * 0.66, frame.y + frame.h * 0.57, { steps: 8 });
  await editor.mouse.up();
  check((await editor.$$('.blur-box')).length === 1, 'a hidden area was drawn over the email on step 7');
  await editor.keyboard.press('h');
  await editor.click('.steps .step:nth-child(1)');
  await sleep(600);
  await editor.screenshot({ path: join(results, 'editor.png') });

  // ---- Export ----
  const cdp = await editor.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await editor.click('.topbar .btn.primary');
  await editor.waitForSelector('.modal');
  await editor.click('.modal .option:nth-child(1) .btn.primary');
  const exported = await waitForDownload(downloads, '.html', readdirSync);
  check(!!exported, `exported ${exported}`);
  await editor.click('.modal .option:nth-child(3) .btn');
  const project = await waitForDownload(downloads, '.stepcast.json', readdirSync);
  check(!!project, `exported project file ${project}`);

  const html = readFileSync(join(downloads, exported), 'utf8');
  check(!/<script[^>]+src=|<link[^>]+href=|https?:\/\/(?:cdn|unpkg|fonts)/i.test(html), 'the exported file loads nothing from the internet');

  // The hidden area must be pixelated in the exported image: inside it, neighbouring pixels repeat in blocks.
  const blur = (await readDemo(editor, demoId)).steps[6].blurs[0];
  const exportedDemo = JSON.parse(html.match(/<script type="application\/json" id="stepcast-demo">([\s\S]*?)<\/script>/)[1]);
  const player = await editor.browser().newPage();
  await player.setContent('<canvas></canvas>');
  const sameNeighbours = await player.evaluate(
    async (src, r) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.querySelector('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const [x0, y0] = [Math.ceil(r.x * c.width) + 2, Math.ceil(r.y * c.height) + 2];
      const [w, h] = [Math.floor(r.w * c.width) - 4, Math.floor(r.h * c.height) - 4];
      const data = ctx.getImageData(x0, y0, w, h).data;
      let same = 0;
      let total = 0;
      for (let y = 0; y < h; y += 3) {
        for (let x = 0; x + 1 < w; x += 3) {
          const i = (y * w + x) * 4;
          const diff = Math.abs(data[i] - data[i + 4]) + Math.abs(data[i + 1] - data[i + 5]) + Math.abs(data[i + 2] - data[i + 6]);
          if (diff < 12) same++;
          total++;
        }
      }
      return same / total;
    },
    exportedDemo.steps[6].image,
    blur,
  );
  check(sameNeighbours > 0.85, `the hidden area is pixelated in the export (${Math.round(sameNeighbours * 100)}% of neighbouring pixels match)`);

  // ---- Play the exported file ----
  await player.setViewport({ width: 1200, height: 780 });
  await player.goto(`file:///${join(downloads, exported).replaceAll('\\', '/')}`);
  await player.waitForFunction(() => document.querySelector('#stepcast')?.shadowRoot?.querySelector('.text')?.textContent);
  const text = () => player.evaluate(() => document.querySelector('#stepcast').shadowRoot.querySelector('.text').textContent);
  check((await text()) === 'Start by creating a project for your team', 'the player shows the edited tooltip');
  await sleep(900);
  await player.screenshot({ path: join(results, 'player-step-1.png') });
  const hotspot = await player.evaluateHandle(() => document.querySelector('#stepcast').shadowRoot.querySelector('.hotspot'));
  await hotspot.click();
  await sleep(300);
  check((await text()).startsWith('Click "Project name"'), 'clicking the hotspot goes to step 2');
  for (let i = 0; i < 5; i++) {
    await player.keyboard.press('ArrowRight');
    await sleep(250);
  }
  await sleep(900);
  await player.screenshot({ path: join(results, 'player-step-7.png') });
  await player.keyboard.press('ArrowRight');
  await sleep(500);
  const ended = await player.evaluate(() => !document.querySelector('#stepcast').shadowRoot.querySelector('.end').hidden);
  check(ended, 'the demo ends with the final screen');
} finally {
  await close();
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nAll checks passed');
process.exitCode = failures.length ? 1 : 0;
