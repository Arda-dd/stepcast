# Contributing

Thanks for helping! Bug reports, ideas and pull requests are all welcome.

## Setup

```sh
git clone https://github.com/Arda-dd/stepcast.git
cd stepcast
npm install          # also downloads Chrome for Testing for the end-to-end test
npm run dev          # the web editor with hot reload
```

To work on the extension, run `npm run build:extension` and load `dist/extension` as an unpacked extension in `chrome://extensions`. Rebuild and click the reload icon after changes.

## Before opening a pull request

```sh
npm run typecheck
npm test
npm run build
npm run e2e
```

`npm run e2e` drives the real extension in Chrome for Testing. Use `HEADFUL=1 npm run e2e` to watch it.

## Guidelines

- Keep the player small and dependency-free. It ships inside every exported demo.
- Nothing may leave the user's browser. No analytics, no remote fonts, no CDNs in exports.
- Anything that hides information (blur) must be applied to the pixels on export, never only as CSS.
- Keep each pull request focused, and describe the real use case behind it.
