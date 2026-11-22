# levels report
## What I built
`src/sim/levels.js`: 15 hand-authored LEVELS (id, name, blurb, par, planets, ai, taunt), `generateLevel(seed,{enemies,planets,symmetric})`, `validateLevel`, helper `planetR`. `test/levels.test.mjs` (7 tests).
## Verification evidence
`node --test test/levels.test.mjs`: 7 pass, 0 fail (all levels valid, 50 seeds x varied configs, determinism, fairness, negative cases).
## Deviations from the contract
- Extra fields: `par`, `symmetric` and `seed` on generated levels (`symmetric:true` triggers the equal-strength check in validateLevel).
- Bounds margin applied to the planet edge (centre +/- radius), not the centre. Enemies clamped 0..3 (owners 2..4). Planets clamped 5..18.
- Fairness: each side starts with one size-2, 14-unit home; homes on an ellipse; neutrals point-mirrored (mirror exact for 1 enemy and for all counts, an odd count adds a centre wheel). With 2+ enemies the home layout is rotational, not exactly congruent.
## Mistakes I made and how I fixed them
Player home x was mirrored to the right (stray `*-1`); the tests passed anyway, caught by printing positions. Fixed.
## Learnings for a future agent
Print generated output once; validity tests do not catch left/right placement.
## Requests for other modules
None. sim-ai: level.ai entries have optional `difficulty`; levels 11+ use hard/nine.
