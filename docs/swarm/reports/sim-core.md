# sim-core report

## What I built
- `src/sim/spatial.js`: `createGrid(cell,w,h)` with `clear/insert/query` (query passes items within r; cb returning true stops).
- `src/sim/game.js`: `createGame` per ARCHITECTURE §4: planets, queued launches (drain at launchPerSec, rim spawn, jitter), ships, grid combat (nearest enemy, each ship fights once per step, deterministic), arrival/capture/levelup/production/cap, `maxShips`, win/lose, all §5 events, AI hook via top-level `await import('./ai.js')` in try/catch (works with the real ai.js; difficulty passed as the DIFFICULTY object, rng as `createRng(seed+owner*977)`).
- `test/sim-core.test.mjs`: 13 node:test tests.

## Verification evidence
`node --test test/sim-core.test.mjs`: 13 pass, 0 fail. Covers deterministic replay, 1:1 annihilation, capture incl. neutral, levelup, cap, send pct, queue drop on owner change, win/lose, maxShips, 900-ship step avg < 4 ms (measured ~0.1-1 ms).

## Deviations from the contract
- Levels with no enemy at all (no AI, no owner>=2 planets) win when no neutral planets remain (otherwise instant win).
- Per-owner difficulty: `level.ai[].difficulty` overrides game difficulty for `aiProd` and AI.
- `hit` event emitted per kill (not throttled); `fx spark` and `sfx hit` throttled (0.04s / 0.05s).
- `peakShips` = max simultaneous live player ships. `losses` counts player ships dying in combat or on enemy planets.
- Extra planet field `_la` (launch accumulator); extra g fields `difficulty`, `seed`.
- `level.taunt` (string or {text,dur,owner}) emitted once on first update.

## Mistakes I made and how I fixed them
- Two tests were wrong (units 29 at level 0 levels up immediately; a perf test was dominated by combat annihilation). Rewrote them.

## Learnings for a future agent
- levelUpAt[0]=24 < cap[0]=30, so level-0 planets with >=24 units upgrade at once.

## Requests for other modules
- None.
