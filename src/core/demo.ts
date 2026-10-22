import type { Demo, DemoSettings, Point, Rect, Step } from './types';

export const DEFAULT_SETTINGS: DemoSettings = {
  color: '#6d5efc',
  showProgress: true,
  cta: null,
};

export function newId(): string {
  return crypto.randomUUID();
}

export function createDemo(title: string, steps: Step[] = []): Demo {
  const now = Date.now();
  return { version: 1, id: newId(), title, createdAt: now, updatedAt: now, settings: { ...DEFAULT_SETTINGS }, steps };
}

export function createStep(imageId: string, width: number, height: number, extra: Partial<Step> = {}): Step {
  return { id: newId(), imageId, width, height, hotspot: null, tooltip: '', zoom: 1, blurs: [], ...extra };
}

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/** Converts a click in viewport pixels into a hotspot in fractions of the screenshot. */
export function toHotspot(clientX: number, clientY: number, viewportWidth: number, viewportHeight: number): Point {
  return { x: clamp(clientX / viewportWidth), y: clamp(clientY / viewportHeight) };
}

/** A rectangle from two corner points, normalised so that w and h are positive and inside the image. */
export function rectFromPoints(a: Point, b: Point): Rect {
  const x = clamp(Math.min(a.x, b.x));
  const y = clamp(Math.min(a.y, b.y));
  return { x, y, w: clamp(Math.max(a.x, b.x)) - x, h: clamp(Math.max(a.y, b.y)) - y };
}

/**
 * A readable default tooltip from the clicked element's label: `Click "Save"`.
 * Long labels are shortened at a word boundary.
 */
export function defaultTooltip(label: string | undefined): string {
  const text = (label ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Click here';
  if (text.length <= 40) return `Click "${text}"`;
  const cut = text.slice(0, 40);
  const space = cut.lastIndexOf(' ');
  return `Click "${(space > 20 ? cut.slice(0, space) : cut).trimEnd()}…"`;
}

export function touch(demo: Demo): Demo {
  return { ...demo, updatedAt: Date.now() };
}

export function updateStep(demo: Demo, stepId: string, patch: Partial<Step>): Demo {
  return touch({ ...demo, steps: demo.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) });
}

export function removeStep(demo: Demo, stepId: string): Demo {
  return touch({ ...demo, steps: demo.steps.filter((s) => s.id !== stepId) });
}

/** Moves a step to a new index (clamped to the list). */
export function moveStep(demo: Demo, stepId: string, toIndex: number): Demo {
  const from = demo.steps.findIndex((s) => s.id === stepId);
  if (from === -1) return demo;
  const steps = [...demo.steps];
  const [step] = steps.splice(from, 1);
  steps.splice(Math.max(0, Math.min(toIndex, steps.length)), 0, step!);
  return touch({ ...demo, steps });
}

export function duplicateStep(demo: Demo, stepId: string): Demo {
  const index = demo.steps.findIndex((s) => s.id === stepId);
  if (index === -1) return demo;
  const copy: Step = { ...structuredClone(demo.steps[index]!), id: newId() };
  const steps = [...demo.steps];
  steps.splice(index + 1, 0, copy);
  return touch({ ...demo, steps });
}

/** Image ids no longer used by any step, to free storage after edits. */
export function unusedImages(demo: Demo, imageIds: string[]): string[] {
  const used = new Set(demo.steps.map((s) => s.imageId));
  return imageIds.filter((id) => !used.has(id));
}
