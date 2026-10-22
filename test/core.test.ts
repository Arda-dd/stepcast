import { describe, expect, it } from 'vitest';
import {
  createDemo,
  createStep,
  defaultTooltip,
  duplicateStep,
  moveStep,
  rectFromPoints,
  removeStep,
  toHotspot,
  unusedImages,
  updateStep,
} from '../src/core/demo';
import { buildStandaloneHtml, buildZip, embedSnippet, escapeHtml, isProjectFile, scriptSafeJson, slugify, toPlayerDemo } from '../src/core/export';
import { pixelBlock } from '../src/core/images';
import { elementLabel } from '../src/core/label';
import { cropStyle, zoomViewport } from '../src/editor/Canvas';
import { unzipSync, strFromU8 } from 'fflate';

const demoWith = (n: number) => createDemo('Test', Array.from({ length: n }, (_, i) => createStep(`img-${i}`, 1600, 1000, { tooltip: `Step ${i + 1}` })));

describe('demo model', () => {
  it('converts clicks to hotspot fractions and clamps them', () => {
    expect(toHotspot(400, 250, 1600, 1000)).toEqual({ x: 0.25, y: 0.25 });
    expect(toHotspot(-10, 2000, 1600, 1000)).toEqual({ x: 0, y: 1 });
  });

  it('normalises rectangles drawn in any direction', () => {
    const rect = rectFromPoints({ x: 0.6, y: 0.5 }, { x: 0.2, y: 0.1 });
    expect(rect.x).toBe(0.2);
    expect(rect.y).toBe(0.1);
    expect(rect.w).toBeCloseTo(0.4);
    expect(rect.h).toBeCloseTo(0.4);
    const r = rectFromPoints({ x: 0.9, y: 0.9 }, { x: 1.4, y: 1.2 });
    expect(r.x + r.w).toBeLessThanOrEqual(1);
    expect(r.y + r.h).toBeLessThanOrEqual(1);
  });

  it('writes a readable default tooltip from the element label', () => {
    expect(defaultTooltip('Save')).toBe('Click "Save"');
    expect(defaultTooltip('  ')).toBe('Click here');
    expect(defaultTooltip(undefined)).toBe('Click here');
    const long = defaultTooltip('Create a new project from one of the available templates in the gallery');
    expect(long.endsWith('…"')).toBe(true);
    expect(long.length).toBeLessThan(52);
  });

  it('moves, duplicates, updates and removes steps without mutating the original', () => {
    const demo = demoWith(3);
    const [a, b, c] = demo.steps;
    expect(moveStep(demo, c!.id, 0).steps.map((s) => s.id)).toEqual([c!.id, a!.id, b!.id]);
    expect(moveStep(demo, a!.id, 99).steps.at(-1)!.id).toBe(a!.id);

    const dup = duplicateStep(demo, b!.id);
    expect(dup.steps).toHaveLength(4);
    expect(dup.steps[2]!.imageId).toBe(b!.imageId);
    expect(dup.steps[2]!.id).not.toBe(b!.id);

    expect(updateStep(demo, a!.id, { tooltip: 'Hi' }).steps[0]!.tooltip).toBe('Hi');
    expect(removeStep(demo, b!.id).steps.map((s) => s.id)).toEqual([a!.id, c!.id]);
    expect(demo.steps).toHaveLength(3);
    expect(demo.steps[0]!.tooltip).toBe('Step 1');
  });

  it('finds screenshots that no step uses anymore', () => {
    const demo = removeStep(demoWith(2), demoWith(2).steps[0]!.id);
    expect(unusedImages(demoWith(2), ['img-0', 'img-1', 'img-9'])).toEqual(['img-9']);
    expect(unusedImages(demo, ['img-0'])).toEqual([]);
  });

  it('computes the area that stays visible when zooming into the hotspot', () => {
    expect(zoomViewport({ x: 0.5, y: 0.5 }, 2)).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    const corner = zoomViewport({ x: 1, y: 0 }, 2);
    expect(corner).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });

  it('crops the screenshot to a hidden area for the blurred preview', () => {
    const style = cropStyle('blob:x', { x: 0.25, y: 0.5, w: 0.5, h: 0.25 });
    expect(style.backgroundSize).toBe('200% 400%');
    // 0.25 / (1 - 0.5) = 50%, 0.5 / (1 - 0.25) = 66.67%
    expect(style.backgroundPosition).toMatch(/^50% 66\.66/);
    expect(cropStyle('blob:x', { x: 0, y: 0, w: 1, h: 1 }).backgroundPosition).toBe('0% 0%');
  });

  it('pixelates hidden areas with blocks large enough to make text unreadable', () => {
    expect(pixelBlock(300, 30)).toBe(25);
    expect(pixelBlock(40, 20)).toBe(10);
  });
});

