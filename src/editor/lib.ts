import { useEffect, useState } from 'react';
import { createDemo, createStep } from '../core/demo';
import { isProjectFile } from '../core/export';
import { dataUrlToBlob, imageSize } from '../core/images';
import { getImage, saveDemo, saveImage } from '../core/storage';
import type { Demo } from '../core/types';

export const inExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

export const REPO_URL = 'https://github.com/Arda-dd/stepcast';

// ---- Routing (hash based, works from file://, GitHub Pages and the extension) ----

export function useRoute(): string {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#/, '') || '/';
}

export const navigate = (path: string) => {
  location.hash = path;
};

// ---- Screenshot URLs ----

const urlCache = new Map<string, Promise<string | undefined>>();

export function imageUrl(id: string): Promise<string | undefined> {
  let promise = urlCache.get(id);
  if (!promise) {
    promise = getImage(id).then((blob) => (blob ? URL.createObjectURL(blob) : undefined));
    urlCache.set(id, promise);
  }
  return promise;
}

export function useImageUrl(id: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let alive = true;
    setUrl(undefined);
    if (id) void imageUrl(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

// ---- Creating demos ----

const byName = new Intl.Collator(undefined, { numeric: true }).compare;

/** Turns uploaded screenshots into steps, sorted by file name (shot-2 before shot-10). */
export async function stepsFromFiles(files: File[]) {
  const images = files.filter((f) => f.type.startsWith('image/')).sort((a, b) => byName(a.name, b.name));
  const steps = [];
  for (const file of images) {
    const { width, height } = await imageSize(file);
    const imageId = crypto.randomUUID();
    await saveImage(imageId, file);
    steps.push(createStep(imageId, width, height, { hotspot: { x: 0.5, y: 0.5 }, tooltip: '' }));
  }
  return steps;
}

export async function demoFromFiles(files: File[]): Promise<Demo> {
  const demo = createDemo('Untitled demo', await stepsFromFiles(files));
  return saveDemo(demo);
}

/** Imports a project file as a new demo, with fresh ids so it never overwrites an existing one. */
export async function importProject(text: string): Promise<Demo> {
  const data: unknown = JSON.parse(text);
  if (!isProjectFile(data)) throw new Error('This is not a Stepcast project file.');
  const newIds = new Map<string, string>();
  for (const [oldId, dataUrl] of Object.entries(data.images)) {
    const id = crypto.randomUUID();
    await saveImage(id, await dataUrlToBlob(dataUrl));
    newIds.set(oldId, id);
  }
  const base = createDemo(data.demo.title);
  const demo: Demo = {
    ...data.demo,
    id: base.id,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    steps: data.demo.steps
      .filter((s) => newIds.has(s.imageId))
      .map((s) => ({ ...s, id: crypto.randomUUID(), imageId: newIds.get(s.imageId)! })),
  };
  return saveDemo(demo);
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, size] of units) if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit);
  return 'just now';
}
