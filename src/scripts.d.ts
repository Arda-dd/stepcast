declare module '*/player-plugin.mjs' {
  import type { Plugin } from 'vite';
  export function playerBundle(): Plugin;
  export function buildPlayer(options?: { write?: boolean; outDir?: string }): Promise<string>;
}
