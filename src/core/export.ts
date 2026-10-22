import { strToU8, zipSync } from 'fflate';
import type { Demo, PlayerDemo } from './types';

export const PROJECT_FORMAT = 'stepcast-project';

/** A project file: the editable demo plus its original screenshots, for backups and moving between browsers. */
export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: 1;
  demo: Demo;
  images: Record<string, string>;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * JSON that is safe inside a <script> element: "<" is escaped so that text such as
 * "</script><script>…" in a tooltip cannot end the element and inject markup.
 */
// U+2028/U+2029 end a line in older JavaScript parsers; built at runtime to keep the source plain ASCII.
const UNSAFE_IN_SCRIPT = new RegExp(`[<${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');
const unicodeEscape = (ch: string) => `${String.fromCharCode(92)}u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;

export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(UNSAFE_IN_SCRIPT, unicodeEscape);
}

/** The player's view of a demo, with each step's image replaced by a URL. */
export function toPlayerDemo(demo: Demo, imageUrls: (stepIndex: number) => string): PlayerDemo {
  return {
    title: demo.title,
    settings: demo.settings,
    steps: demo.steps.map((s, i) => ({
      image: imageUrls(i),
      width: s.width,
      height: s.height,
      hotspot: s.hotspot,
      tooltip: s.tooltip,
      zoom: s.zoom,
    })),
  };
}

const PAGE_STYLE =
  'html,body{margin:0;background:transparent}body{min-height:100vh;display:flex;align-items:center;justify-content:center}#stepcast{width:100%;max-width:1400px}';

/** One self-contained HTML file: player, demo and images inlined. Opens offline and can be hosted anywhere. */
export function buildStandaloneHtml(demo: PlayerDemo, playerScript: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(demo.title || 'Interactive demo')}</title>
<meta name="generator" content="Stepcast">
<style>${PAGE_STYLE}</style>
</head>
<body>
<div id="stepcast" data-stepcast="stepcast-demo"></div>
<script type="application/json" id="stepcast-demo">${scriptSafeJson(demo)}</script>
<script>${playerScript.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
}

/** A folder for hosting: index.html, the player script, demo.json and one image file per step. */
export function buildZip(demo: PlayerDemo, playerScript: string, images: { name: string; data: Uint8Array }[]): Uint8Array {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(demo.title || 'Interactive demo')}</title>
<meta name="generator" content="Stepcast">
<style>${PAGE_STYLE}</style>
</head>
<body>
<div id="stepcast" data-stepcast="stepcast-demo"></div>
<script type="application/json" id="stepcast-demo">${scriptSafeJson(demo)}</script>
<script src="stepcast-player.js"></script>
</body>
</html>
`;
  const files: Record<string, Uint8Array> = {
    'index.html': strToU8(html),
    'stepcast-player.js': strToU8(playerScript),
    'demo.json': strToU8(JSON.stringify(demo, null, 2)),
  };
  for (const image of images) files[`images/${image.name}`] = image.data;
  return zipSync(files, { level: 6 });
}

/** An iframe snippet with the demo's aspect ratio, for pasting into a website. */
export function embedSnippet(url: string, demo: { steps: { width: number; height: number }[] }, showProgress: boolean): string {
  const first = demo.steps[0];
  const ratio = first ? `${first.width} / ${first.height + (showProgress ? Math.round((4 * first.width) / 1000) : 0)}` : '16 / 10';
  return `<iframe src="${escapeHtml(url)}" title="Interactive demo" loading="lazy" allowfullscreen style="width:100%;aspect-ratio:${ratio};border:0;border-radius:14px"></iframe>`;
}

export function isProjectFile(value: unknown): value is ProjectFile {
  const v = value as ProjectFile;
  return !!v && v.format === PROJECT_FORMAT && v.version === 1 && !!v.demo && Array.isArray(v.demo.steps) && typeof v.images === 'object';
}

/** Letters that Unicode normalisation does not reduce to ASCII (Turkish dotless i, German sharp s, …). */
const SPECIAL_LETTERS: Record<string, string> = { ı: 'i', ß: 'ss', æ: 'ae', ø: 'o', đ: 'd', ł: 'l', œ: 'oe' };

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[ıßæøđłœ]/g, (c) => SPECIAL_LETTERS[c]!)
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'demo'
  );
}
