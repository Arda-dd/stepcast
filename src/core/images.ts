// Browser-only image helpers (canvas). Not used in the extension's service worker.
import type { Rect } from './types';

export interface BakeOptions {
  maxWidth?: number;
  type?: 'image/webp' | 'image/jpeg' | 'image/png';
  quality?: number;
}

/** Block size in pixels used to pixelate a region: big enough that text cannot be read back. */
export function pixelBlock(width: number, height: number): number {
  return Math.max(10, Math.round(Math.max(width, height) / 12));
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality),
  );
}

/**
 * Resizes a screenshot and burns the blur regions into its pixels. The original pixels under a blur
 * are not recoverable from the result, so exported demos never contain the hidden information.
 */
export async function bakeImage(source: Blob, blurs: Rect[], options: BakeOptions = {}): Promise<Blob> {
  const { maxWidth = 1920, type = 'image/webp', quality = 0.86 } = options;
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const r of blurs) {
    const x = Math.floor(r.x * width);
    const y = Math.floor(r.y * height);
    const w = Math.max(1, Math.ceil(r.w * width));
    const h = Math.max(1, Math.ceil(r.h * height));
    const block = pixelBlock(w, h);
    const small = makeCanvas(Math.max(1, Math.ceil(w / block)), Math.max(1, Math.ceil(h / block)));
    const sctx = small.getContext('2d')!;
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(canvas, x, y, w, h, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, small.width, small.height, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
  }
  return canvasToBlob(canvas, type, quality);
}

export async function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/** A small preview for step lists. */
export async function thumbnail(blob: Blob, width = 320): Promise<Blob> {
  return bakeImage(blob, [], { maxWidth: width, type: 'image/webp', quality: 0.7 });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}
