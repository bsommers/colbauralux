// Screen state machine: title / play / pause / options / initials / gameover. Node-importable (drawing needs a ctx only).
// createScreens({ settings, hi, bus, cb }) -> { mode, action(a), update(dt), draw(ctx, t), onGameOver(score), toTitle(), ... }
// cb: { start(), quit(), setPaused(bool), applySettings(settings), saveHi(list), fullscreen() }
import { W, H, PALETTE, DIFFICULTY } from '../core/defs.js';
import { hiRank, insertHi } from '../core/settings.js';
import { drawText } from './font.js';
import { createMenu, menuAction, drawMenu } from './menus.js';
import { drawColbyPortrait, drawLogo } from '../art/vector.js';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const pct = (v) => Math.round(v * 100) + '%';

export function createScreens({ settings, hi, bus, cb = {} } = {}) {
  const S = { mode: 'title', prev: 'title', settings, hi, t: 0, modeT: 0, pending: null, letters: [0, 0, 0], cursor: 0, lastName: null };
  const sfx = (name) => bus && bus.emit('sfx', { name });
  const music = (name) => bus && bus.emit('music', { name });
  const apply = () => cb.applySettings && cb.applySettings(S.settings);
  const step = (key, d) => { S.settings[key] = Math.round(Math.min(1, Math.max(0, S.settings[key] + d * 0.1)) * 10) / 10; apply(); };
  const toggle = (key) => { S.settings[key] = !S.settings[key]; apply(); };

  const pauseMenu = createMenu([
    { label: 'RESUME', act: () => S.resume() },
    { label: 'OPTIONS', act: () => S.setMode('options') },
    { label: 'QUIT', act: () => S.quitToTitle() },
  ]);
  const diff = () => DIFFICULTY.find((d) => d.id === S.settings.difficulty) ?? DIFFICULTY[1];
  const diffText = () => `${diff().label} (${diff().hull} HITS)`;
  const cycleDiff = (d) => {
    const i = DIFFICULTY.indexOf(diff());
    S.settings.difficulty = DIFFICULTY[(i + d + DIFFICULTY.length) % DIFFICULTY.length].id; apply();
  };
  S.difficultyText = diffText;
  const optMenu = createMenu([
    { label: 'MASTER', value: () => pct(S.settings.master), adjust: (d) => step('master', d) },
    { label: 'SFX', value: () => pct(S.settings.sfx), adjust: (d) => step('sfx', d) },
    { label: 'MUSIC', value: () => pct(S.settings.music), adjust: (d) => step('music', d) },
    { label: 'CRT', value: () => (S.settings.crt ? 'ON' : 'OFF'), adjust: () => toggle('crt') },
    { label: 'AUTOFIRE', value: () => (S.settings.autofire ? 'ON' : 'OFF'), adjust: () => toggle('autofire') },
    { label: 'MUTE', value: () => (S.settings.mute ? 'ON' : 'OFF'), adjust: () => toggle('mute') },
    { label: 'VIC-20 MODE', value: () => (S.settings.vic ? 'ON' : 'OFF'), adjust: () => toggle('vic') },
    { label: 'DIFFICULTY', value: diffText, adjust: (d) => cycleDiff(d) },
    { label: 'FULLSCREEN', act: () => cb.fullscreen && cb.fullscreen() },
    { label: 'BACK', act: () => S.back() },
  ]);

  S.setMode = (m) => {
    if (m === 'options') S.prev = S.mode === 'options' ? S.prev : S.mode;
    S.mode = m; S.modeT = 0;
    if (m === 'pause') pauseMenu.sel = 0;
    if (m === 'options') optMenu.sel = 0;
  };
  S.back = () => { if (S.mode === 'options') { cb.applySettings && cb.applySettings(S.settings, true); S.mode = S.prev; S.modeT = 0; } };
  S.resume = () => { S.mode = 'play'; S.modeT = 0; cb.setPaused && cb.setPaused(false); };
  S.pauseGame = () => { if (S.mode === 'play') { S.setMode('pause'); cb.setPaused && cb.setPaused(true); } };
  S.quitToTitle = () => { cb.setPaused && cb.setPaused(false); S.toTitle(); cb.quit && cb.quit(); };
  S.toTitle = () => { S.mode = 'title'; S.modeT = 0; music('title'); };
  S.startGame = () => { S.mode = 'play'; S.modeT = 0; cb.start && cb.start(); };
  S.onGameOver = (score) => {
    const rank = hiRank(S.hi, score);
    S.pending = { score, rank };
    S.letters = [0, 0, 0]; S.cursor = 0;
    if (rank >= 0) { S.setMode('initials'); music('hiscore'); sfx('hiscore'); } else { S.setMode('gameover'); music('gameover'); sfx('gameover'); }
  };
  S.confirmInitials = () => {
    const name = S.letters.map((i) => ALPHA[i]).join('');
    S.hi = insertHi(S.hi, name, S.pending.score); S.lastName = name;
    cb.saveHi && cb.saveHi(S.hi);
    S.setMode('gameover'); music('gameover');
  };

  S.action = (a) => {
    const ch = a && typeof a === 'object' ? a.char : null;
    switch (S.mode) {
      case 'title':
        if (a === 'select') { sfx('menu_select'); S.startGame(); } else if (ch === 'O') { sfx('menu_select'); S.setMode('options'); }
        break;
      case 'play':
        if (a === 'pause') S.pauseGame();
        else if (ch === 'O') { S.pauseGame(); S.setMode('options'); }
        break;
      case 'pause': case 'options': {
        const m = S.mode === 'pause' ? pauseMenu : optMenu;
        if (a === 'pause' || a === 'back') { sfx('menu_select'); if (S.mode === 'pause') S.resume(); else S.back(); break; }
        if (ch === 'O' && S.mode === 'pause') { sfx('menu_select'); S.setMode('options'); break; }
        const r = menuAction(m, a);
        if (r) sfx(r === 'select' ? 'menu_select' : 'menu_move');
        break;
      }
      case 'initials': {
        const L = S.letters;
        if (a === 'up') { L[S.cursor] = (L[S.cursor] + 1) % ALPHA.length; sfx('menu_move'); }
        else if (a === 'down') { L[S.cursor] = (L[S.cursor] + ALPHA.length - 1) % ALPHA.length; sfx('menu_move'); }
        else if (a === 'left' || a === 'backspace') { S.cursor = Math.max(0, S.cursor - 1); sfx('menu_move'); }
        else if (a === 'right') { S.cursor = Math.min(2, S.cursor + 1); sfx('menu_move'); }
        else if (a === 'select') { sfx('menu_select'); if (S.cursor >= 2) S.confirmInitials(); else S.cursor++; }
        else if (ch && ALPHA.includes(ch)) { L[S.cursor] = ALPHA.indexOf(ch); sfx('menu_move'); if (S.cursor >= 2) S.cursor = 2; else S.cursor++; }
        break;
      }
      case 'gameover':
        if ((a === 'select' || a === 'pause') && S.modeT > 1.0) { sfx('menu_select'); S.toTitle(); cb.quit && cb.quit(); }
        break;
      default:
    }
  };

  S.update = (dt) => { S.t += dt; S.modeT += dt; };

  function hiTable(ctx, x, y, hl, t) {
    drawText(ctx, 'HI-SCORES', x, y, { scale: 2, color: PALETTE.cheese, align: 'center' });
    S.hi.forEach((e, i) => {
      const mine = hl && S.lastName === e.name && S.pending && e.score === Math.floor(S.pending.score);
      const col = mine && Math.floor(t * 4) % 2 === 0 ? '#ffffff' : i === 0 ? PALETTE.orange : PALETTE.text;
      drawText(ctx, `${String(i + 1).padStart(2)} ${e.name} ${String(e.score).padStart(7)}`, x, y + 22 + i * 12, { scale: 1, color: col, align: 'center' });
    });
  }
  function shade(ctx, a) { ctx.save(); ctx.fillStyle = `rgba(5,3,15,${a})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }

  S.draw = (ctx, t = S.t) => {
    ctx.save();
    switch (S.mode) {
      case 'title': {
        shade(ctx, 0.45);
        drawLogo(ctx, W / 2, 24, t);
        drawColbyPortrait(ctx, 150, 250, 1, t);
        hiTable(ctx, 640, 150, false, t);
        drawText(ctx, 'DIFFICULTY: ' + diffText(), W / 2, 352, { scale: 1, color: PALETTE.wall, align: 'center' });
        if (Math.floor(t * 2.5) % 2 === 0) drawText(ctx, 'PRESS FIRE', W / 2, 380, { scale: 3, color: PALETTE.cheese, align: 'center' });
        drawText(ctx, 'ARROWS/WASD MOVE  SPACE FIRE  X BOMB  P PAUSE  O OPTIONS', W / 2, 420, { scale: 1, color: PALETTE.dim, align: 'center' });
        break;
      }
      case 'pause': case 'options': {
        shade(ctx, 0.7);
        drawText(ctx, S.mode === 'pause' ? 'PAUSED' : 'OPTIONS', W / 2, 60, { scale: 4, color: PALETTE.cheese, align: 'center' });
        drawMenu(ctx, S.mode === 'pause' ? pauseMenu : optMenu, W / 2, S.mode === 'pause' ? 170 : 120, t, { gap: S.mode === 'pause' ? 30 : 26 });
        break;
      }
      case 'initials': {
        shade(ctx, 0.75);
        drawText(ctx, 'NEW HIGH SCORE!', W / 2, 60, { scale: 4, color: PALETTE.cheese, align: 'center' });
        drawText(ctx, String(Math.floor(S.pending.score)), W / 2, 110, { scale: 3, color: PALETTE.text, align: 'center' });
        drawText(ctx, 'ENTER YOUR INITIALS', W / 2, 160, { scale: 2, color: PALETTE.dim, align: 'center' });
        for (let i = 0; i < 3; i++) {
          const x = W / 2 + (i - 1) * 60, on = i === S.cursor;
          drawText(ctx, ALPHA[S.letters[i]], x, 210, { scale: 6, color: on ? PALETTE.cheese : PALETTE.text, align: 'center' });
          if (on && Math.floor(t * 3) % 2 === 0) { ctx.fillStyle = PALETTE.cheese; ctx.fillRect(x - 16, 256, 32, 3); }
        }
        drawText(ctx, 'UP/DOWN LETTER  LEFT/RIGHT MOVE  FIRE OK', W / 2, 300, { scale: 1, color: PALETTE.dim, align: 'center' });
        break;
      }
      case 'gameover': {
        shade(ctx, 0.75);
        drawText(ctx, 'GAME OVER', W / 2, 40, { scale: 5, color: PALETTE.death, align: 'center' });
        drawText(ctx, 'SCORE ' + String(Math.floor(S.pending ? S.pending.score : 0)), W / 2, 90, { scale: 2, color: PALETTE.text, align: 'center' });
        hiTable(ctx, W / 2, 140, true, t);
        if (S.modeT > 1 && Math.floor(t * 2.5) % 2 === 0) drawText(ctx, 'PRESS FIRE', W / 2, 400, { scale: 2, color: PALETTE.cheese, align: 'center' });
        break;
      }
      default:
    }
    ctx.restore();
  };
  return S;
}
