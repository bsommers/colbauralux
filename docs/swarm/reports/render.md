# render report

## What I built
- `src/render/background.js`: seeded parallax stars, drifting nebula blobs, faint grid, cheese moon.
- `src/render/particles.js`: pooled (cap 1500) particles; handlers for every FX_TYPES (spark, ring, crumbs, confetti, boom, capture, levelup); ignores unknown types and non-finite coords.
- `src/render/renderer.js`: `createRenderer(canvas,{bus,settings}) -> {draw,resize,setCRT,shot,toLogical,particles,background,ripples,step,destroy}`. Order per §8; ships batched per owner (one triangle path + one additive glow path), extrapolated by alpha; planet-captured ripple (from `planet` event, position resolved from game at draw time); CRT pass (scanlines, fringe, bloom); hud/screens drawn after CRT so they stay crisp. Fallbacks for missing drawPlanet/drawShip/drawSelectRing/drawSendArrow.
- `test/render.test.mjs`.

## Verification evidence
- `node --test test/render.test.mjs`: 7 pass. 600-ship frame with recording stub: ~4400 ctx calls, 600 ships add <= 8 fills, 0.24 ms/frame (stub, not real raster).
- Fallback path (art module missing) run via a temp copy: draws fine.
- Not verified: real browser fps/visuals (no screenshot taken).

## Deviations from the contract
- `ui.hud`/`ui.screens` are called after the CRT pass, in the screen-space letterboxed transform (hud first, then screens).
- `art.drawShip` is used only when <= 120 ships; above that the batched triangle path is used for speed.

## Mistakes I made and how I fixed them
- First test assertions were sloppy (a nonsense ripple-x check and an absolute fill limit); replaced with exact x and a delta vs 0 ships.

## Learnings for a future agent
- No shared recording stub exists in test/; I used a Proxy-based one inside the test file.

## Requests for other modules
- ui-shell: renderer exposes `toLogical`; call `renderer.resize()` on window resize.
- sim-core: emit `fx` with `capture`/`boom` types; `planet` event drives the ripple.
