# Balance findings (tools/botplay.mjs)

Method: `node tools/botplay.mjs --seeds 1-10` (autopilot = `createAutopilot` balanced/normal as PLAYER vs level AI, 15 levels x 4 difficulties, 300 s cap, 0.002-0.005 ms/step, no NaN, no timeouts). Win = player; "wins" is wins/10 seeds. Flags: autopilot cannot win on normal; autopilot wins <50% on normal; wins in <20 s.

## Results on normal (10 seeds)
| Level | wins | mean t | note |
|---|---|---|---|
| 1 First Nibble | 10/10 | 18.7 s | TRIVIAL (<20 s), no AI: intended tutorial, par 60 |
| 2,3 | 10/10 | 49 / 38 s | fine |
| 4 Swiss Army | 2/10 | 64 s | hard spike (par 120) |
| 5 | 8/10 | 77 s | fine |
| 6 Mouse Trap Door | 1/10 | 35 s | autopilot loses fast |
| 7,8,10,11,13,15 | 8-10/10 | 31-54 s | fine |
| 9 Muenster Mash | 3/10 | 60 s | 3 AIs, 1 vs 3 rivals |
| 12 Gruyere Gauntlet | 0/10 | 19.6 s | UNWINNABLE for autopilot: lose in ~19 s |
| 14 Stilton Showdown | 3/10 | 54 s | fixed `hard` AIs |

Difficulty scaling: L1 and L12/L14/L15 give identical results on all 4 difficulties because every `level.ai` entry pins its own `difficulty` (or has no AI), which overrides the global one in `createGame`. On L5 and L8 `nine` is 0/10 while `hard` is 6-9/10: the nine step is a cliff (aiRate 2.4, aiProd 1.15).

## Tuning suggestions (concrete)
1. L12: player starts 1 planet (size 2, 14 units) beside 3 hard-turtle planets (3x14 units) and loses by ~19 s on every seed. Give the player a second size-2 planet (14 units) or cut one rival planet to 8 units; target 50-70% autopilot wins and 60-120 s runs (par 240).
2. L4 (2/10) and L6 (1/10): rival gets a 14-unit size-2 planet near the player; on L6 the rival also owns 2 more planets. Start neutrals nearer the player or raise player start units to 18 (L4), and drop L6's rival size-1 `units` 6 -> 4. Target >=50% on normal. Also consider swapping L6 'sniper' to 'balanced' (sniper is the cheapest bot to lose to).
3. L9 (3/10), L14 (3/10): multi-rival maps. Lower L9 commander (owner 4) start 14 -> 10 units; for L14 drop the pinned per-AI `hard` to normal on 1-2 of the 3 AIs so `kitten`/`normal` get meaningfully easier.
4. L1 wins in 18.7 s: fine as a tutorial, but if under-20 s is unwanted, add 2 neutrals further away or set `par` to 30. L1 is the only trivial level.
5. `nine` cliff on L5/L8 (0/10 vs hard 6-9/10): reduce `nine.aiRate` 2.4 -> 2.0 or `aiProd` 1.15 -> 1.08 so nine is beatable ~30%.
6. Decide whether per-AI `difficulty` pins should follow the chosen menu difficulty (e.g. use the pin only as a floor) so the kitten difficulty is not pointless on levels 12/14/15.

Caveat: the autopilot is the same AI code as the opponents, with no focus-fire or timing tricks, so its win rate is a lower bound for a human; target ~50% for the bot on mid levels, 20-50% on the last levels.

## Applied
- game.js: per-AI `level.ai[].difficulty` pins now apply only when `createGame` gets no explicit `difficulty`; an explicit one overrides every AI.
- levels.js: L4 player start 14->16; L6 sniper->balanced, player 14->16, rival size-2 14->14 kept, rival size-1 6->4; L9 commander 6->4, rivals 14->12; L12 second player planet (14 units), rival planets 14/14/14 -> 8/8/6; L14 pins turtle/sniper hard->normal (rusher stays hard).
- Result (normal, seeds 1-10): L4 7/10, L6 8/10, L9 6/10, L12 7/10, L14 3/10. Kitten beats hard on L12 (10 vs 8) and L14 (9 vs 3); L15 ties at 10/10 (kitten faster).
- Side effect: since botplay passes difficulty explicitly, pinned kitten on L2/L3 no longer applies (normal: L2 0/10, L3 2/10); consider easing those separately.
- L2/L3 retuned without relying on pins: L2 player 14->18, rival 14->8; L3 player 18/8 (was 14/6), rival 14->10 and size-1 6->4. Normal: L2 10/10, L3 7/10; L5/L7/L8 unchanged (8/8/9); L1 untouched.
