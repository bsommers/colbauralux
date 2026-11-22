# Swarm manifest — Colbauralux

Single source of truth for the agent swarm. `node tools/swarm-tracker/bin/swarm-plan.mjs` turns this file into
`docs/swarm/prompts/<id>.md` (preamble + task + role appendix) and `.tracker/plan.json`.
Agent header: `## id | model | phase | role | Name`, then an `owns:` line, then the task.
Spawn each agent with: "Read {{root}}/docs/swarm/prompts/<id>.md and execute it exactly."

## @meta
project: Colbauralux
tagline: Auralux, but the cheese is real and the cat is in charge. Colby Jack Clowder vs the rats.

## @preamble
You are subagent `{{id}}` ({{name}}) in a parallel swarm building **Colbauralux** in `{{root}}`. Model tier: {{model}}.

Rules:
1. `ARCHITECTURE.md` (and any shared definitions file) is the binding contract. Read only what your task needs: list the
   sections (`grep -n '^## ' ARCHITECTURE.md`), Read those with offset/limit, grep shared files instead of reading them whole.
2. You own ONLY: {{owns}}. Besides those you may write your tests under `test/`, your report, and scratch output.
   Other agents are writing other modules **right now**: their files may be missing or half-written. Code against the
   contract, guard with fallbacks, never edit a file you do not own; list what you need under "Requests" in your report.
3. Progress reporting (drives a live dashboard): first `node tools/swarm-tracker/bin/track.mjs {{id}} start "<plan in a few words>"`;
   then `track.mjs {{id}} progress <pct> "<what just landed>"` at 4 or more milestones; finally
   `track.mjs {{id}} done "<one-line result>"` (or `blocked` / `failed` with the reason). Run from {{root}} or set TRACKER_ROOT.
4. Verify for real before claiming done: run it, test it, look at it. Report failures honestly.
5. If you must wait for another agent's file, poll (`for i in $(seq 90); do [ -f <path> ] && break; sleep 10; done`),
   then proceed with a fallback if it still is not there.
6. Finish by writing `docs/swarm/reports/{{id}}.md` with sections: **What I built** · **Verification evidence** ·
   **Deviations from the contract** · **Mistakes I made and how I fixed them** · **Learnings for a future agent** ·
   **Requests for other modules**. Report shared-library defects here too, do not only work around them.
7. Keep chat output minimal (status lines only). Final reply: 8 lines max.
8. Save work to disk early and often; the swarm can be interrupted by usage limits. If your owned files already exist,
   you are RESUMING: inspect them and continue instead of starting over.
9. Install no new dependencies. No git commands unless told. Never kill processes you did not start.
10. Context budget — your whole context is re-sent on every tool call, so keep it small: read files with offset/limit
    or grep, never whole large files; pipe command output through `tail`/`grep` (40 lines max); look at an image only
    when you will act on it (about 6 in total; prefer numeric checks); never re-read a file you just wrote.
11. Checkpoints — keep `docs/swarm/progress/{{id}}.md` (30 lines max: **Done** · **Next steps, in order** ·
    **Gotchas** · **Commands to verify**) and update it at every milestone. If it exists when you start, you are a fresh
    agent continuing the job: read it first, trust it, do not re-derive. After about 25 tool calls, or at a milestone with
    substantial work left, update the checkpoint and END your turn with a last line `CONTINUE: <next step>`. Only write
    the report and call `track.mjs ... done` when the whole task is finished.
12. Stamp times with `date -u`; never type a timestamp.

Your task:

## sim-core | sonnet | p2 | sim | Sim core
owns: src/sim/game.js, src/sim/spatial.js, test/sim-core.test.mjs
Implement ARCHITECTURE.md §4 exactly: planets, queued launches, ships, spatial-grid combat, planet capture/levelup/production, win/lose, all §5 events, determinism, `maxShips`. Guard a missing `./ai.js` with dynamic fallback (no AI). Tests (node:test): deterministic replay, 1:1 annihilation, capture rule incl. neutral, levelup, cap, send pct, queue drop on owner change, win/lose, 900-ship step under 4 ms average.

## levels | sonnet | p2 | levels | Levels and generator
owns: src/sim/levels.js, test/levels.test.mjs
Implement ARCHITECTURE.md §6 levels part: >= 14 campaign levels with pun names/blurbs and sensible `par` seconds, `generateLevel`, `validateLevel`. Tests: all levels + 50 generated seeds validate, generation deterministic, symmetric fairness.

## sim-ai | sonnet | p2 | sim | Enemy AI
owns: src/sim/ai.js, src/sim/autopilot.js, test/sim-ai.test.mjs
Implement ARCHITECTURE.md §6 AI part + `createAutopilot` (§11). If `src/sim/game.js` is not there yet poll for it, meanwhile write the AI against the §4 API with a small stub game in your test. Once game.js exists, prove: each personality beats a do-nothing player on a generated 1v1 within 4 simulated minutes (several seeds) and AI-vs-AI is not always a first-mover win.