describe('element labels', () => {
  const label = (html: string, selector = '#t') => {
    document.body.innerHTML = html;
    return elementLabel(document.querySelector(selector));
  };

  it('uses the button behind an icon', () => {
    expect(label('<button>Save <svg id="t"></svg></button>')).toBe('Save');
  });

  it('prefers aria-label, then the field label, then placeholder', () => {
    expect(label('<a id="t" aria-label="Open settings" href="#">⚙</a>')).toBe('Open settings');
    expect(label('<label for="t">Email</label><input id="t" placeholder="you@example.com">')).toBe('Email');
    expect(label('<input id="t" placeholder="Search projects">')).toBe('Search projects');
    expect(label('<input id="t" type="submit" value="Sign in">')).toBe('Sign in');
  });

  it('collapses whitespace and shortens long text', () => {
    expect(label('<div id="t">  Hello\n   world </div>')).toBe('Hello world');
    expect(label(`<p id="t">${'word '.repeat(40)}</p>`).length).toBeLessThanOrEqual(81);
  });
});

describe('export', () => {
  it('cannot be broken out of the <script> element by demo text', () => {
    const json = scriptSafeJson({ tooltip: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('</script');
    expect(JSON.parse(json).tooltip).toBe('</script><script>alert(1)</script>');
  });

  it('escapes the title in HTML', () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;');
  });

  it('builds a standalone page with the demo, the player and nothing else', () => {
    const demo = demoWith(2);
    demo.title = 'My <Demo>';
    demo.steps[0]!.tooltip = '</script><img src=x onerror=alert(1)>';
    const html = buildStandaloneHtml(toPlayerDemo(demo, (i) => `data:image/webp;base64,${i}`), 'console.log("</script>")');
    expect(html).toContain('<title>My &lt;Demo&gt;</title>');
    expect(html).toContain('data-stepcast="stepcast-demo"');
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('builds a zip with index.html, the player, demo.json and the images', () => {
    const demo = toPlayerDemo(demoWith(2), (i) => `images/step-0${i + 1}.webp`);
    const zip = unzipSync(buildZip(demo, 'player()', [{ name: 'step-01.webp', data: new Uint8Array([1, 2, 3]) }]));
    expect(Object.keys(zip).sort()).toEqual(['demo.json', 'images/step-01.webp', 'index.html', 'stepcast-player.js']);
    expect(strFromU8(zip['index.html']!)).toContain('<script src="stepcast-player.js"></script>');
    expect(JSON.parse(strFromU8(zip['demo.json']!)).steps).toHaveLength(2);
  });

  it('writes an embed snippet with the demo aspect ratio', () => {
    const snippet = embedSnippet('https://example.com/demo/"x', { steps: [{ width: 1600, height: 1000 }] }, false);
    expect(snippet).toContain('aspect-ratio:1600 / 1000');
    expect(snippet).toContain('src="https://example.com/demo/&quot;x"');
  });

  it('recognises project files', () => {
    const demo = demoWith(1);
    expect(isProjectFile({ format: 'stepcast-project', version: 1, demo, images: {} })).toBe(true);
    expect(isProjectFile({ format: 'other', version: 1, demo, images: {} })).toBe(false);
    expect(isProjectFile(null)).toBe(false);
  });

  it('makes safe file names', () => {
    expect(slugify('Açık kaynak: Demo #1!')).toBe('acik-kaynak-demo-1');
    expect(slugify('İstanbul Straße Ørsted')).toBe('istanbul-strasse-orsted');
    expect(slugify('***')).toBe('demo');
  });
});
