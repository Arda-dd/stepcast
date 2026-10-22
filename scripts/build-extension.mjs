// Builds the Chrome extension into dist/extension and zips it into dist/stepcast-extension.zip.
import react from '@vitejs/plugin-react';
import { zipSync } from 'fflate';
import { cpSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { buildPlayer, playerBundle } from './player-plugin.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'src/extension');
const out = join(root, 'dist/extension');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// 1. Extension pages: the editor and the toolbar popup.
await build({
  configFile: false,
  root: src,
  base: './',
  logLevel: 'warn',
  plugins: [react(), playerBundle()],
  publicDir: false,
  build: {
    outDir: out,
    emptyOutDir: true,
    rollupOptions: { input: { editor: join(src, 'editor.html'), popup: join(src, 'popup.html') } },
  },
});

// 2. Service worker (ES module) and the content script (classic script, so IIFE).
for (const [entry, format] of [
  ['background', 'es'],
  ['content', 'iife'],
]) {
  await build({
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    build: {
      outDir: out,
      emptyOutDir: false,
      minify: true,
      lib: { entry: join(src, `${entry}.ts`), formats: [format], name: 'Stepcast', fileName: () => `${entry}.js` },
    },
  });
}

// 3. Manifest (with the package version) and icons.
const manifest = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8'));
manifest.version = pkg.version;
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
cpSync(join(root, 'assets/icons'), join(out, 'icons'), { recursive: true });

// 4. A zip for "Load unpacked" downloads and the Chrome Web Store, plus the standalone player.
const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files[relative(out, path).replaceAll('\\', '/')] = readFileSync(path);
  }
};
walk(out);
writeFileSync(join(root, 'dist/stepcast-extension.zip'), zipSync(files, { level: 9 }));

mkdirSync(join(root, 'dist/player'), { recursive: true });
writeFileSync(join(root, 'dist/player/stepcast-player.js'), await buildPlayer());

console.log(`Built extension ${pkg.version}: dist/extension (${Object.keys(files).length} files) and dist/stepcast-extension.zip`);
