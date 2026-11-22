# COLBAURALUX: Architecture & Contracts (2D web game)

Binding contract. If your module disagrees with it, your module is wrong. If the contract is wrong/ambiguous, do the sensible thing and record the deviation + "Requests" in `docs/swarm/reports/<id>.md`.

## 1. Vision
A parody of **Auralux** (iPad real-time-strategy, 2011) in the Colby Jack cat universe (siblings: Omega Ratrace, catxzzon). Space is full of **Cheese Wheels** (planets). You are **Colby** (orange): capture wheels, stream **kittens** (tiny cat-head ships) to claim neutral cheese and overrun rival rat/mouse factions. Wheels spawn ships while owned and level up as their garrison grows. Ships of opposing teams annihilate 1:1 on contact; a hostile ship arriving at a wheel removes one garrison unit, and a wheel with 0 garrison flips to the attacker.
Pillars: (1) readable swarm RTS with satisfying drag-to-send, (2) juice (glow, particles, shake, CRT, streams of ships), (3) charm (cat/cheese puns, Colby portrait, taunts), (4) **zero assets, zero deps**: neon-vector art drawn by code, all audio synthesized, plain ES modules, no bundler to play. Original art only; no real brands in the shipped game (the word "Auralux" appears only in docs as the inspiration).
Rules: sim randomness ONLY from `game.rng` (never `Math.random`); `core/`, `sim/`, `art/` import in Node (no DOM at import time); touch only files you own (§3); never edit FROZEN files (`src/core/{defs,events,rng}.js`, `src/ui/font.js`, this file). `ref/ratrace/` is a READ-ONLY reference copy of Omega Ratrace code (art/vector.js, renderer, particles, background, audio, input, settings, hud, screens, main): copy-and-adapt from it, never import from it.

## 2. Canonical data
`src/core/defs.js` (read it): `W=960,H=540`, `FACTIONS`, `PLAYER=1`, `TUNING`, `DIFFICULTY`, `PERSONALITIES`, `SPRITES`, `SHIP_SPRITE`, `SFX`, `MUSIC`, `EVENTS`, `FX_TYPES`, `TAUNTS`, `PALETTE`. Origin top-left, +y down.
Owners: 0 neutral, 1 player, 2 rats (purple), 3 mice (cyan), 4 commander (red). Size 1..3 radii `TUNING.planetR`.

## 3. Layout & ownership
```
index.html style.css src/main.js src/core/input.js src/core/settings.js src/ui/{hud,screens,menus}.js     ui-shell
src/core/{defs,events,rng}.js  src/ui/font.js                                           FROZEN
src/sim/{game,spatial}.js                                                               sim-core
src/sim/ai.js                                                                           sim-ai
src/sim/levels.js                                                                       levels
src/sim/autopilot.js tools/botplay.mjs                                                  qa-bot
src/art/vector.js                                                                       art-vector
src/render/{renderer,background,particles}.js                                           render
src/audio/{audio,sfx,music}.js                                                          audio
README.md docs/** (not swarm/, not LEARNINGS.md) logo & icons under docs/site/            docs-site
tools/ (serve, shot, sheet, check-imports, build-web)                                   factory (done)
```
Tests: `test/<id>.test.mjs` (node:test, `npm test`). Previews/screens -> `out/`. Big build output -> `/datanapps/...`, never `/tmp`.

