<p align="center"><img src="docs/logo.png" width="88" alt=""></p>

<h1 align="center">Stepcast</h1>

<p align="center"><b>Interactive product demos, without the subscription.</b><br>
Record clicks with a Chrome extension, polish them in your browser, export one HTML file you can host anywhere.<br>
A free, open-source alternative to Arcade, Supademo and Storylane.</p>

<p align="center">
  <a href="https://arda-dd.github.io/stepcast/"><b>Try the live demo</b></a> ·
  <a href="#install-the-recorder">Install the recorder</a> ·
  <a href="#how-it-works">How it works</a>
</p>

<p align="center">
  <a href="https://github.com/Arda-dd/stepcast/actions/workflows/ci.yml"><img src="https://github.com/Arda-dd/stepcast/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/player-<4%20KB%20gzipped-6d5efc" alt="Player under 4 KB gzipped">
</p>

<p align="center"><img src="docs/demo.gif" width="760" alt="An interactive demo made with Stepcast: a viewer clicks through creating a project and inviting a teammate, with smooth zooms into each button"></p>

## Why

Interactive demos ("click through the product right here") are one of the best ways to show a web product on a landing page, in docs, or in a sales email. The tools that make them are subscriptions:

| | Price | Your screenshots live on | Self-host the result |
| --- | --- | --- | --- |
| Arcade | from $32 per user per month | their servers | no |
| Supademo | from $38 per creator per month | their servers | no |
| Storylane | from $50 per user per month | their servers | no |
| **Stepcast** | **free, MIT** | **your browser** | **yes: one HTML file** |

<sub>Prices as listed in a <a href="https://saltfish.ai/blog/storylane-alternatives">2026 comparison</a>.</sub>

## Features

- **One-click recording.** Every click in any web app becomes a step, with the screenshot, the click position and a tooltip written from the button's label (`Click "Create project"`).
- **Screenshots from *before* the click.** The recorder keeps a fresh frame of the settled page, so a step shows the button being clicked, not the dialog it opened ([how](#how-it-works)).
- **Editor in the browser.** Reorder steps, rewrite tooltips, drag hotspots, add text cards, choose a brand color and a final call-to-action button.
- **Cinematic zoom.** Zoom into the hotspot of any step; the player glides in smoothly.
- **Real blur.** Hide emails, names and API keys. Hidden areas are pixelated into the exported image, so the original pixels are not in the file at all.
- **Export anywhere.** A single self-contained HTML file (works offline, no CDN), a folder for your website with an `<iframe>` snippet, or a project file to back up and share.
- **Tiny, accessible player.** Under 4 KB gzipped, no dependencies, isolated in a shadow root. Works with keyboard (← → Home), screen readers and `prefers-reduced-motion`.
- **No account, no tracking.** Demos are stored in your browser (IndexedDB). Nothing is uploaded anywhere.

<p align="center"><img src="docs/editor-light.png" width="860" alt="The Stepcast editor: steps on the left, the screenshot with a hotspot and a blurred email field in the middle, step and demo settings on the right"></p>

## Install the recorder

Stepcast is installed from GitHub, which takes about a minute:

1. Download `stepcast-extension.zip` from the [latest release](https://github.com/Arda-dd/stepcast/releases/latest) and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode** and click **Load unpacked**.
3. Select the unzipped folder. Pin Stepcast to the toolbar.

Works in Chrome, Edge, Brave and other Chromium browsers (version 116+).

**No extension?** Open the [web editor](https://arda-dd.github.io/stepcast/) and drop in a few screenshots instead. You place the hotspots yourself.

## Make a demo

1. Open your product, click the Stepcast button and **Start recording**.
2. Click through the flow you want to show. A small "Recording" pill counts the steps (it never appears in the screenshots).
3. Click **Stop**. The editor opens with your steps.
4. Polish: rewrite tooltips, add zooms, blur anything private. Press **P** to preview.
5. **Export** and share the HTML file, or upload the folder and embed it:

```html
<iframe src="https://your-site.com/demo/" title="Interactive demo" loading="lazy"
  style="width:100%;aspect-ratio:16 / 9;border:0;border-radius:14px" allowfullscreen></iframe>
```

### Use the player directly

```html
<div id="demo"></div>
<script src="stepcast-player.js"></script>
<script>
  fetch('demo.json').then((r) => r.json()).then((demo) => {
    const player = Stepcast.mount(document.getElementById('demo'), demo);
    // player.next(), player.back(), player.go(3), player.destroy()
  });
</script>
```

`stepcast-player.js` and `demo.json` are inside the exported folder.

## How it works

```
Chrome extension                     Editor (React, in the browser)             Export
──────────────────                   ───────────────────────────────            ─────────────────────────
content script                       IndexedDB: demos + screenshots             blurs burned into pixels
  page settles → "frame" ──┐         reorder · tooltips · hotspots              WebP, max 1920 px wide
  click → "capture" ───────┤         zoom · blur · color · CTA                  + 4 KB player
service worker             │         live preview with the real player          = one HTML file / a folder
  captureVisibleTab ◄──────┘
  every step saved to IndexedDB at once (survives the worker being stopped)
```

**Screenshots from before the click.** `captureVisibleTab` takes 50–150 ms, so a screenshot requested at click time usually shows the *result* of the click. While recording, the content script watches for changes (DOM mutations, typing, scrolling, resizing) and, once the page has been still for 350 ms, asks for a frame. When a click arrives and nothing changed since that frame, the step uses it. It shows exactly what the viewer should click. Only if the page changed in the last moments is a new screenshot taken. The recording pill is hidden while frames are taken.

**Privacy.** The extension needs `<all_urls>` to record on the site you choose, `scripting` to add the recorder to that tab, `tabs` to take screenshots and follow navigation, and `storage` for the recording state. It sends nothing over the network.

## Development

```sh
npm install
npm run dev          # web editor at http://localhost:5173
npm test             # unit tests (Vitest)
npm run build        # web editor → dist/web, extension → dist/extension (+ zip)
npm run e2e          # records, edits, exports and plays a demo with the real extension in Chrome for Testing
npm run showcase     # regenerates the sample demo, screenshots and GIF in public/sample and docs/
```

The end-to-end test drives the actual extension through the [sample app](examples/sample-app). It checks that the recorder captures the page before each click, that hidden areas are pixelated in the exported file, and that the exported demo plays.

```
src/
  core/        demo model, IndexedDB storage, export (HTML, zip, project), image baking
  player/      the standalone player (vanilla TypeScript, shadow DOM)
  editor/      the React editor, used both on the web and inside the extension
  extension/   Manifest V3: service worker, content script, popup
scripts/       extension build, end-to-end test, showcase generator
```

## Roadmap

- [ ] Firefox add-on
- [ ] Export as GIF and MP4 for social media
- [ ] Typing steps (show text being entered)
- [ ] Branching ("Which plan are you on?")
- [ ] Optional, self-hosted view analytics

Ideas and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
