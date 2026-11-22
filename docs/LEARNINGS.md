# Learnings
- Gates: `npm test` (63 pass), `node tools/check-imports.mjs` (54 files clean), `tools/smoke_web.sh` OK, botplay exits 0.
- Screens are reachable headless via `window.__colbauralux.screens.setMode('levels')`; force a win by reassigning planet owners in `--eval` (player owner is 1, AI 0).
- Botplay FLAGs (informational, exit 0): autopilot wins <50% on normal at L3 and L14 (1/3); L1 is trivial (<20s) on all difficulties.
