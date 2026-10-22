import { afterEach, describe, expect, it } from 'vitest';
import type { PlayerDemo } from '../src/core/types';
import { mountPlayer, readableOn, type PlayerController } from '../src/player/player';

const demo = (overrides: Partial<PlayerDemo> = {}): PlayerDemo => ({
  title: 'Acme',
  settings: { color: '#6d5efc', showProgress: true, cta: { text: 'Try it', url: 'https://example.com/signup' } },
  steps: [
    { image: 'data:image/png;base64,AA==', width: 1600, height: 1000, hotspot: { x: 0.2, y: 0.3 }, tooltip: 'Click "New"', zoom: 1.5 },
    { image: 'data:image/png;base64,AA==', width: 1600, height: 1000, hotspot: { x: 0.8, y: 0.9 }, tooltip: 'Fill in the name', zoom: 1 },
    { image: 'data:image/png;base64,AA==', width: 1600, height: 1000, hotspot: null, tooltip: 'All done', zoom: 1 },
  ],
  ...overrides,
});

const tick = () => new Promise((r) => setTimeout(r, 30));

let host: HTMLDivElement;
let player: PlayerController | undefined;

function mount(d = demo()) {
  host = document.createElement('div');
  document.body.append(host);
  player = mountPlayer(host, d);
  const $ = (sel: string) => host.shadowRoot!.querySelector(sel) as HTMLElement;
  return $;
}

afterEach(() => {
  player?.destroy();
  host?.remove();
});

describe('player', () => {
  it('renders inside a shadow root with the first step', async () => {
    const $ = mount();
    await tick();
    expect(host.shadowRoot).toBeTruthy();
    expect($('.text').textContent).toBe('Click "New"');
    expect($('.count').textContent).toBe('1 / 3');
    expect($('.hotspot').style.left).toBe('20%');
    expect($('.hotspot').getAttribute('aria-label')).toBe('Click "New"');
    expect(host.style.getPropertyValue('--sc-color')).toBe('#6d5efc');
  });

  it('advances by clicking the hotspot and goes back with the Back button', async () => {
    const $ = mount();
    await tick();
    $('.hotspot').click();
    await tick();
    expect(player!.index).toBe(1);
    expect($('.text').textContent).toBe('Fill in the name');
    expect($('.tip').classList.contains('above')).toBe(true);
    ($('.nav .btn:not(.primary)') as HTMLButtonElement).click();
    await tick();
    expect(player!.index).toBe(0);
  });

  it('shows a step without hotspot as a centered card', async () => {
    const $ = mount();
    player!.go(2);
    await tick();
    expect($('.hotspot').hidden).toBe(true);
    expect($('.tip').classList.contains('center')).toBe(true);
    expect($('.nav .primary').textContent).toBe('Finish');
  });

  it('ends with a replay button and the call to action', async () => {
    const $ = mount();
    player!.go(2);
    await tick();
    ($('.nav .primary') as HTMLButtonElement).click();
    expect(($('.end') as HTMLElement).hidden).toBe(false);
    const cta = $('.end a') as HTMLAnchorElement;
    expect(cta.textContent).toBe('Try it');
    expect(cta.href).toBe('https://example.com/signup');
    expect(cta.rel).toBe('noopener');
    ($('.end button') as HTMLButtonElement).click();
    await tick();
    expect(player!.index).toBe(0);
    expect(($('.end') as HTMLElement).hidden).toBe(true);
  });

  it('supports the keyboard', async () => {
    const $ = mount();
    await tick();
    const root = $('.root');
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await tick();
    expect(player!.index).toBe(1);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await tick();
    expect(player!.index).toBe(0);
  });

  it('hides the progress bar when turned off and handles an empty demo', async () => {
    const $ = mount(demo({ settings: { color: '#000000', showProgress: false, cta: null } }));
    await tick();
    expect(($('.progress') as HTMLElement).hidden).toBe(true);
    expect($('.end a')).toBeNull();
    player!.destroy();
    host.remove();
    const $empty = mount(demo({ steps: [] }));
    expect($empty('.empty').textContent).toContain('no steps');
  });

  it('never renders demo text as HTML', async () => {
    const $ = mount(demo({ steps: [{ image: 'data:,', width: 10, height: 10, hotspot: null, tooltip: '<img src=x onerror=alert(1)>', zoom: 1 }] }));
    await tick();
    expect($('.text').textContent).toBe('<img src=x onerror=alert(1)>');
    expect($('.text').querySelector('img')).toBeNull();
  });

  it('picks readable button text for the accent color', () => {
    expect(readableOn('#ffd60a')).toBe('#111');
    expect(readableOn('#6d5efc')).toBe('#fff');
    expect(readableOn('not a color')).toBe('#fff');
  });
});
