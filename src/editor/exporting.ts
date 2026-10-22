import playerScript from 'virtual:stepcast-player';
import { buildStandaloneHtml, buildZip, slugify, toPlayerDemo, PROJECT_FORMAT, type ProjectFile } from '../core/export';
import { bakeImage, blobToDataUrl } from '../core/images';
import { getImage } from '../core/storage';
import type { Demo, PlayerDemo } from '../core/types';
import { download } from './lib';

export type Progress = (done: number, total: number) => void;

/** Every step's screenshot, resized and with its blurs burned in. */
export async function bakedImages(demo: Demo, onProgress?: Progress): Promise<Blob[]> {
  const result: Blob[] = [];
  for (const [i, step] of demo.steps.entries()) {
    const original = await getImage(step.imageId);
    if (!original) throw new Error(`The screenshot of step ${i + 1} is missing.`);
    result.push(await bakeImage(original, step.blurs));
    onProgress?.(i + 1, demo.steps.length);
  }
  return result;
}

/** A player demo with object URLs, for the in-editor preview. Call `release` when done. */
export async function previewDemo(demo: Demo): Promise<{ demo: PlayerDemo; release: () => void }> {
  const urls = (await bakedImages(demo)).map((b) => URL.createObjectURL(b));
  return { demo: toPlayerDemo(demo, (i) => urls[i]!), release: () => urls.forEach((u) => URL.revokeObjectURL(u)) };
}

export async function exportHtml(demo: Demo, onProgress?: Progress) {
  const images = await Promise.all((await bakedImages(demo, onProgress)).map(blobToDataUrl));
  const html = buildStandaloneHtml(toPlayerDemo(demo, (i) => images[i]!), playerScript);
  download(new Blob([html], { type: 'text/html' }), `${slugify(demo.title)}.html`);
}

export async function exportZip(demo: Demo, onProgress?: Progress) {
  const blobs = await bakedImages(demo, onProgress);
  const names = blobs.map((_, i) => `step-${String(i + 1).padStart(2, '0')}.webp`);
  const images = await Promise.all(blobs.map(async (b, i) => ({ name: names[i]!, data: new Uint8Array(await b.arrayBuffer()) })));
  const zip = buildZip(toPlayerDemo(demo, (i) => `images/${names[i]}`), playerScript, images);
  download(new Blob([zip as BlobPart], { type: 'application/zip' }), `${slugify(demo.title)}.zip`);
}

export async function exportProject(demo: Demo) {
  const images: Record<string, string> = {};
  for (const step of demo.steps) {
    if (images[step.imageId]) continue;
    const blob = await getImage(step.imageId);
    if (blob) images[step.imageId] = await blobToDataUrl(blob);
  }
  const project: ProjectFile = { format: PROJECT_FORMAT, version: 1, demo, images };
  download(new Blob([JSON.stringify(project)], { type: 'application/json' }), `${slugify(demo.title)}.stepcast.json`);
}