## 4. Simulation API (`src/sim/game.js`, owner sim-core)
```js
import { createGame } from './sim/game.js';
const g = createGame({ seed, bus, level, difficulty: 'normal', sendPct: 0.5, ai: true });
g.update(dt);                          // fixed step 1/60 (dt <= 1/30); also calls ai.act via g.ais (see below)
g.send(fromIds /*number[] planet ids*/, toId, pct?)  // -> number of ships queued. Only planets owned by `owner` (default PLAYER) launch; pct defaults g.sendPct. toId may be any planet (incl. own = reinforce). Ignores from===to.
g.sendAs(owner, fromIds, toId, pct)    // same for any owner (AI uses it)
g.setSendPct(p)
```
**Level** (see §6): `{ id, name, blurb, planets:[{x,y,size,owner,units,level}], ai:[{owner,personality,difficulty?}], taunt? }`. `createGame` deep-copies it; ids = array index.
**State** (read-only for others): `g.t, g.state ('play'|'won'|'lost'), g.planets, g.ships, g.stats, g.rng, g.bus, g.sendPct, g.level, g.ais`.
`planet = { id,x,y,size,r,owner,units,level,gen /*accum*/,flash,queue /*pending launches [{to,owner,n}]*/ }`; units is an integer garrison; `prod(planet) = TUNING.prod[level]*TUNING.sizeProd[size]*(owner>1 ? diff.aiProd : 1)`; only owner>0 produces; production stops at `TUNING.cap[level]`; `units >= TUNING.levelUpAt[level]` -> `level++` + `levelup` event.
`ship = { id,owner,x,y,vx,vy,to /*planet id*/,t,dead }`. `g.ships` is a flat array (swap-remove or filtered each step; ids unique, increasing).
`stats = { time, kills:{1,2,3,4}, losses (player ships lost), captured, lost, peakShips }`.
**Rules:** launching moves `n = max(1, floor(units*pct))` (if units>=1) out of the garrison into `planet.queue`; the queue drains at `TUNING.launchPerSec` per planet into ships at the planet rim in the direction of the target with small angular jitter; ships fly straight at `TUNING.shipSpeed` toward the target planet centre. Arrival (distance <= planet r): same owner -> `units++` (absorbed if units >= cap); neutral/enemy -> `units--`, and if the planet had 0 units the arriving ship captures it: `owner = ship.owner, units = TUNING.captureStartUnits, level = 0` (queue cleared), emit `planet`. Opposing ships within `TUNING.fightR` kill each other 1:1 (use `spatial.js` grid; each ship fights at most once per step; deterministic order). Orders against a planet whose owner changes mid-flight still resolve by the rule above (friendly arrival = reinforce). If the source planet changes owner while its queue is pending, the queue is dropped. `TUNING.maxShips` caps live ships (queues wait). Win: no planet and no ship owned by any AI owner (`owner>=2`) -> `won`; lose: player owns no planet and no ship -> `lost` (check after update; emit `state` once). Emit every event in §5. Deterministic for same `(seed, level, command stream)`.
**AI hook:** `g.ais = createAI(...)[]` constructed in `createGame` from `level.ai` via `import { createAI } from './ai.js'` (guard a missing module with try/catch/dynamic fallback: no AI). Each step `for (const a of g.ais) a.act(g, dt)`. Disable with `ai:false` (tests).
**Spatial** (`src/sim/spatial.js`): `createGrid(cell, w, h) -> { clear(), insert(item), query(x,y,r,cb) }`.

## 5. Events (`bus.emit(type, payload)`; types in `defs.EVENTS`)
`sfx {name,x?,y?}` (`hit` events must be throttled by the emitter to <= 20/s) · `music {name|null}` · `fx {type,x,y,opts?}` (`FX_TYPES`; opts: `color, n, angle, speed, r`) · `shake {mag,dur}` · `flash {color,a,dur}` · `popup {text,x,y,color?}` · `banner {text,sub?,dur}` · `taunt {text,dur,owner}` · `planet {id,owner,prev}` · `levelup {id,level}` · `launch {from,to,owner,n}` · `hit {x,y,owner}` · `state {state}` · `score {...stats}` · `pause {on}`. Audio listens to `sfx`/`music` only.

## 6. Levels & AI (owners: `levels`, `sim-ai`)
`src/sim/levels.js` exports: `LEVELS` (>= 14 hand-authored campaign levels: 1v0 tutorial-ish neutral grab, 1v1, 1v2, 1v3, big maps, ramping difficulty; names/blurbs with cheese puns), `generateLevel(seed, { enemies=1, planets=9, symmetric=true }) -> level` (deterministic, own rng, mirrored start positions so the match is fair), `validateLevel(level) -> { ok, errors[] }` (in bounds with margin 40, no overlap with gap >= 14, player and every AI own >= 1 planet and equal start strength per side for generated maps, planets >= 5, planet count <= 18). Every `LEVELS` entry and 50 generated seeds must validate.
`src/sim/ai.js` exports `createAI({ owner, personality, difficulty, rng }) -> { act(g, dt) }`. Uses only `g.planets`, `g.ships`, `g.sendAs`, `g.rng`-free (own rng from the passed `rng`, e.g. `g.rng` forks via `rng.fork?.()` or seeded `createRng(seed+owner)` from `core/rng.js`). Decision cadence = `base 0.9s / diff.aiRate` with jitter; personalities: `rusher` (sends big waves at the nearest weakest enemy), `turtle` (grabs near neutrals, levels up, counterattacks when ahead by 1.5x), `expander` (prioritises neutrals), `balanced`, `sniper` (targets planets it can capture with exactly enough units, avoids fights with big fleets). Must not cheat (no hidden info beyond what a player sees) and must beat a do-nothing player in < 4 minutes on a 1v1 level.

## 7. Art API (`src/art/vector.js`, owner art-vector)
Neon-vector, bright strokes on dark, glow by the renderer (`shadowBlur`/additive), no bitmaps. Exports:
`drawSprite(ctx, name, x, y, angle=0, scale=1, opts={})` for every `SPRITES` name (`opts: {t, color, glow, hurt, blink}`), `spriteRadius(name)`;
`drawPlanet(ctx, planet, t, opts={})`: a cheese wheel viewed top-down: rind coloured by `factionOf(owner)`, holes (deterministic by id), 0..2 level rings/gears, size from `planet.r`, neutral = pale yellow; `opts: { selected, hover, targeted, flash }`; plus orbiting garrison dots (`min(units, 24)`) and a centred count via `ui/font.js drawText` (hidden when units==0 on neutral);
`drawShip(ctx, owner, x, y, angle, t)` (tiny, <= 12 canvas ops; faction sprite, 1 colour, no shadowBlur: the renderer batches glow);
`drawSelectRing(ctx, x, y, r, t)`, `drawSendArrow(ctx, pathPoints, t, color)` (dashed neon drag line with arrowhead);
`drawColbyPortrait(ctx, x, y, scale, t)`, `drawLogo(ctx, cx, y, t)` ("COLBAURALUX" neon with cheese holes + tiny cat ears on the A), `drawFactionBadge(ctx, owner, x, y, s)`.
Reuse and adapt `ref/ratrace/art/vector.js` (Colby, mouse, rat, commander, logo helpers). Must run in Node with a recording stub context.

