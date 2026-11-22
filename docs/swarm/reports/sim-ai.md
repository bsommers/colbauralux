# sim-ai report

## What I built
- `src/sim/ai.js`: `createAI({owner, personality, difficulty, rng}) -> {act(g, dt)}`. Cadence 0.9s/aiRate with jitter. Per decision: defence (reinforce planets facing inbound surplus), then scored offence/expansion (need = garrison + target production over travel time, margin per personality, minus friendly ships already inbound), then venting capped planets to the best friendly planet. Uses only public state (planets, ships, sendAs). Own rng (fork or createRng seeded by owner).
- Personalities differ by reserve, margin, neutral/enemy weight, range, attack gating, fleet avoidance (rusher: all-in waves at nearest/weakest; turtle: attacks only when 1.5x ahead; sniper: tight margin, avoids big enemy fleets).
- `src/sim/autopilot.js`: `createAutopilot({owner=PLAYER, personality, difficulty, rng}) -> {act(game, dt=1/60)}` wrapping createAI.
- `test/sim-ai.test.mjs`: stub-game tests + real-game tests.

## Verification evidence
`node --test test/sim-ai.test.mjs`: 8 pass, 0 fail, 0 skipped (real game.js/levels.js present). Win time vs do-nothing on generateLevel seeds 1-8 (seconds): normal: rusher 30-38, turtle 52-57, expander 40-49, balanced 40-51, sniper 37-45; kitten worst case 106 (sniper); nine lives 26-51. All far under 240s. AI-vs-AI (25 pairings x 4 seeds, normal): player-side wins 26, AI-side wins 24, 50 timeouts (stalemates); not a first-mover sweep.

## Deviations from the contract
- `difficulty` accepts an id string or a DIFFICULTY object. `act` takes an optional dt (default 1/60).

## Mistakes I made and how I fixed them
- Turtle's range limit was applied to source planets too, so it could never mass a force against a distant capital (stub test timed out). Range now only gates target selection.

## Learnings for a future agent
- Stub game in the test mirrors §4 rules for tuning before game.js exists.
- Many AI-vs-AI games stalemate at cap; fine for this task.

## Requests for other modules
- None. (game.js constructs AI with whatever `rng` it passes; AI works without one.)
