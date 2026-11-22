// HUD: score, hi, lives, bombs, wave, combo, banner, popups, taunt bubble, death-rat warning. Logical 800x450 coordinates.
import { W, H, PALETTE, TUNING } from '../core/defs.js';
import { drawText, measureText } from './font.js';
import { drawSprite } from '../art/vector.js';

const pad = (n, w = 7) => String(Math.max(0, Math.floor(n || 0))).padStart(w, '0');

/** createHud(bus) -> { update(dt), draw(ctx, game, t), reset() }. Subscribes to banner/popup/taunt/wave/combo/score events. */
export function createHud(bus) {
  const st = { banner: null, popups: [], taunt: null, scoreBump: 0, comboFlash: 0 };
  const offs = [];
  if (bus) {
    offs.push(bus.on('banner', (e) => { if (e) st.banner = { text: String(e.text ?? ''), sub: e.sub ? String(e.sub) : '', dur: e.dur || 2, t: 0 }; }));
    offs.push(bus.on('popup', (e) => { if (e) { st.popups.push({ text: String(e.text), x: e.x, y: e.y, color: e.color || PALETTE.text, t: 0 }); if (st.popups.length > 24) st.popups.shift(); } }));
    offs.push(bus.on('taunt', (e) => { if (e) st.taunt = { text: String(e.text), dur: e.dur || 2.5, t: 0 }; }));
    offs.push(bus.on('score', () => { st.scoreBump = 0.25; }));
    offs.push(bus.on('combo', (e) => { if (e && e.mult > 1) st.comboFlash = 0.3; }));
  }
  function update(dt) {
    if (st.banner && (st.banner.t += dt) > st.banner.dur) st.banner = null;
    if (st.taunt && (st.taunt.t += dt) > st.taunt.dur) st.taunt = null;
    for (const p of st.popups) p.t += dt;
    st.popups = st.popups.filter((p) => p.t < 1.0);
    st.scoreBump = Math.max(0, st.scoreBump - dt); st.comboFlash = Math.max(0, st.comboFlash - dt);
  }
  function reset() { st.banner = null; st.popups = []; st.taunt = null; }
  function draw(ctx, game, t = 0, o = {}) { drawHud(ctx, game, t, st, o); }
  return { update, draw, reset, state: st, dispose() { offs.forEach((f) => f && f()); } };
}

