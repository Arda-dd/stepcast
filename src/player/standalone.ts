// Entry point of the standalone player bundle used by exported HTML files and embeds.
import type { PlayerDemo } from '../core/types';
import { mountPlayer } from './player';

declare global {
  interface Window {
    Stepcast: { mount: typeof mountPlayer };
  }
}

window.Stepcast = { mount: mountPlayer };

/** Mounts every `[data-stepcast]` element whose demo JSON is in the referenced script tag. */
function autoMount() {
  document.querySelectorAll<HTMLElement>('[data-stepcast]').forEach((container) => {
    const source = document.getElementById(container.dataset.stepcast || '');
    if (!source?.textContent) return;
    mountPlayer(container, JSON.parse(source.textContent) as PlayerDemo);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
else autoMount();
