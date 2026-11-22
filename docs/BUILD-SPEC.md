# Build spec: recreate Colbauralux from scratch

[README](../README.md) · [Build timeline](BUILD-TIMELINE.md) · [How it was made](HOW-IT-WAS-MADE.md)

This is the complete recipe for the session that produced this repo: what was asked, which tools and assets were used, the orchestration steps with exact commands, the agent swarm (ids, models, file ownership), the follow-up passes, the verification gates, and the ship steps. Following it reproduces the result in about 12 minutes of wall-clock time. Agent output varies run to run, so you get an equivalent game, not a byte-identical one. The committed `ARCHITECTURE.md`, `src/core/defs.js` and `docs/swarm/SWARM.md` ARE the contract and swarm manifest, so a rebuild can start from step 4 and skip the design work.

## 1. The request (verbatim, in order)

1. "lets use the tooling and assets @../game-factory/ and the graphics and characters from @../omega-ratrace/ to build a parody version of the ipad game auralux. As before, use the tracker and set up autonomous sub-agents to build this game. GO!"
2. "pop open the tracker in a webrowser. initialize git. do full documenation, gitpage, snazzy logo and icons, graphics, link to README.md; commit and push to remote when ready"
3. "commit and push when it's green" · "commit and push it" · "are you making a github gitpages?" · "make it public"
4. "record the overall build time and stages as shown in the tracker into the repo. link it to README.md. show the gantt chart in README.md"
5. "tell me the overall time line and update the docs, to show that too."
6. "play the game and screenshot level 5" · "open the live site and play level 5" · "fix the win screen stars"
7. "save the whole build-spec that can be used to recreate this full session from scratch. commit and push to remote"

## 2. Prerequisites

