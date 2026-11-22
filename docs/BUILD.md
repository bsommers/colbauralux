# Build and deploy

[Back to README](../README.md)

## Run from source
```sh
npm start        # static server, http://localhost:4796
npm test         # all node:test suites in test/
npm run lint:imports   # catches export-name drift between modules
```

## Single-file build
```sh
node tools/build-web.mjs
```
Writes `dist/web/{index.html,app.js,style.css}` (minified; esbuild is fetched via `npx`, with an unbundled fallback) and `dist/colbauralux.html`: one self-contained file (about 250 KB, 99 KB gzip) that runs even from `file://`.

## GitHub Pages
`.github/workflows/pages.yml` runs on every push to `main`: it runs the tests, builds the game, copies `docs/site/` to the site root and the single-file build to `play/index.html`, then deploys. Enable it once under Settings, Pages, Source: GitHub Actions.

Local preview of the site: `node tools/serve.mjs` and open `/docs/site/index.html`; for the playable embed build first and copy `dist/colbauralux.html` to `docs/site/play/index.html`.

## Screenshots
```sh
node tools/shot.mjs --url "/index.html?autostart=1&bot=1&level=5" --out docs/site/img/play.png --wait 9000
```
Needs a local headless Chrome. `--strict` fails on console errors.

## QA tools
`tools/botplay.mjs` (bot vs AI across levels, difficulties, seeds), `tools/check-imports.mjs`, `tools/art-sheet.mjs` (sprite sheet), `tools/sfx-wav.mjs` (export audio for listening), `tools/make-icons.mjs` (logo and icons).
