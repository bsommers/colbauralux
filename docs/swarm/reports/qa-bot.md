# qa-bot report
## What I built
`tools/botplay.mjs` (rewritten from a different game): autopilot-as-player vs AI over LEVELS x difficulties x seeds, reports winner/time/peak ships/ms per step, flags unwinnable (normal), <50% win rate, and <20 s levels; `--json` for machine output; exports `runOne`. `test/qa-bot.test.mjs` (3 tests). `docs/BALANCE.md` with findings.
## Verification evidence
`node --test test/qa-bot.test.mjs` 3/3 pass. Full matrix 15x4x10 seeds runs in a few seconds, nan 0, no timeouts, 0.002-0.005 ms/step. Flags: L12 unwinnable, L4/L6/L9/L14 under 50%, L1 trivial (18.7 s).
## Deviations from the contract
None. Autopilot difficulty defaults to normal (`--apDiff`).
## Mistakes I made and how I fixed them
`process.exit()` truncated piped stdout at 8 KB for `--json`; replaced with `process.exitCode`.
## Learnings for a future agent
Per-AI `difficulty` in level data overrides the global difficulty in createGame, so several levels do not scale with menu difficulty. Level ids are numeric.
## Requests for other modules
levels: apply the L12, L4, L6, L9, L14 changes in docs/BALANCE.md. defs (FROZEN, ask owner): soften `nine` (aiRate 2.4 -> 2.0). sim-core/levels: consider letting menu difficulty override pinned per-AI difficulty.