- Node 18+ (used 20+), Chrome or Chromium (headless, for `tools/shot.mjs`), `git`, `gh` logged in (`gh auth status`), Python 3 (only for small scripted edits), ImageMagick optional (`tools/contact_sheet.sh`).
- Sibling checkouts next to the new repo: `game-factory/` (tooling, templates, tracker) and `omega-ratrace/` (art, audio, renderer, input, UI reference). Both are the user's own repos.
- Claude Code with the Agent tool. Orchestrator and all 11 swarm agents used the `sonnet` tier (the user's rule: sonnet for multi-file work, haiku for mechanical edits, opus only for architecture or security).
- Large temp output goes to `/datanapps/claude-tmp`, never `/tmp` (user rule: `/tmp` is tmpfs).

## 3. Design brief (what Colbauralux is)

Parody of Auralux (iPad RTS) in the Colby Jack cat universe. Planets are **Cheese Wheels**; ships are **kittens** (Colby, orange `#ff9b2e`) against the **Rat Pack** (purple `#c27bff`), **Mouse Mob** (cyan `#7df9ff`) and **Commander Cheddar** (red `#ff5470`). Owned wheels spawn ships and level up with garrison size; opposing ships annihilate 1:1; a hostile arrival removes one garrison unit and flips a 0-garrison wheel. Drag-to-send with swipe multi-select, send fraction 25/50/75/100%, speed x1/x2/x4. Zero assets, zero dependencies: neon-vector art drawn with canvas paths, synthesized WebAudio, plain ES modules. Logical playfield 960x540. Full rules: [ARCHITECTURE.md](../ARCHITECTURE.md).

## 4. Orchestrator steps (exact commands)

```sh
# 4.1 scaffold a zero-dep web game with the tracker (dir must not exist or be empty)
cd ~/src/fun/game-factory
bin/factory new ~/src/fun/colbauralux "Colbauralux" --web
cd ~/src/fun/colbauralux            # a git repo already exists from the scaffold; no commits yet

# 4.2 seed reference material from Omega Ratrace (agents copy-and-adapt, never import)
R=../omega-ratrace; mkdir -p src/core src/ui src/art src/render src/audio src/sim ref/ratrace
cp $R/src/core/{events,rng}.js src/core/ ; cp $R/src/ui/font.js src/ui/
cp -r $R/src/art $R/src/render $R/src/audio $R/src/core/input.js $R/src/core/settings.js \
      $R/src/ui/{hud,screens,menus}.js $R/src/main.js $R/src/core/defs.js ref/ratrace/
cp $R/tools/{build-web,art-sheet,sfx-wav,botplay}.mjs tools/
cp -r $R/docs/site ref/ratrace/site
```

4.3 **Write the frozen contract** (orchestrator-owned; agents may not edit): `src/core/defs.js` (W/H, `FACTIONS`, `TUNING`, `DIFFICULTY`, `PERSONALITIES`, `SPRITES`, `SFX`, `MUSIC`, `EVENTS`, `FX_TYPES`, `TAUNTS`) and `ARCHITECTURE.md` (sections: vision, canonical data, ownership table, sim API, events, levels and AI, art API, render API, audio API, UI/controls, QA). Both are committed; reuse them as is.

4.4 **Write the swarm manifest** `docs/swarm/SWARM.md` (committed): `@meta`, the 12-rule `@preamble` from the scaffold (tracker reporting, ownership, checkpoints, 8-line final replies), then one `## id | model | phase | role | Name` block per agent with an `owns:` line and a task paragraph (table in section 5).

```sh
# 4.5 plan, dashboard, browser
npm run plan                                   # prompts -> docs/swarm/prompts/, .tracker/plan.json
(TRACKER_ROOT=$PWD TRACKER_PORT=4790 nohup node tools/swarm-tracker/dashboard/server.mjs \
   > /datanapps/claude-tmp/tracker.log 2>&1 &)
xdg-open http://127.0.0.1:4790/
TRACKER_ROOT=$PWD node tools/swarm-tracker/bin/swarm-next.mjs --cap 5   # what to launch under the 5-agent cap
```

4.6 **Launch agents** with the Agent tool, `model: "sonnet"`, `run_in_background: true`, prompt exactly: `Read <root>/docs/swarm/prompts/<id>.md and execute it exactly.` Launch up to 5 at once; re-run `swarm-next` as agents finish.

## 5. The swarm (11 agents)

| Phase | Agent id | Owns | One-line task |
|---|---|---|---|
| p2 | `sim-core` | `src/sim/{game,spatial}.js`, test | Planets, queued launches, ships, spatial-grid combat, capture, levelup, win/lose, all events, determinism |
| p2 | `levels` | `src/sim/levels.js`, test | 15 campaign levels, `generateLevel`, `validateLevel` |
| p2 | `sim-ai` | `src/sim/{ai,autopilot}.js`, test | 5 AI personalities, autopilot, must beat a do-nothing player in < 4 min |
| p2 | `art-vector` | `src/art/vector.js`, test, `tools/art-sheet.mjs` | Sprites, `drawPlanet` (cheese wheel), ships, logo, Colby portrait |
| p2 | `render` | `src/render/*`, test | Batched ship drawing, particles, parallax background, CRT, `toLogical` |
| p2 | `audio` | `src/audio/*`, test | Synth SFX + 5 loopable tracks, voice-limited `hit` |
| p3 | `ui-shell` | `index.html`, `style.css`, `src/main.js`, `src/core/{input,settings}.js`, `src/ui/{hud,screens,menus}.js` | Fixed-step loop, swipe-select input, title/levels/play/pause/options/result screens |
| p3 | `qa-bot` | `tools/botplay.mjs`, `docs/BALANCE.md` | Autopilot vs AI over all levels x difficulties; balance report |
| p3 | `logo-icons` | `docs/site/{img,logo}/**`, `tools/make-icons.mjs`, favicon, icons | Wordmark, mark, favicon, 192/512 icons, og and hero images |
| p4 | `docs-site` | `README.md`, `docs/*.md`, `docs/site/**`, `.github/workflows/pages.yml` | Full docs with ASCII and Mermaid diagrams, Pages site, Pages workflow |
| p5 | `integrate-qa` | `docs/LEARNINGS.md` | Run every gate, strict screenshots, log learnings |

Observed schedule: wave 1 (`sim-core`, `levels`, `sim-ai`, `art-vector`, `render`) at T+0; `audio` and `ui-shell` as slots freed; `logo-icons`, `qa-bot` next; `docs-site` only after `ui-shell` landed (needs real screenshots); `integrate-qa` last. See [BUILD-TIMELINE.md](BUILD-TIMELINE.md).

## 6. Follow-up passes (not in the tracker)

1. **Balance** (agent resumed after `qa-bot` report). Findings: L12 unwinnable, L4/L6/L9/L14 under 50% on normal, `nine` difficulty a cliff, per-AI pinned difficulty overrides the menu choice. Orchestrator set `nine.aiRate` 2.4 to 2.0 in `defs.js`; fix agent (sonnet, owns `levels.js` + `game.js` for this task) tuned L4/L6/L9/L12/L14 and made an explicit `difficulty` override pins. That broke L2/L3 (they relied on kitten pins), so it was resumed to retune L2/L3 start units. Targets on normal with the autopilot: L2 80-100%, L3 60-90%, mid levels 40-80%, L14 20-50%. Details: [BALANCE.md](BALANCE.md).
2. **Cheese-wheel art polish** (`art-vector` resumed): planets read as grey moons, so make the face saturated yellow, rind in faction colour with glow, dark Swiss holes with light lips, cream wedge line, dark-brown count with cream outline. The dim round object at the top left of play screens is the decorative background moon, not a planet.
3. **Naming cleanup** (orchestrator): the copied build tool still wrote `omega-ratrace.html`; renamed to `dist/colbauralux.html` in `tools/build-web.mjs`, `tools/smoke_web.sh`, `README.md`, `docs/BUILD.md`, `.github/workflows/pages.yml`; deleted the stale `dist/`.
4. **Win-screen stars** (orchestrator): the frozen pixel font has no star glyph, so `stars()` in `src/ui/screens.js` drew `*`. Replaced with canvas-path five-point stars (filled gold with glow when earned, dim outline when not). Verify: `node tools/shot.mjs --url "/index.html?autostart=1&level=5&seed=1" --out out/shots/win-stars.png --wait 1500 --strict --eval "(async()=>{const g=window.__colbauralux.game;g.planets.forEach(p=>{p.owner=1;p.units=5});g.ships.length=0;await new Promise(r=>setTimeout(r,3500));return g.state})()"` shows 3 gold stars and state `won`.

## 7. Verification gates (all must be green before commit)

```sh
npm test                        # node:test, 63 tests across sim, levels, ai, art, render, audio, ui, qa-bot
node tools/check-imports.mjs    # every import resolves and is exported (catches contract drift)
bash tools/smoke_web.sh         # builds dist/colbauralux.html and loads it headless, no console errors
node tools/shot.mjs --url "/index.html?autostart=1&level=5&bot=1&seed=1" --out out/shots/level5.png --wait 20000 --strict
node tools/botplay.mjs --seeds 1-10     # balance matrix; flags are advisory, no NaN or timeouts allowed
```

Never weaken a gate to get green. Check the repo for leftover template names before committing: `grep -rn "omega-ratrace" . --include='*' -l | grep -v '^./ref'` must list nothing outside `ref/` and `docs/swarm`.

## 8. Ship steps

```sh
git branch -M main && git add -A
git commit -F msg.txt          # end the message with: Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
gh repo create bsommers/colbauralux --private --source=. --remote=origin --push
# only after the user says so:
gh repo edit bsommers/colbauralux --visibility public --accept-visibility-change-consequences
gh api -X POST repos/bsommers/colbauralux/pages -f build_type=workflow
gh repo edit bsommers/colbauralux --homepage https://bsommers.github.io/colbauralux/ --description "..."
gh run watch <run-id> --exit-status      # Pages workflow: tests, build, site at root, game at /play/
```

Private repo first, public and Pages only on explicit approval (Pages on a private repo needs a paid plan). `.gitignore` excludes `out/`, `dist/`, `.tracker/`, `docs/swarm/prompts/`, `docs/swarm/progress/`, `docs/CHECKPOINT.md`; the tracker data worth keeping is snapshotted into `docs/swarm/tracker/` by `node tools/build-timeline.mjs --refresh`, which also regenerates [BUILD-TIMELINE.md](BUILD-TIMELINE.md) and the Gantt chart in the README.

## 9. Pitfalls and rules learned

- Run `check-imports` after every parallel wave; contracts drift on export names.
- Agents must code against the contract with fallbacks (guarded dynamic imports) because sibling modules land at different times; `game.js` loads `ai.js`, `main.js` loads `audio.js`, `render` falls back when art functions are missing.
- Keep the frozen set small (`defs.js`, `events.js`, `rng.js`, `font.js`, `ARCHITECTURE.md`) and own it as the orchestrator; ask-for-change goes through the agent's report "Requests".
- Hand a follow-up to the same agent with `SendMessage` (it keeps context) rather than spawning a new one.
- Balance with the bot: the autopilot is the same code as the opponents, so its win rate is a lower bound for a human.
- A tool hook blocks Bash commands whose text matches secret-file patterns (even inside a grep); keep such patterns out of commands.
- Time is measured from the session transcript start (tracker covers only the swarm). Reproducing took 11m 42s from request to a live public site.

## 10. Resulting artifacts

Repo https://github.com/bsommers/colbauralux · site https://bsommers.github.io/colbauralux/ · game `/play/` (`?autostart=1&level=5`, `?bot=1`, `?seed=N`, `?debug=1`). Docs: [How to play](HOW-TO-PLAY.md), [Architecture overview](ARCH-OVERVIEW.md), [Build and deploy](BUILD.md), [How it was made](HOW-IT-WAS-MADE.md), [Build timeline](BUILD-TIMELINE.md), [Balance](BALANCE.md), [Learnings](LEARNINGS.md).