export function drawHud(ctx, game, t = 0, st = {}, o = {}) {
  if (!game) return;
  const vic = !!o.vic, quiet = !!o.quiet; // vic: 232x130 target needs big text; quiet: paused/options hide transient overlays
  ctx.save();
  const bump = st.scoreBump > 0 ? 1 : 0;
  const big = vic ? 7 : 2;
  drawText(ctx, pad(game.score), 12, 8, { scale: big, color: bump ? '#ffffff' : PALETTE.text });
  if (!vic) drawText(ctx, 'HI ' + pad(Math.max(game.hiscore || 0, game.score || 0)), W / 2, 8, { scale: 1, color: PALETTE.dim, align: 'center' });
  drawText(ctx, 'WAVE ' + (game.wave || 1), W - 12, 8, { scale: big, color: PALETTE.wall, align: 'right' });
  // lives (Colby icons) under score
  const lives = Math.max(0, game.lives || 0);
  for (let i = 0; i < Math.min(lives, 9); i++) drawSprite(ctx, 'colby_icon', (vic ? 30 : 20) + i * (vic ? 40 : 20), vic ? 90 : 36, -Math.PI / 2, vic ? 1.6 : 0.8, { t });
  // hull bar: cheese-wedge pips right of the lives
  const hm = Math.max(1, game.hullMax || 0), hl = Math.max(0, game.hull ?? hm);
  if (game.hullMax) {
    const pw = vic ? Math.min(26, Math.floor(330 / hm) - 3) : 9, ph = vic ? 22 : 9, gap = vic ? 3 : 2;
    const x0 = vic ? 12 : 12 + Math.min(lives, 9) * 20 + 14, y0 = vic ? 128 : 32;
    const warn = hl === 1 && Math.floor(t * 5) % 2 === 0;
    for (let i = 0; i < hm; i++) {
      const x = x0 + i * (pw + gap), on = i < hl;
      ctx.beginPath(); ctx.moveTo(x, y0 + ph); ctx.lineTo(x + pw, y0 + ph); ctx.lineTo(x + pw, y0 + 2); ctx.closePath();
      if (on) { ctx.fillStyle = hl === 1 ? (warn ? '#ff2d55' : '#ff8a8a') : PALETTE.cheese; ctx.fill(); }
      ctx.strokeStyle = on ? '#fff3cf' : PALETTE.dim; ctx.lineWidth = vic ? 2 : 1; ctx.stroke();
    }
  }
  // bombs (yarn icons) under wave
  const bombs = Math.max(0, game.bombs || 0);
  for (let i = 0; i < Math.min(bombs, 5); i++) drawSprite(ctx, 'yarn', W - (vic ? 30 : 20) - i * (vic ? 40 : 20), vic ? 90 : 36, 0, vic ? 1.6 : 0.8, vic ? { t, color: '#ffe14d', glow: false } : { t });
  // combo
  if ((game.comboMult || 1) > 1 && game.combo > 0) {
    const s = 2 + (st.comboFlash > 0 ? 1 : 0);
    drawText(ctx, `COMBO x${game.comboMult}`, W / 2, H - 22, { scale: s, color: PALETTE.cheese, align: 'center' });
  }
  // popups
  for (const p of quiet ? [] : st.popups || []) {
    ctx.globalAlpha = Math.max(0, 1 - p.t);
    drawText(ctx, p.text, p.x, p.y - p.t * 30, { scale: 1, color: p.color, align: 'center' });
  }
  ctx.globalAlpha = 1;
  // death rat warning
  const dra = TUNING.deathRatAfter;
  const hunting = (game.ents || []).some((e) => e.kind === 'deathrat' && !e.dead);
  if (game.state === 'play' && (hunting || (game.waveT || 0) > dra - 4 && (game.waveT || 0) < dra)) {
    if (Math.floor(t * 4) % 2 === 0) drawText(ctx, hunting ? '!! DEATH RAT !!' : 'DEATH RAT INCOMING', W / 2, H - 44, { scale: 2, color: PALETTE.death, align: 'center' });
  }
  // banner
  const b = quiet ? null : st.banner;
  if (b) {
    const k = Math.min(1, b.t / 0.25, (b.dur - b.t) / 0.3 + 0.001);
    ctx.globalAlpha = Math.max(0, Math.min(1, k));
    drawText(ctx, b.text, W / 2, 90 - (1 - Math.min(1, k)) * 10, { scale: vic ? Math.max(2, Math.min(8, Math.floor((W - 24) / measureText(b.text, 1)))) : measureText(b.text, 4) > W - 40 ? 3 : 4, color: PALETTE.cheese, align: 'center' });
    if (b.sub) drawText(ctx, b.sub, W / 2, 128, { scale: 2, color: PALETTE.text, align: 'center' });
    ctx.globalAlpha = 1;
  }
  // taunt speech bubble
  const ta = quiet ? null : st.taunt;
  if (ta) {
    const w = measureText(ta.text, 1).w ?? measureText(ta.text, 1);
    const tw = (typeof w === 'number' ? w : ta.text.length * 6) + 16, bx = W / 2 - tw / 2, by = H - 78;
    ctx.globalAlpha = Math.min(1, (ta.dur - ta.t) / 0.3 + 0.001);
    ctx.fillStyle = 'rgba(5,3,15,0.85)'; ctx.strokeStyle = PALETTE.cream; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(bx, by, tw, 20); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 - 5, by + 20); ctx.lineTo(W / 2, by + 28); ctx.lineTo(W / 2 + 5, by + 20); ctx.fill(); ctx.stroke();
    drawText(ctx, ta.text, W / 2, by + 7, { scale: 1, color: PALETTE.cream, align: 'center' });
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
