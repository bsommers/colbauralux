// HUD: faction share bar, level name, send% selector, speed/pause buttons, banner/popups/taunt. Logical 960x540.
import { W, H, PALETTE, FACTIONS, TUNING } from '../core/defs.js';
import { drawText, measureText } from './font.js';

const BAR = { x: 300, y: 14, w: 360, h: 10 };
const pctBtn = (i) => ({ x: 12 + i * 52, y: H - 34, w: 46, h: 22 });
const SPEED_BTN = { x: W - 112, y: H - 34, w: 48, h: 22 };
const PAUSE_BTN = { x: W - 58, y: H - 34, w: 46, h: 22 };
const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Pure: HUD button under (x,y) -> { sendPct } | 'speed' | 'pause' | null. */
export function hudHit(x, y) {
  for (let i = 0; i < TUNING.sendPct.length; i++) if (inside(pctBtn(i), x, y)) return { sendPct: TUNING.sendPct[i] };
  if (inside(SPEED_BTN, x, y)) return 'speed';
  if (inside(PAUSE_BTN, x, y)) return 'pause';
  return null;
}

/** Pure: planets per owner -> [{owner, n}] ordered neutral last. */
export function shares(game) {
  const c = new Map();
  for (const p of (game && game.planets) || []) c.set(p.owner, (c.get(p.owner) || 0) + 1);
  return [...c.entries()].filter(([o]) => o > 0).sort((a, b) => a[0] - b[0]).concat(c.has(0) ? [[0, c.get(0)]] : []).map(([owner, n]) => ({ owner, n }));
}

/** createHud(bus) -> { update(dt), draw(ctx, game, t, o), reset(), hudHit, state, dispose() }. */
export function createHud(bus) {
  const st = { banner: null, popups: [], taunt: null };
  const offs = [];
  if (bus) {
    offs.push(bus.on('banner', (e) => { if (e) st.banner = { text: String(e.text ?? ''), sub: e.sub ? String(e.sub) : '', dur: e.dur || 2, t: 0 }; }));
    offs.push(bus.on('popup', (e) => { if (e) { st.popups.push({ text: String(e.text), x: e.x, y: e.y, color: e.color || PALETTE.text, t: 0 }); if (st.popups.length > 24) st.popups.shift(); } }));
    offs.push(bus.on('taunt', (e) => { if (e) st.taunt = { text: String(e.text), dur: e.dur || 2.5, t: 0, owner: e.owner ?? 2 }; }));
  }
  function update(dt) {
    if (st.banner && (st.banner.t += dt) > st.banner.dur) st.banner = null;
    if (st.taunt && (st.taunt.t += dt) > st.taunt.dur) st.taunt = null;
    for (const p of st.popups) p.t += dt;
    st.popups = st.popups.filter((p) => p.t < 1.2);
  }
  function reset() { st.banner = null; st.popups = []; st.taunt = null; }
  return { update, reset, hudHit, state: st, draw: (ctx, game, t = 0, o = {}) => drawHud(ctx, game, t, st, o), dispose() { offs.forEach((f) => f && f()); } };
}

function button(ctx, r, label, on, color = PALETTE.cheese) {
  ctx.fillStyle = on ? 'rgba(255,210,74,0.25)' : 'rgba(5,3,15,0.6)';
  ctx.strokeStyle = on ? color : PALETTE.dim; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.fill(); ctx.stroke();
  drawText(ctx, label, r.x + r.w / 2, r.y + 7, { scale: 1, color: on ? color : PALETTE.dim, align: 'center' });
}

export function drawHud(ctx, game, t = 0, st = {}, o = {}) {
  if (!game) return;
  ctx.save();
  const quiet = !!o.quiet;
  // level name + time
  const name = game.level && game.level.name ? game.level.name.toUpperCase() : '';
  drawText(ctx, name, 12, 10, { scale: 2, color: PALETTE.cheese });
  const tm = Math.floor(game.t || 0);
  drawText(ctx, `${Math.floor(tm / 60)}:${String(tm % 60).padStart(2, '0')}`, 12, 30, { scale: 1, color: PALETTE.dim });
  // share bar
  const sh = shares(game), total = sh.reduce((a, s) => a + s.n, 0) || 1;
  ctx.fillStyle = 'rgba(5,3,15,0.7)'; ctx.fillRect(BAR.x - 2, BAR.y - 2, BAR.w + 4, BAR.h + 4);
  let x = BAR.x;
  for (const s of sh) {
    const w = BAR.w * s.n / total;
    ctx.fillStyle = s.owner ? FACTIONS[s.owner].color : '#5a5a70'; ctx.globalAlpha = s.owner ? 1 : 0.55;
    ctx.fillRect(x, BAR.y, Math.max(1, w - 1), BAR.h); x += w;
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PALETTE.dim; ctx.lineWidth = 1; ctx.strokeRect(BAR.x - 2, BAR.y - 2, BAR.w + 4, BAR.h + 4);
  const mine = sh.find((s) => s.owner === 1);
  drawText(ctx, `${mine ? mine.n : 0}/${total} WHEELS`, BAR.x + BAR.w / 2, BAR.y + 18, { scale: 1, color: PALETTE.text, align: 'center' });
  // send % selector
  const cur = o.sendPct ?? game.sendPct;
  TUNING.sendPct.forEach((p, i) => button(ctx, pctBtn(i), Math.round(p * 100) + '%', Math.abs(p - cur) < 1e-6));
  button(ctx, SPEED_BTN, 'X' + (o.speed || 1), (o.speed || 1) > 1);
  button(ctx, PAUSE_BTN, 'II', !!o.paused, PALETTE.good);
  if (o.selected) drawText(ctx, `${o.selected} SELECTED`, 12 + 4 * 52 + 6, H - 27, { scale: 1, color: PALETTE.arrow });
  // popups (world coords)
  for (const p of quiet ? [] : st.popups || []) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / 1.2);
    drawText(ctx, p.text, p.x, p.y - p.t * 28, { scale: 1, color: p.color, align: 'center' });
  }
  ctx.globalAlpha = 1;
  const b = quiet ? null : st.banner;
  if (b) {
    const k = Math.max(0, Math.min(1, b.t / 0.25, (b.dur - b.t) / 0.3));
    ctx.globalAlpha = k;
    const sc = measureText(b.text, 4) > W - 40 ? 3 : 4;
    drawText(ctx, b.text, W / 2, 70 - (1 - k) * 10, { scale: sc, color: PALETTE.cheese, align: 'center' });
    if (b.sub) drawText(ctx, b.sub, W / 2, 70 + sc * 9 + 6, { scale: 2, color: PALETTE.text, align: 'center' });
    ctx.globalAlpha = 1;
  }
  const ta = quiet ? null : st.taunt;
  if (ta) {
    const tw = measureText(ta.text, 1) + 20, bx = W / 2 - tw / 2, by = H - 74;
    ctx.globalAlpha = Math.max(0, Math.min(1, (ta.dur - ta.t) / 0.3));
    ctx.fillStyle = 'rgba(5,3,15,0.85)'; ctx.strokeStyle = FACTIONS[ta.owner]?.color || PALETTE.cream; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(bx, by, tw, 20); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 - 5, by + 20); ctx.lineTo(W / 2, by + 28); ctx.lineTo(W / 2 + 5, by + 20); ctx.fill(); ctx.stroke();
    drawText(ctx, ta.text, W / 2, by + 7, { scale: 1, color: PALETTE.cream, align: 'center' });
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
