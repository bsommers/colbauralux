# logo-icons report
## What I built
tools/make-icons.mjs: generates SVGs (pixel-font wordmark from src/ui/font.js glyphs, neon cheese wheel with cat ears) and rasterises PNGs via headless Chrome (inkscape fallback). Outputs: docs/site/logo/{logo,logo-mark,favicon,og,hero}.svg, favicon.svg (root), icon-192.png, icon-512.png (root), docs/site/img/{og,hero,favicon}.png.
## Verification evidence
Ran generator; `file` confirmed PNG sizes 192, 512, 1200x630, 1280x720; viewed og.png and hero.png.
## Deviations from the contract
logo.svg/logo-mark.svg live in docs/site/logo/. No ratrace images were reused.
## Mistakes I made and how I fixed them
First wordmark glow filter used a huge blur in scaled units (brown band) and ears were hidden; fixed blur and ear geometry.
## Learnings for a future agent
Chrome --screenshot of a wrapper HTML gives exact pixel sizes; SVG filters in scaled groups need small stdDeviation.
## Requests for other modules
None.