## art-vector | sonnet | p2 | art | Neon vector art
owns: src/art/vector.js, test/art-vector.test.mjs
Implement ARCHITECTURE.md §7 by adapting `ref/ratrace/art/vector.js`. Verify with `node tools/art-sheet.mjs` / `tools/sheet.mjs` style contact sheets in `out/previews/` (adapt the tool args if needed; you may edit `tools/art-sheet.mjs`). View each sprite at x4. Planets must read clearly at levels 0/1/2 and all 5 owners.

## render | sonnet | p2 | render | Renderer, particles, background
owns: src/render/renderer.js, src/render/background.js, src/render/particles.js, test/render.test.mjs
Implement ARCHITECTURE.md §8 adapting `ref/ratrace/render/*`. Ships drawn batched; benchmark with a synthetic 600-ship game object using the recording stub; add a planet-captured ripple and `fx` handlers for every `FX_TYPES`. Tolerate missing `drawPlanet` etc. via fallback until art-vector lands.

## audio | sonnet | p2 | audio | WebAudio synth
owns: src/audio/audio.js, src/audio/sfx.js, src/audio/music.js, test/audio.test.mjs, tools/sfx-wav.mjs
Implement ARCHITECTURE.md §9 adapting `ref/ratrace/audio/*`. Offline render every SFX/MUSIC name to check peak levels, durations, loop seams; tests as ratrace.

## ui-shell | sonnet | p3 | ui | App shell, input, HUD, screens
owns: index.html, style.css, src/main.js, src/core/input.js, src/core/settings.js, src/ui/hud.js, src/ui/screens.js, src/ui/menus.js, test/ui-shell.test.mjs
Implement ARCHITECTURE.md §10 adapting `ref/ratrace/{main,input,settings,hud,screens,menus}`. Wait (poll) for sim-core/art-vector/render/audio files; use fallbacks until present. Prove input swipe-select logic in node tests with synthetic pointer events; screenshot title/play/win via `tools/shot.mjs`.

## qa-bot | sonnet | p3 | qa | Bot harness and balance
owns: tools/botplay.mjs, test/qa-bot.test.mjs, docs/BALANCE.md
Adapt `tools/botplay.mjs`: autopilot vs AI over all `LEVELS` x difficulties, report winner/time/peak ships/ms per step. Flag levels the autopilot (as player) cannot win on normal and levels trivial under 20 s; write findings with concrete tuning suggestions in `docs/BALANCE.md` and send them as Requests (do not edit others' files).

## logo-icons | sonnet | p3 | art | Logo, icons, promo graphics
owns: docs/site/img/**, docs/site/logo/**, tools/make-icons.mjs, favicon.svg, icon-*.png
Create the snazzy brand kit with code only (SVG + node canvas-free PNG writer or the game's own renderer through `tools/shot.mjs`): `logo.svg` (COLBAURALUX wordmark: neon cheese wheel with cat ears, orange/purple), `logo-mark.svg` (square mark), `favicon.svg`, `icon-192.png`, `icon-512.png`, `og.png` (1200x630), `hero.png`. Use Colby orange `#ff9b2e`, cheese `#ffd24a`, rat purple `#c27bff`, bg `#05030f`. Also `tools/make-icons.mjs` that regenerates them. Reuse `ref/ratrace/site/img` style for reference only.

## docs-site | sonnet | p4 | docs | Documentation and GitHub Pages
owns: README.md, docs/HOW-TO-PLAY.md, docs/ARCH-OVERVIEW.md, docs/BUILD.md, docs/HOW-IT-WAS-MADE.md, docs/site/index.html, docs/site/style.css, docs/site/**.html, .github/workflows/pages.yml
Full documentation: README (logo, hero, badges, quickstart, controls, link to every doc and the Pages site), HOW-TO-PLAY, ARCH-OVERVIEW (ASCII + Mermaid diagrams of sim/render/audio/ui/AI, data flow), BUILD (single-file build with `tools/build-web.mjs`), HOW-IT-WAS-MADE (the swarm story from `docs/swarm/reports/*` and `docs/LEARNINGS.md`), and a polished GitHub Pages site in `docs/site/` (hero, features, playable embed link to `play/` built single-file, screenshots from `docs/site/img/`, controls, factions, credits) plus a Pages workflow that builds the game into `play/`. Use real screenshots (take them with `tools/shot.mjs`). Every doc links back to README and README links to all docs.

## integrate-qa | sonnet | p5 | qa | Integration and polish
owns: test/integration.test.mjs, docs/LEARNINGS.md
Run `npm test`, `node tools/check-imports.mjs`, `tools/smoke_web.sh`, full bot campaign, strict screenshots of every state. Fix nothing you do not own; file precise Requests in your report listing file, line, defect. You may fix trivial integration seams (import names, typos) after logging them. Record learnings in docs/LEARNINGS.md.
