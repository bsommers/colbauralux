# ui-shell report

## What I built
- `src/core/settings.js`: settings (master/sfx/music/crt/mute/difficulty/sendPct) + progress (`loadProgress/saveProgress/recordClear/starsFor/isUnlocked`), storage-injectable, Node-safe.
- `src/core/input.js`: pointer swipe-select (own-planet swipe adds passed own planets, release on planet sends via `g.send`, empty cancels, tap-select / tap-send / tap-again deselect, double-tap empty = select all, multi-touch safe, HUD button hit hook, click forwarding when disabled), keyboard (A, Esc, 1-4, Space/P, F, R, N, M, C, V, Enter, arrows).
- `src/ui/{menus,hud,screens}.js`: menus with mouse hit-test; HUD (share bar, level name/time, send% buttons, speed/pause buttons, banner/taunt/popups); screens title/levels/play/pause/options/result (stars, best time, confetti via `fx`).
- `src/main.js`, `index.html`, `style.css`: fixed-step loop with speed steps, URL params (autostart, level, seed, bot, debug), attract demo (autopilot vs AI on generated map), optional audio via dynamic import.

## Verification evidence
- `node --test test/ui-shell.test.mjs`: 14 pass (synthetic pointer events for swipe/tap/multi-touch/double-tap/cancel, keys, settings, progress, menus).
- Screenshots (`--strict`, no console errors): `out/shots/ui-title.png`, `ui-play.png` (bot=1, 60 fps), `ui-win.png`, `ui-levels.png`.
- `tools/check-imports.mjs`: 0 errors.

## Deviations from the contract
- `createInput` returns `{ ui, poll(), onAction(fn), setEnabled(b), clear(), dispose() }`; `poll()` returns the frame state, live `ui` object is passed to renderer. Gamepad not implemented (optional).
- `src/audio/audio.js` did not exist at test time; main.js loads it with dynamic import and runs silent if absent.
- Pause/restart/options reachable by keys; options has an extra SEND % row.

## Mistakes I made and how I fixed them
- Left a nonsense assertion in a test draft; removed it before the first run.

## Learnings for a future agent
- main.js uses top-level await (optional modules); keep `<script type=module>`.
- Menu mouse clicks depend on rects recorded by the last `drawMenu`.
- Level-select unlock honours `?debug=1` / `?level=N` (all unlocked).

## Requests for other modules
- audio: export `createAudio({bus})` with `setVolume`, `setMuted`, `resume` (main calls them guarded).
- Stars in result screen render as `*` glyphs in `ui/font.js` (FROZEN); a star glyph would look better.
