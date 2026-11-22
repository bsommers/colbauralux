# How it was made

[Back to README](../README.md)

Colbauralux was built by a swarm of parallel AI agents, each owning a disjoint set of files and coding against one binding contract, [ARCHITECTURE.md](../ARCHITECTURE.md). Nine agents wrote the modules at the same time, so most of them wrote code before their neighbours' files existed.

| Agent | Built | Evidence |
|---|---|---|
| sim-core | game.js, spatial grid, events | 13 tests, deterministic replay, 900 ships under 4 ms/step |
| sim-ai | five AI personalities, autopilot | 8 tests, AI beats a do-nothing player on generated maps |
| levels | 15 levels, fair map generator | 7 tests, 50 seeds validated |
| art-vector | all sprites, planets, ships | recording-context tests, sprite sheet |
| render | renderer, particles, background | 600 ships per frame, batched |
| audio | synthesized SFX and 5 tracks | 6 tests, loop seams checked |
| ui-shell | input, menus, HUD, main loop | 14 tests, strict screenshots |
| qa-bot | bot-vs-AI balance matrix | flagged unwinnable and trivial levels |
| logo-icons | logo, favicon, OG image | generated from the game's own pixel font |

The per-agent reports are in [docs/swarm/reports/](swarm/reports/).

## What went wrong, and what it taught
- Parallel modules drift on export names. Rule: run `tools/check-imports.mjs` after every wave (see [LEARNINGS.md](LEARNINGS.md)).
- Valid-but-wrong output slips past validity tests: the level generator mirrored the player home to the wrong side and the tests still passed. Print generated output once.
- Level data pinned a per-AI difficulty that overrode the menu setting, so some levels ignored difficulty. The QA bot found this; see [BALANCE.md](BALANCE.md).
- `process.exit()` truncated piped output at 8 KB in the bot tool; use `process.exitCode`.
- Audio and renderer visuals were verified numerically, not by ear or eye, so expect rough edges.
- Fixed in flight: a logo glow filter blurred into a brown band; the AI turtle could never mass a force because its range limit also applied to source planets.

## Process rules that worked
Disjoint file ownership, a frozen core, small checkpoints per agent, honest reports with a "Requests" section, and a tracker dashboard (`npm run tracker`).