## 8. Render API (`src/render/*`, owner render)
`createRenderer(canvas, { bus, settings }) -> { draw(game, alpha, ui?), resize(), setCRT(on), shot(), toLogical(clientX, clientY) -> {x,y} }`. Draws logical 960x540 letterboxed, devicePixelRatio aware. Order: background (`createBackground(seed) -> {update(dt), draw(ctx,t)}`: parallax stars, drifting nebula, faint grid, cheese-moon) -> planets (`drawPlanet`) -> ships (batched by owner: one path per faction, additive glow pass; must stay >= 55 fps with 600 ships) -> particles (`createParticles(bus) -> {update(dt), draw(ctx), clear()}` subscribing to `fx`) -> selection/drag overlay -> shake -> flash -> optional CRT pass -> `ui.hud(ctx)` / `ui.screens(ctx)` callbacks. `ui = { selection:Set<id>, hover:id|null, target:id|null, dragPath:[{x,y}]|null, hud, screens }`. Interpolate ships with `alpha` if cheap (optional). Captured planets get a ripple ring in the new owner's colour.

## 9. Audio API (`src/audio/audio.js`, owner audio)
`createAudio({ bus, ctxFactory }) -> { resume(), setVolume({master,sfx,music}), play(name), music(name|null), muted, setMuted(b) }`, self-subscribes to `sfx`/`music`. WebAudio only, synthesize everything. Every name in `SFX` and `MUSIC` must exist. `hit` is spammed: voice-limit (<= 8 concurrent), randomised pitch, very short. `send` = rising whoosh scaled by nothing (one per command), `capture` = happy arpeggio, `lost` = descending minor, `levelup` = chime, `meow`/`squeak` = formant blips. Music: loopable >= 8 bars, calm-but-driving ambient for `play_a`/`play_b` (so you can think), heroic jaunty `title`, `victory` fanfare, `defeat` sad. Guard `AudioContext` (Node-importable, testable with an offline stub). Adapt `ref/ratrace/audio/*`.

## 10. UI (`src/main.js`, `src/core/input.js`, `src/core/settings.js`, `src/ui/*`, `index.html`, `style.css`; owner ui-shell)
Fixed-timestep loop (1/60, accumulator), speed multiplier `TUNING.speedSteps`. URL params: `?autostart=1` (skip title; level 1), `?level=N`, `?seed=N` (generated skirmish), `?bot=1` (autopilot plays the player side), `?debug=1`.
**Controls** (`core/input.js`, `createInput(canvas, {toLogical, getGame}) -> { poll() -> frameState, ui state, dispose() }`): mouse/touch/pen via pointer events. Press on an OWN planet starts a swipe; the path adds every own planet it passes over to the selection; release on any planet sends the selection there (`g.send`); release on empty space cancels; tap an own planet with nothing selected selects it (tap another to send). Double-tap/`A` = select all own planets, `Esc` clear, `1..4` set send % (25/50/75/100), `Space`/`P` pause, `F` speed step, `R` restart level, `M` mute, `C` CRT, `Enter` select/continue, `N` next level. Gamepad optional. Multi-touch safe; `touch-action:none`.
**States:** title (Colby portrait + logo + attract demo: bot vs bot on a random map + PLAY / SKIRMISH / OPTIONS), level select (campaign grid with locked/cleared + best time from `localStorage`), play (HUD: planets owned per faction as share bar, send% selector, speed, pause, level name; taunt bubbles), pause menu (resume/restart/options/quit), win/lose screen (time, kills, lost; NEXT/RETRY/MENU; confetti), options (volumes, CRT, difficulty, send %, mute). Progress persisted (`settings.js`: `loadProgress/saveProgress {cleared:{[levelId]:{time,stars}}}` stars by speed vs `level.par`). Text via `ui/font.js`. Responsive full-window canvas; page dark and centred; footer line linking README/controls.

## 11. QA
`node tools/shot.mjs --url "/index.html?autostart=1&seed=1" --out out/shots/x.png --wait 1500` (headless Chrome; `--strict` fails on console errors). `node tools/check-imports.mjs`. `tools/botplay.mjs` runs bot-vs-AI headless over N seeds/levels and reports winner/time/ships (`src/sim/autopilot.js` exports `createAutopilot({owner, personality, difficulty}) -> { act(game) }` which wraps `createAI` for the player side). `npm test` stays green. Tracker: `npm run plan && npm run tracker` -> http://127.0.0.1:4790/.
