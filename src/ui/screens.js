// Screen state machine: title / levels / play / pause / options / result. Node-importable (drawing needs only a ctx).
// createScreens({ settings, progress, levels, bus, cb }) -> S { mode, action(a), update(dt), draw(ctx,t), onResult(game,won), ... }
// cb: { startLevel(i), startSkirmish(), restart(), quit(), setPaused(bool), applySettings(settings), saveProgress(p), fullscreen() }
import { W, H, PALETTE, DIFFICULTY, FACTIONS } from '../core/defs.js';
import { recordClear, isUnlocked } from '../core/settings.js';
import { drawText, measureText } from './font.js';
import { createMenu, menuAction, menuClick, drawMenu } from './menus.js';
import { drawColbyPortrait, drawLogo } from '../art/vector.js';

const pct = (v) => Math.round(v * 100) + '%';
const COLS = 5;
export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fit = (text, w, scale = 1) => { let t = String(text).toUpperCase(); while (t.length > 1 && measureText(t, scale) > w) t = t.slice(0, -1); return t; };

export function createScreens({ settings, progress, levels = [], bus, cb = {}, unlockAll = false } = {}) {
  const S = { mode: 'title', prev: 'title', settings, progress: progress || { cleared: {} }, levels, t: 0, modeT: 0, result: null, levelIndex: null, cursor: 0, cells: [] };
  const sfx = (name) => bus && bus.emit('sfx', { name });
  const music = (name) => bus && bus.emit('music', { name });
  const apply = () => cb.applySettings && cb.applySettings(S.settings);
  const step = (key, d) => { S.settings[key] = Math.round(Math.min(1, Math.max(0, S.settings[key] + d * 0.1)) * 10) / 10; apply(); };
  const toggle = (key) => { S.settings[key] = !S.settings[key]; apply(); };
  const unlocked = (i) => unlockAll || isUnlocked(S.progress, S.levels, i);

  const titleMenu = createMenu([
    { label: 'PLAY', act: () => S.setMode('levels') },
    { label: 'SKIRMISH', act: () => S.startSkirmish() },
    { label: 'OPTIONS', act: () => S.setMode('options') },
  ]);
  const pauseMenu = createMenu([
    { label: 'RESUME', act: () => S.resume() },
    { label: 'RESTART', act: () => S.restartLevel() },
    { label: 'OPTIONS', act: () => S.setMode('options') },
    { label: 'QUIT', act: () => S.quitToTitle() },
  ]);
  const diff = () => DIFFICULTY.find((d) => d.id === S.settings.difficulty) ?? DIFFICULTY[1];
  const cycleDiff = (d) => { const i = DIFFICULTY.indexOf(diff()); S.settings.difficulty = DIFFICULTY[(i + d + DIFFICULTY.length) % DIFFICULTY.length].id; apply(); };
  const cyclePct = (d) => {
    const L = [0.25, 0.5, 0.75, 1], i = Math.max(0, L.findIndex((v) => Math.abs(v - S.settings.sendPct) < 1e-6));
    S.settings.sendPct = L[(i + d + L.length) % L.length]; apply();
  };
  const optMenu = createMenu([
    { label: 'MASTER', value: () => pct(S.settings.master), adjust: (d) => step('master', d) },
    { label: 'SFX', value: () => pct(S.settings.sfx), adjust: (d) => step('sfx', d) },
    { label: 'MUSIC', value: () => pct(S.settings.music), adjust: (d) => step('music', d) },
    { label: 'CRT', value: () => (S.settings.crt ? 'ON' : 'OFF'), adjust: () => toggle('crt') },
    { label: 'MUTE', value: () => (S.settings.mute ? 'ON' : 'OFF'), adjust: () => toggle('mute') },
    { label: 'DIFFICULTY', value: () => diff().label, adjust: cycleDiff },
    { label: 'SEND', value: () => pct(S.settings.sendPct), adjust: cyclePct },
    { label: 'FULLSCREEN', act: () => cb.fullscreen && cb.fullscreen() },
    { label: 'BACK', act: () => S.back() },
  ]);
  const hasNext = () => S.result && S.result.won && S.levelIndex != null && S.levelIndex + 1 < S.levels.length;
  const resultMenu = createMenu([
    { label: 'NEXT', act: () => S.nextLevel(), disabled: () => !hasNext() },
    { label: 'RETRY', act: () => S.restartLevel() },
    { label: 'MENU', act: () => { S.toTitle(); cb.quit && cb.quit(); } },
  ]);
  const menuFor = () => ({ title: titleMenu, pause: pauseMenu, options: optMenu, result: resultMenu }[S.mode] || null);

  S.setMode = (m) => {
    if (m === 'options') S.prev = S.mode === 'options' ? S.prev : S.mode;
    S.mode = m; S.modeT = 0;
    const mn = menuFor(); if (mn) mn.sel = m === 'result' && !hasNext() ? 1 : 0;
    if (m === 'levels') { const i = S.levelIndex ?? 0; S.cursor = Math.min(i, S.levels.length - 1); }
  };
  S.back = () => { if (S.mode === 'options') { cb.applySettings && cb.applySettings(S.settings, true); S.mode = S.prev; S.modeT = 0; } };
  S.resume = () => { S.mode = 'play'; S.modeT = 0; cb.setPaused && cb.setPaused(false); };
  S.pauseGame = () => { if (S.mode === 'play') { S.setMode('pause'); cb.setPaused && cb.setPaused(true); } };
  S.quitToTitle = () => { cb.setPaused && cb.setPaused(false); S.toTitle(); cb.quit && cb.quit(); };
  S.toTitle = () => { S.mode = 'title'; S.modeT = 0; S.result = null; titleMenu.sel = 0; music('title'); };
  S.startLevel = (i) => {
    if (i < 0 || i >= S.levels.length) return false;
    S.levelIndex = i; S.result = null; S.mode = 'play'; S.modeT = 0; cb.setPaused && cb.setPaused(false); cb.startLevel && cb.startLevel(i); return true;
  };
  S.startSkirmish = () => { S.levelIndex = null; S.result = null; S.mode = 'play'; S.modeT = 0; cb.setPaused && cb.setPaused(false); cb.startSkirmish && cb.startSkirmish(); };
  S.restartLevel = () => { S.result = null; S.mode = 'play'; S.modeT = 0; cb.setPaused && cb.setPaused(false); if (S.levelIndex == null) cb.startSkirmish && cb.startSkirmish(); else cb.startLevel && cb.startLevel(S.levelIndex); };
  S.nextLevel = () => { if (hasNext()) S.startLevel(S.levelIndex + 1); };
  S.onResult = (game, won) => {
    const st = (game && game.stats) || {};
    const time = st.time ?? (game && game.t) ?? 0;
    const r = { won: !!won, time, kills: Object.entries(st.kills || {}).reduce((a, [k, v]) => (Number(k) === 1 ? a : a + v), 0), lost: st.losses || 0, captured: st.captured || 0, stars: 0, best: false, name: game && game.level ? game.level.name : '' };
    if (won && S.levelIndex != null && S.levels[S.levelIndex]) {
      const rc = recordClear(S.progress, S.levels[S.levelIndex], time);
      S.progress = rc.progress; r.stars = rc.stars; r.best = rc.best;
      cb.saveProgress && cb.saveProgress(S.progress);
    } else if (won) r.stars = 0;
    S.result = r; S.setMode('result'); music(won ? 'victory' : 'defeat'); sfx(won ? 'win' : 'lose');
  };

  function gridMove(a) {
    const n = S.levels.length; if (!n) return;
    let c = S.cursor;
    if (a === 'left') c = Math.max(0, c - 1); else if (a === 'right') c = Math.min(n - 1, c + 1);
    else if (a === 'up') c = c - COLS >= 0 ? c - COLS : c; else if (a === 'down') c = c + COLS < n ? c + COLS : c;
    if (c !== S.cursor) { S.cursor = c; sfx('menu_move'); }
  }
  function pickLevel(i) { if (unlocked(i)) { sfx('menu_select'); S.startLevel(i); } else sfx('lost'); }

  S.action = (a) => {
    const click = a && typeof a === 'object' ? a.click : null;
    switch (S.mode) {
      case 'title': case 'pause': case 'options': case 'result': {
        const m = menuFor();
        if (a === 'pause' || a === 'back') {
          if (S.mode === 'pause') { sfx('menu_select'); S.resume(); } else if (S.mode === 'options') { sfx('menu_select'); S.back(); }
          else if (S.mode === 'result') { sfx('menu_select'); S.toTitle(); cb.quit && cb.quit(); }
          break;
        }
        if (S.mode === 'result' && a === 'next') { S.nextLevel(); break; }
        if (S.mode === 'result' && a === 'restart') { S.restartLevel(); break; }
        if (S.mode === 'pause' && a === 'restart') { S.restartLevel(); break; }
        if (S.mode === 'result' && S.modeT < 0.6) break;
        if (click) { if (menuClick(m, click.x, click.y)) sfx('menu_select'); break; }
        const r = menuAction(m, a);
        if (r) sfx(r === 'select' ? 'menu_select' : 'menu_move');
        break;
      }
      case 'levels':
        if (a === 'back' || a === 'pause') { sfx('menu_select'); S.setMode('title'); }
        else if (a === 'select') pickLevel(S.cursor);
        else if (click) { const c = S.cells.find((r) => click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h); if (c) { S.cursor = c.i; pickLevel(c.i); } else if (click.y > H - 36 && click.x < 120) S.setMode('title'); }
        else gridMove(a);
        break;
      case 'play':
        if (a === 'pause' || a === 'back') S.pauseGame();
        else if (a === 'restart') S.restartLevel();
        break;
      default:
    }
  };

  S.update = (dt) => {
    S.t += dt; S.modeT += dt;
    if (S.mode === 'result' && S.result && S.result.won && bus && Math.floor((S.modeT - dt) * 3) !== Math.floor(S.modeT * 3)) {
      bus.emit('fx', { type: 'confetti', x: 100 + Math.random() * (W - 200), y: 60 + Math.random() * 60, opts: { n: 40 } });
    }
  };

  function shade(ctx, a) { ctx.save(); ctx.fillStyle = `rgba(5,3,15,${a})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  function stars(ctx, x, y, n, sc = 1) { drawText(ctx, '*'.repeat(n) + '-'.repeat(3 - n), x, y, { scale: sc, color: n ? PALETTE.cheese : PALETTE.dim, align: 'center' }); }

  S.draw = (ctx, t = S.t) => {
    ctx.save();
    switch (S.mode) {
      case 'title':
        shade(ctx, 0.4);
        drawLogo(ctx, W / 2, 30, t);
        drawColbyPortrait(ctx, 170, 300, 1.4, t);
        drawMenu(ctx, titleMenu, 640, 250, t, { gap: 40, scale: 3 });
        drawText(ctx, 'SWIPE FROM YOUR WHEELS TO SEND KITTENS', W / 2, H - 50, { scale: 1, color: PALETTE.dim, align: 'center' });
        drawText(ctx, 'ENTER SELECT  A ALL  1-4 SEND%  SPACE PAUSE  F SPEED  M MUTE  C CRT', W / 2, H - 34, { scale: 1, color: PALETTE.dim, align: 'center' });
        break;
      case 'levels': {
        shade(ctx, 0.78);
        drawText(ctx, 'CHOOSE A CHEESE', W / 2, 24, { scale: 4, color: PALETTE.cheese, align: 'center' });
        const n = S.levels.length, rows = Math.max(1, Math.ceil(n / COLS)), cw = 170, ch = Math.min(96, Math.floor(340 / rows) - 6), x0 = (W - COLS * (cw + 6)) / 2 + 3, y0 = 80;
        S.cells = [];
        S.levels.forEach((lv, i) => {
          const c = i % COLS, r = Math.floor(i / COLS), x = x0 + c * (cw + 6), y = y0 + r * (ch + 6), un = unlocked(i), cl = S.progress.cleared[lv.id], on = i === S.cursor;
          S.cells.push({ x, y, w: cw, h: ch, i });
          ctx.fillStyle = on ? 'rgba(255,210,74,0.2)' : 'rgba(20,14,40,0.8)'; ctx.strokeStyle = on ? PALETTE.cheese : un ? PALETTE.dim : '#33334a'; ctx.lineWidth = on ? 2 : 1;
          ctx.beginPath(); ctx.rect(x, y, cw, ch); ctx.fill(); ctx.stroke();
          drawText(ctx, String(i + 1), x + 8, y + 8, { scale: 2, color: un ? PALETTE.cheese : '#4a4a66' });
          if (un) {
            drawText(ctx, fit(lv.name, cw - 16), x + 8, y + 30, { scale: 1, color: PALETTE.text });
            if (cl) { stars(ctx, x + cw / 2, y + ch - 28, cl.stars, 2); drawText(ctx, fmtTime(cl.time), x + cw / 2, y + ch - 12, { scale: 1, color: PALETTE.dim, align: 'center' }); }
          } else drawText(ctx, 'LOCKED', x + cw / 2, y + ch / 2 + 4, { scale: 1, color: '#4a4a66', align: 'center' });
        });
        const cur = S.levels[S.cursor];
        if (cur && unlocked(S.cursor)) drawText(ctx, fit(cur.blurb || '', W - 40), W / 2, H - 52, { scale: 1, color: PALETTE.cream, align: 'center' });
        drawText(ctx, 'ARROWS MOVE  ENTER PLAY  ESC BACK', W / 2, H - 30, { scale: 1, color: PALETTE.dim, align: 'center' });
        break;
      }
      case 'pause': case 'options':
        shade(ctx, 0.7);
        drawText(ctx, S.mode === 'pause' ? 'PAUSED' : 'OPTIONS', W / 2, 50, { scale: 5, color: PALETTE.cheese, align: 'center' });
        drawMenu(ctx, S.mode === 'pause' ? pauseMenu : optMenu, W / 2, S.mode === 'pause' ? 170 : 120, t, { gap: S.mode === 'pause' ? 38 : 32 });
        break;
      case 'result': {
        const r = S.result || {};
        shade(ctx, 0.72);
        drawText(ctx, r.won ? 'CHEESE CAPTURED!' : 'THE RATS WIN', W / 2, 50, { scale: 5, color: r.won ? PALETTE.good : PALETTE.bad, align: 'center' });
        drawText(ctx, (r.name || '').toUpperCase(), W / 2, 100, { scale: 2, color: PALETTE.text, align: 'center' });
        if (r.won && r.stars) stars(ctx, W / 2, 130, r.stars, 4);
        const rows = [['TIME', fmtTime(r.time || 0) + (r.best ? '  NEW BEST' : '')], ['RATS ZAPPED', String(r.kills || 0)], ['KITTENS LOST', String(r.lost || 0)], ['WHEELS TAKEN', String(r.captured || 0)]];
        rows.forEach(([k, v], i) => { drawText(ctx, k, W / 2 - 20, 190 + i * 24, { scale: 2, color: PALETTE.dim, align: 'right' }); drawText(ctx, v, W / 2 + 20, 190 + i * 24, { scale: 2, color: PALETTE.text }); });
        drawMenu(ctx, resultMenu, W / 2, 330, t, { gap: 36, scale: 3 });
        break;
      }
      default:
    }
    ctx.restore();
  };
  S.menus = { title: titleMenu, pause: pauseMenu, options: optMenu, result: resultMenu };
  S.FACTIONS = FACTIONS;
  return S;
}
