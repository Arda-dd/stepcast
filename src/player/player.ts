import type { PlayerDemo, PlayerStep } from '../core/types';
import css from './player.css?raw';

export interface PlayerOptions {
  startAt?: number;
  onStep?: (index: number) => void;
}

export interface PlayerController {
  readonly index: number;
  go(index: number): void;
  next(): void;
  back(): void;
  destroy(): void;
}

/** Black or white, whichever reads better on the given hex color. */
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return '#fff';
  const [r, g, b] = [m[1], m[2], m[3]].map((c) => {
    const v = parseInt(c!, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '#111' : '#fff';
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * Renders an interactive demo into `container`. Everything lives in a shadow root,
 * so the host page's CSS cannot break it and its CSS cannot leak out.
 */
export function mountPlayer(container: HTMLElement, demo: PlayerDemo, options: PlayerOptions = {}): PlayerController {
  const shadow = container.shadowRoot ?? container.attachShadow({ mode: 'open' });
  shadow.replaceChildren();
  const host = container;
  host.style.setProperty('--sc-color', demo.settings.color);
  host.style.setProperty('--sc-on-color', readableOn(demo.settings.color));

  const style = el('style');
  style.textContent = css;
  const root = el('div', 'root');
  root.tabIndex = 0;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', 'interactive demo');
  root.setAttribute('aria-label', demo.title || 'Interactive demo');
  shadow.append(style, root);

  if (demo.steps.length === 0) {
    root.append(el('div', 'empty', 'This demo has no steps yet.'));
    return { index: 0, go() {}, next() {}, back() {}, destroy: () => shadow.replaceChildren() };
  }

  const stage = el('div', 'stage');
  const frame = el('div', 'frame');
  const zoomer = el('div', 'zoomer');
  const hotspot = el('button', 'hotspot');
  hotspot.type = 'button';
  const tip = el('div', 'tip');
  tip.setAttribute('aria-live', 'polite');
  const text = el('p', 'text');
  const nav = el('div', 'nav');
  const count = el('span', 'count');
  const backBtn = el('button', 'btn', 'Back');
  const nextBtn = el('button', 'btn primary', 'Next');
  backBtn.type = nextBtn.type = 'button';
  nav.append(count, backBtn, nextBtn);
  tip.append(text, nav);
  zoomer.append(hotspot);
  frame.append(zoomer, tip);

  const end = el('div', 'end');
  end.hidden = true;
  const endTitle = el('h2', '', demo.title ? `That's ${demo.title}` : "That's the tour");
  const endRow = el('div', 'row');
  const replay = el('button', 'btn', 'Replay');
  replay.type = 'button';
  endRow.append(replay);
  if (demo.settings.cta?.url) {
    const cta = el('a', 'btn', demo.settings.cta.text || 'Get started');
    cta.href = demo.settings.cta.url;
    cta.target = '_blank';
    cta.rel = 'noopener';
    endRow.append(cta);
  }
  end.append(endTitle, endRow);
  stage.append(frame, end);

  const progress = el('div', 'progress');
  const bar = el('span');
  progress.append(bar);
  progress.hidden = !demo.settings.showProgress;
  root.append(stage, progress);

  const first = demo.steps[0]!;
  let index = -1;
  let current: HTMLImageElement | null = null;
  let token = 0;

  // The stage keeps the first screenshot's aspect ratio; each step's screenshot is fitted inside it.
  const layout = () => {
    const width = stage.clientWidth || container.clientWidth;
    const stageHeight = Math.round((width * first.height) / first.width);
    stage.style.height = `${stageHeight}px`;
    const step = demo.steps[Math.max(index, 0)]!;
    const scale = Math.min(width / step.width, stageHeight / step.height);
    frame.style.width = `${Math.round(step.width * scale)}px`;
    frame.style.height = `${Math.round(step.height * scale)}px`;
    placeTip(step);
  };

  const placeTip = (step: PlayerStep) => {
    tip.classList.remove('above', 'below', 'center');
    if (!step.hotspot) {
      tip.classList.add('center');
      return;
    }
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    const hx = step.hotspot.x * w;
    const hy = step.hotspot.y * h;
    const tipWidth = tip.offsetWidth || Math.min(320, w * 0.78);
    const left = Math.min(Math.max(hx - tipWidth / 2, 8), Math.max(8, w - tipWidth - 8));
    tip.style.left = `${left}px`;
    tip.style.setProperty('--arrow', `${Math.min(Math.max(hx - left, 16), tipWidth - 16)}px`);
    if (step.hotspot.y < 0.6) {
      tip.classList.add('below');
      tip.style.top = `${hy + 28}px`;
      tip.style.bottom = '';
    } else {
      tip.classList.add('above');
      tip.style.top = '';
      tip.style.bottom = `${h - hy + 28}px`;
    }
  };

  const show = async (target: number) => {
    const step = demo.steps[target]!;
    const myToken = ++token;
    const img = el('img', 'shot');
    img.alt = step.tooltip || `Step ${target + 1}`;
    img.draggable = false;
    img.src = step.image;
    try {
      await img.decode();
    } catch {
      // Show the step even if the image cannot be decoded.
    }
    if (myToken !== token) return;

    index = target;
    end.hidden = true;
    text.textContent = step.tooltip || (step.hotspot ? 'Click here' : '');
    count.textContent = `${target + 1} / ${demo.steps.length}`;
    backBtn.disabled = target === 0;
    backBtn.style.visibility = target === 0 ? 'hidden' : '';
    nextBtn.textContent = target === demo.steps.length - 1 ? 'Finish' : 'Next';
    bar.style.width = `${((target + 1) / demo.steps.length) * 100}%`;

    hotspot.hidden = !step.hotspot;
    if (step.hotspot) {
      hotspot.style.left = `${step.hotspot.x * 100}%`;
      hotspot.style.top = `${step.hotspot.y * 100}%`;
      hotspot.setAttribute('aria-label', step.tooltip || 'Next step');
    }

    // Start unzoomed, then glide into the hotspot.
    const origin = step.hotspot ? `${step.hotspot.x * 100}% ${step.hotspot.y * 100}%` : '50% 50%';
    zoomer.style.transition = 'none';
    zoomer.style.transformOrigin = origin;
    zoomer.style.transform = 'scale(1)';
    zoomer.insertBefore(img, hotspot);
    const previous = current;
    current = img;
    if (previous && previous !== img) {
      img.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      setTimeout(() => previous.remove(), 240);
    }

    // Re-trigger the tooltip's entrance animation.
    tip.style.animation = 'none';
    void tip.offsetWidth;
    tip.style.animation = '';
    layout();

    if (step.zoom > 1) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          zoomer.style.transition = '';
          zoomer.style.transform = `scale(${step.zoom})`;
        }),
      );
    }
    options.onStep?.(target);
  };

  const controller: PlayerController = {
    get index() {
      return index;
    },
    go(target: number) {
      void show(Math.max(0, Math.min(target, demo.steps.length - 1)));
    },
    next() {
      if (index >= demo.steps.length - 1) {
        end.hidden = false;
        bar.style.width = '100%';
        replay.focus();
        return;
      }
      controller.go(index + 1);
    },
    back() {
      if (!end.hidden) {
        end.hidden = true;
        return;
      }
      if (index > 0) controller.go(index - 1);
    },
    destroy() {
      observer?.disconnect();
      shadow.replaceChildren();
    },
  };

  hotspot.addEventListener('click', () => controller.next());
  nextBtn.addEventListener('click', () => controller.next());
  backBtn.addEventListener('click', () => controller.back());
  replay.addEventListener('click', () => controller.go(0));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || (e.key === 'Enter' && e.target === root)) controller.next();
    else if (e.key === 'ArrowLeft') controller.back();
    else if (e.key === 'Home') controller.go(0);
    else return;
    e.preventDefault();
  });

  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => layout()) : undefined;
  observer?.observe(stage);
  controller.go(options.startAt ?? 0);
  return controller;
}
