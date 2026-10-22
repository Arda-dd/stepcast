// Vite plugin: `import code from 'virtual:stepcast-player'` gives the minified standalone player as a string.
// The editor inlines it into exported HTML files, so exports work offline without any CDN.
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ID = 'virtual:stepcast-player';
const RESOLVED = '\0' + ID;
export const PLAYER_ENTRY = fileURLToPath(new URL('../src/player/standalone.ts', import.meta.url));

export async function buildPlayer({ write = false, outDir } = {}) {
  const result = await build({
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    build: {
      write,
      outDir,
      emptyOutDir: false,
      minify: true,
      lib: { entry: PLAYER_ENTRY, formats: ['iife'], name: 'StepcastPlayer', fileName: () => 'stepcast-player.js' },
    },
  });
  const output = Array.isArray(result) ? result[0] : result;
  const chunk = output.output.find((o) => o.type === 'chunk');
  return chunk.code;
}

export function playerBundle() {
  return {
    name: 'stepcast-player-bundle',
    resolveId(source) {
      return source === ID ? RESOLVED : undefined;
    },
    async load(id) {
      if (id !== RESOLVED) return undefined;
      return `export default ${JSON.stringify(await buildPlayer())};`;
    },
  };
}
