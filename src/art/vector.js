// Neon-vector art for COLBAURALUX (ARCHITECTURE.md §7). Pure canvas path drawing, no DOM at import.
// Every sprite faces +x at angle 0 and is drawn centred on (x, y). Adapted from ref/ratrace/art/vector.js.
import { PALETTE, SPRITES, FACTIONS, factionOf, TUNING } from '../core/defs.js';
import { drawText } from '../ui/font.js';

const TAU = Math.PI * 2;
const P = { colby: '#ff9b2e', colbyWhite: '#fff3cf', mouse: '#7df9ff', rat: '#c27bff', cmd: '#ff5470', wall: '#ffc933' };
const RADII = { colby: 12, colby_icon: 8, kitten: 5, mouse: 7, rat: 8, commander: 10, cheese: 9, yarn: 8, tuna: 9, paw: 8 };
export function spriteRadius(name) { return RADII[name] ?? 10; }

// ---- helpers -------------------------------------------------------------------------------
function style(ctx, color, w = 1.6, glow = true, blur = 8) {
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = blur; } else ctx.shadowBlur = 0;
}
function poly(ctx, pts, close = true) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
function fillStroke(ctx, pts, fillAlpha, close = true) {
  poly(ctx, pts, close);
  if (fillAlpha > 0) { const a = ctx.globalAlpha; ctx.globalAlpha = a * fillAlpha; ctx.fill(); ctx.globalAlpha = a; }
  ctx.stroke();
}
function circle(ctx, x, y, r, fill = false, fillAlpha = 1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  if (fill) { const a = ctx.globalAlpha; ctx.globalAlpha = a * fillAlpha; ctx.fill(); ctx.globalAlpha = a; } else ctx.stroke();
}
function dot(ctx, x, y, r, color) { const f = ctx.fillStyle; ctx.fillStyle = color; circle(ctx, x, y, r, true); ctx.fillStyle = f; }

// ---- sprites (local space, facing +x) --------------------------------------------------------
function colbyHead(ctx, o, big) {
  const t = o.t || 0, th = Math.max(0, Math.min(1, o.thrust || 0));
  const c = o.tint ? '#ff2a2a' : o.color || P.colby, w = o.tint ? '#ffb4b4' : o.hurt > 0.5 ? '#ffffff' : P.colbyWhite;
  if (th > 0) { // tail = thrust flame behind
    const L = 8 + 14 * th + Math.sin(t * 40) * 2.5 * th;
    style(ctx, '#ffd23f', 1.8, o.glow !== false, 10);
    fillStroke(ctx, [[-8, -4], [-8 - L, Math.sin(t * 37) * 2], [-8, 4]], 0.5);
    style(ctx, '#ff5fa2', 1.2, false);
    poly(ctx, [[-8, -2], [-8 - L * 0.55, 0], [-8, 2]]); ctx.stroke();
  }
  style(ctx, c, 1.9, o.glow !== false, 10);
  // head: wide cheeks, nose forward; ears forward
  const head = [[11, 0], [5, -8], [-3, -9], [-9, -6], [-9, 6], [-3, 9], [5, 8]];
  fillStroke(ctx, head, 0.28);
  // ears (tall, forward-leaning)
  const ear = o.hurt > 0 ? 1 : 0;
  fillStroke(ctx, [[5, -8], [9, -14 + ear], [-1, -9]], 0.5, true);
  fillStroke(ctx, [[5, 8], [9, 14 - ear], [-1, 9]], 0.5, true);
  // cream marbling patches
  style(ctx, w, 1.1, false);
  const a = ctx.globalAlpha; ctx.globalAlpha = a * 0.75;
  poly(ctx, [[-9, -6], [-3, -9], [-1, -3], [-7, -2]]); ctx.fill();
  poly(ctx, [[4, 8], [-2, 9], [-3, 3], [3, 3]]); ctx.fill();
  poly(ctx, [[10, 0], [6, -1.5], [6, 1.5]]); ctx.fill();
  ctx.globalAlpha = a;
  // eyes
  const blink = o.blink ? 0.2 : 1;
  ctx.fillStyle = '#05030f';
  ctx.beginPath(); ctx.ellipse ? ctx.ellipse(2.5, -3.6, 1.7, 1.7 * blink, 0, 0, TAU) : ctx.arc(2.5, -3.6, 1.6, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse ? ctx.ellipse(2.5, 3.6, 1.7, 1.7 * blink, 0, 0, TAU) : ctx.arc(2.5, 3.6, 1.6, 0, TAU); ctx.fill();
  dot(ctx, 3.1, -4.1, 0.55, '#ffffff'); dot(ctx, 3.1, 3.1, 0.55, '#ffffff');
  dot(ctx, 10, 0, 1.1, '#ff5fa2'); // nose
  // whiskers react to thrust (swept back)
  style(ctx, w, 0.9, false);
  const sweep = th * 5;
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    const y0 = s * (1.5 + i * 1.2);
    poly(ctx, [[6, y0], [9 - sweep * 0.4, s * (7 + i * 3.2) + (i ? s * 0 : 0)], [12 - sweep, s * (9 + i * 3.8)]], false);
    ctx.stroke();
  }
}

function colbyIcon(ctx, o) { // small head for lives counter, facing up-right neutral (+x)
  const c = o.color || P.colby;
  style(ctx, c, 1.5, o.glow !== false, 6);
  fillStroke(ctx, [[8, 0], [4, -6], [-2, -7], [-7, -4], [-7, 4], [-2, 7], [4, 6]], 0.3);
  fillStroke(ctx, [[4, -6], [7, -10], [0, -7]], 0.5);
  fillStroke(ctx, [[4, 6], [7, 10], [0, 7]], 0.5);
  dot(ctx, 2, -2.5, 1.1, '#05030f'); dot(ctx, 2, 2.5, 1.1, '#05030f');
  dot(ctx, 7.5, 0, 0.9, '#ff5fa2');
  style(ctx, P.colbyWhite, 1, false);
  poly(ctx, [[-7, -4], [-2, -7], [-1, -2]]); ctx.fill();
}
function mouse(ctx, o) {
  const t = o.t || 0, c = o.color || P.mouse;
  const tail = Math.sin(t * 8) * 3;
  style(ctx, c, 1.6, o.glow !== false, 8);
  poly(ctx, [[-7, 0], [-11, tail * 0.6], [-14, tail]], false); ctx.stroke(); // tail
  circle(ctx, -1, 0, 6.5, true, 0.25); circle(ctx, -1, 0, 6.5); // body
  fillStroke(ctx, [[3, -3], [10, 0], [3, 3]], 0.3); // snout
  circle(ctx, -1, -5.2, 4.2, true, 0.35); circle(ctx, -1, -5.2, 4.2); // big round ears
  circle(ctx, -1, 5.2, 4.2, true, 0.35); circle(ctx, -1, 5.2, 4.2);
  dot(ctx, 1.8, -2.1, 1.1, '#ffffff'); dot(ctx, 1.8, 2.1, 1.1, '#ffffff');
  dot(ctx, 2.2, -2.1, 0.55, '#05030f'); dot(ctx, 2.2, 2.1, 0.55, '#05030f');
  dot(ctx, 10, 0, 1.2, '#ff5fa2');
}

function rat(ctx, o, cmd) {
  const t = o.t || 0, c = o.color || (cmd ? P.cmd : P.rat), k = cmd ? 1.25 : 1;
  ctx.save(); ctx.scale(k, k);
  const tail = Math.sin(t * 7) * 3.5;
  style(ctx, c, 1.7 / k, o.glow !== false, 9);
  poly(ctx, [[-8, 0], [-13, tail], [-17, -tail * 0.5], [-20, tail]], false); ctx.stroke();
  fillStroke(ctx, [[12, 0], [5, -5], [-2, -8], [-9, -5], [-9, 5], [-2, 8], [5, 5]], 0.28); // angular body
  fillStroke(ctx, [[3, -5], [0, -11], [-3, -6]], 0.4); // pointed ears
  fillStroke(ctx, [[3, 5], [0, 11], [-3, 6]], 0.4);
  // snarl: fang notch
  poly(ctx, [[12, 0], [8, 1.2], [9, 3]], false); ctx.stroke();
  // red slanted eyes
  ctx.fillStyle = '#ff2d55'; ctx.shadowColor = '#ff2d55';
  poly(ctx, [[1, -4.5], [5, -2.5], [1.5, -2]]); ctx.fill();
  poly(ctx, [[1, 4.5], [5, 2.5], [1.5, 2]]); ctx.fill();
  // whisker hint
  style(ctx, c, 0.8, false);
  poly(ctx, [[10, -1], [14, -4]], false); ctx.stroke(); poly(ctx, [[10, 1], [14, 4]], false); ctx.stroke();
  ctx.restore();
  if (cmd) { // crown + epaulettes
    style(ctx, '#ffe14d', 1.6, o.glow !== false, 10);
    fillStroke(ctx, [[-5, -5], [-6, -13], [-2, -9], [0, -14], [2, -9], [6, -13], [5, -5]].map(([x, y]) => [x * 0.9 + 1, y * 0.62 + 0.5]), 0.45);
    fillStroke(ctx, [[-6, 8], [-1, 8], [-1, 11], [-6, 11]], 0.5);
    fillStroke(ctx, [[-6, -8], [-1, -8], [-1, -11], [-6, -11]], 0.5);
    dot(ctx, 1, -9, 0.9, '#ff5470');
  }
}

function tuna(ctx, o) { // tuna tin with a fish glyph
  const t = o.t || 0, c = o.color || '#7df9ff';
  style(ctx, c, 1.6, o.glow !== false, 9);
  const b = Math.sin(t * 4) * 0.8;
  ctx.save(); ctx.translate(0, b);
  fillStroke(ctx, [[-8, -5], [8, -5], [8, 5], [-8, 5]], 0.25);
  ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(-8, 5); ctx.stroke();
  // fish
  style(ctx, '#fff3cf', 1.3, false);
  poly(ctx, [[-4.5, 0], [-1, -2.6], [3, 0], [-1, 2.6]]); ctx.stroke();
  poly(ctx, [[3, 0], [6, -2.2], [6, 2.2]]); ctx.stroke();
  dot(ctx, -2.8, -0.5, 0.5, '#fff3cf');
  ctx.restore();
}

function yarn(ctx, o) { // yarn bomb ball
  const t = o.t || 0, c = o.color || '#ff4fd8';
  style(ctx, c, 1.5, o.glow !== false, 9);
  circle(ctx, 0, 0, 7, true, 0.25); circle(ctx, 0, 0, 7);
  ctx.lineWidth = 1;
  poly(ctx, [[-6, -3], [-2, -6], [3, -6.5], [6, -2]], false); ctx.stroke();
  poly(ctx, [[-7, 1], [-3, -2], [3, -1], [7, 2]], false); ctx.stroke();
  poly(ctx, [[-5, 5], [-1, 3], [4, 4], [6, 6]], false); ctx.stroke();
  poly(ctx, [[5, -5], [10, -3 + Math.sin(t * 5) * 1.5], [12, 2]], false); ctx.stroke(); // trailing thread
}

function kitten(ctx, o) { // tiny cat-head dot, 1 colour, no shadow (ship-sized)
  const c = o.color || P.colby;
  style(ctx, c, 1.3, o.glow === true, 5);
  fillStroke(ctx, [[3.5, 0], [1.5, -3], [-3, -3], [-3, 3], [1.5, 3]], 0.45);
  fillStroke(ctx, [[1.5, -3], [2.5, -5.5], [-0.5, -3]], 0.6);
  fillStroke(ctx, [[1.5, 3], [2.5, 5.5], [-0.5, 3]], 0.6);
}

function cheese(ctx, o) { // wedge with holes
  const c = o.color || PALETTE.cheese;
  style(ctx, c, 1.6, o.glow !== false, 8);
  fillStroke(ctx, [[-8, 6], [9, 6], [9, -2], [-8, -6]], 0.3);
  fillStroke(ctx, [[-8, -6], [9, -2], [4, -6]], 0.45);
  circle(ctx, -3, 1, 1.5); circle(ctx, 3, 2.5, 1.1); circle(ctx, 5, -1.5, 0.8);
}

function paw(ctx, o) { // paw print
  const c = o.color || '#ff5fa2';
  style(ctx, c, 1.4, o.glow !== false, 8);
  circle(ctx, -1, 1.5, 4.2, true, 0.35); circle(ctx, -1, 1.5, 4.2);
  for (const [x, y] of [[5, -4.5], [6.5, -1], [6.5, 3.5], [5, 7]]) { circle(ctx, x - 2, y - 1, 1.6, true, 0.5); circle(ctx, x - 2, y - 1, 1.6); }
}

const DRAW = {
  colby: (c, o) => colbyHead(c, o, false), colby_icon: colbyIcon, kitten, mouse, rat: (c, o) => rat(c, o, false),
  commander: (c, o) => rat(c, o, true), cheese, yarn, tuna, paw,
};

export function drawSprite(ctx, name, x, y, angle = 0, scale = 1, opts = {}) {
  const fn = DRAW[name];
  if (!fn) return;
  const o = { ...(opts || {}) };
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  if (scale !== 1) ctx.scale(scale, scale);
  if (o.hurt > 0.5) o.color = '#ffffff';
  fn(ctx, o);
  ctx.restore();
}

// ---- ships (cheap: <= 12 canvas ops, one colour, no shadowBlur) --------------------------------
export function drawShip(ctx, owner, x, y, angle, t = 0) {
  const c = factionOf(owner).color;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle || 0);
  ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (owner === 1) { // kitten: head with two ears
    ctx.moveTo(4, 0); ctx.lineTo(1, -3); ctx.lineTo(2.5, -5.5); ctx.lineTo(-1, -3); ctx.lineTo(-3, -3); ctx.lineTo(-3, 3);
    ctx.lineTo(-1, 3); ctx.lineTo(2.5, 5.5); ctx.lineTo(1, 3);
  } else if (owner === 2) { // rat: pointed dart
    ctx.moveTo(5, 0); ctx.lineTo(-1, -3.6); ctx.lineTo(-2, -1); ctx.lineTo(-6, 0 + Math.sin(t * 9)); ctx.lineTo(-2, 1); ctx.lineTo(-1, 3.6);
  } else if (owner === 3) { // mouse: round with ears
    ctx.moveTo(4, 0); ctx.lineTo(0, -2.5); ctx.lineTo(-1, -5); ctx.lineTo(-3, -2); ctx.lineTo(-3, 2); ctx.lineTo(-1, 5); ctx.lineTo(0, 2.5);
  } else { // commander: diamond with crown spike
    ctx.moveTo(5.5, 0); ctx.lineTo(0, -4); ctx.lineTo(-2, -6); ctx.lineTo(-3, -1.5); ctx.lineTo(-3, 1.5); ctx.lineTo(-2, 6); ctx.lineTo(0, 4);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
  ctx.restore();
}

// ---- cheese wheel ------------------------------------------------------------------------------
function hash(n) { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }

export function drawPlanet(ctx, planet, t = 0, opts = {}) {
  const { x, y, owner = 0, id = 0 } = planet;
  const units = planet.units ?? 0, level = Math.max(0, Math.min(2, planet.level | 0));
  const r = planet.r || TUNING.planetR[planet.size] || 32;
  const f = factionOf(owner), col = f.color;
  const flash = opts.flash > 0 ? Math.min(1, opts.flash) : 0;
  ctx.save(); ctx.translate(x, y);
  // body: warm saturated cheese-yellow face, darker rind ring in faction colour
  const face = owner === 0 ? '#ffd23f' : '#f2b72a';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  style(ctx, col, 4, true, 10 + level * 3 + flash * 12);
  ctx.fillStyle = flash ? '#fff3cf' : face; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
  // rind band (faction-coloured, darker)
  style(ctx, owner === 0 ? '#c98a1a' : f.dark, 3, false);
  circle(ctx, 0, 0, r - 3.5);
  style(ctx, col, 1.2, false); ctx.globalAlpha = 0.9; circle(ctx, 0, 0, r - 0.5); ctx.globalAlpha = 1;
  // faint inner highlight crescent
  style(ctx, '#fff3cf', 1.6, false); ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.arc(0, 0, r - 7, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke(); ctx.globalAlpha = 1;
  // Swiss holes: dark, with lighter lip
  const nh = 4 + Math.round(r / 11);
  for (let i = 0; i < nh; i++) {
    const a = hash(id * 31 + i * 7 + 1) * TAU, d = r * (0.38 + 0.35 * hash(id * 17 + i * 3 + 5)), hr = 3 + hash(id * 13 + i) * (r / 7);
    const hx = Math.cos(a) * d, hy = Math.sin(a) * d;
    ctx.fillStyle = '#8a5200'; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff0a0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.stroke();
  }
  // wedge cut line highlight
  const rot = t * 0.15 + hash(id) * TAU;
  style(ctx, '#fff3cf', 1.4, false); ctx.globalAlpha = 0.8;
  poly(ctx, [[Math.cos(rot) * (r - 4), Math.sin(rot) * (r - 4)], [0, 0], [Math.cos(rot + 0.7) * (r - 4), Math.sin(rot + 0.7) * (r - 4)]], false); ctx.stroke();
  ctx.globalAlpha = 1;
  // level rings: 0 none, 1 one ring + ticks, 2 two rings + gear teeth
  if (level >= 1) {
    style(ctx, col, 1.8, true, 8); circle(ctx, 0, 0, r + 5);
    ctx.save(); ctx.rotate(t * 0.4);
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; poly(ctx, [[Math.cos(a) * (r + 5), Math.sin(a) * (r + 5)], [Math.cos(a) * (r + 8), Math.sin(a) * (r + 8)]], false); ctx.stroke(); }
    ctx.restore();
  }
  if (level >= 2) {
    style(ctx, col, 1.8, true, 10); circle(ctx, 0, 0, r + 11);
    ctx.save(); ctx.rotate(-t * 0.3);
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; fillStroke(ctx, [[Math.cos(a - 0.1) * (r + 11), Math.sin(a - 0.1) * (r + 11)], [Math.cos(a) * (r + 15), Math.sin(a) * (r + 15)], [Math.cos(a + 0.1) * (r + 11), Math.sin(a + 0.1) * (r + 11)]], 0.5); }
    ctx.restore();
  }
  // garrison dots orbiting
  const n = Math.min(units | 0, 24);
  if (n > 0) {
    const orR = r - 7 > 6 ? r - 7 : r * 0.7;
    style(ctx, '#3a1c00', 1, false);
    for (let i = 0; i < n; i++) {
      const a = t * (0.6 + (i % 3) * 0.1) + i * TAU / n, rr = orR - (i % 2) * 4;
      circle(ctx, Math.cos(a) * rr, Math.sin(a) * rr, 1.7, true);
    }
  }
  if (opts.selected) { drawSelectRing(ctx, 0, 0, r + 8 + level * 6, t); }
  if (opts.hover) { style(ctx, '#ffffff', 1.2, false); ctx.globalAlpha = 0.6; circle(ctx, 0, 0, r + 4 + level * 6); ctx.globalAlpha = 1; }
  if (opts.targeted) {
    style(ctx, PALETTE.arrow, 1.6, true, 8);
    const rr = r + 10 + level * 6 + Math.sin(t * 6) * 1.5;
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + t; ctx.beginPath(); ctx.arc(0, 0, rr, a, a + 0.5); ctx.stroke(); }
  }
  ctx.restore();
  if (units > 0 || owner !== 0) {
    if (units > 0 || owner !== 0) drawText(ctx, String(units | 0), x, y - 3, { scale: r >= 40 ? 3 : 2, color: '#2a1000', align: 'center', shadow: '#fff8d0' });
  }
}

// ---- UI strokes --------------------------------------------------------------------------------
export function drawSelectRing(ctx, x, y, r, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 1.2);
  style(ctx, PALETTE.select, 1.8, true, 8);
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, r, i * TAU / 4, i * TAU / 4 + 1.1); ctx.stroke(); }
  ctx.restore();
}

export function drawSendArrow(ctx, pts, t = 0, color = PALETTE.arrow) {
  if (!pts || pts.length < 2) return;
  ctx.save();
  style(ctx, color, 2.2, true, 10);
  ctx.setLineDash && ctx.setLineDash([8, 6]); if ('lineDashOffset' in ctx) ctx.lineDashOffset = -t * 40;
  poly(ctx, pts.map((p) => (Array.isArray(p) ? p : [p.x, p.y])), false); ctx.stroke();
  ctx.setLineDash && ctx.setLineDash([]);
  const a = pts[pts.length - 1], b = pts[pts.length - 2];
  const ax = Array.isArray(a) ? a[0] : a.x, ay = Array.isArray(a) ? a[1] : a.y, bx = Array.isArray(b) ? b[0] : b.x, by = Array.isArray(b) ? b[1] : b.y;
  const ang = Math.atan2(ay - by, ax - bx);
  ctx.translate(ax, ay); ctx.rotate(ang);
  fillStroke(ctx, [[2, 0], [-12, -7], [-8, 0], [-12, 7]], 0.6);
  ctx.restore();
}

export function drawFactionBadge(ctx, owner, x, y, s = 1) {
  const f = factionOf(owner);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  style(ctx, f.color, 1.6, true, 6); circle(ctx, 0, 0, 11, true, 0.18); circle(ctx, 0, 0, 11);
  const sp = { 1: 'kitten', 2: 'rat', 3: 'mouse', 4: 'commander' }[owner];
  if (sp) { ctx.rotate(-Math.PI / 2); ctx.scale(0.9, 0.9); DRAW[sp](ctx, { color: f.color, glow: false }); }
  else { circle(ctx, -3, 1, 1.8); circle(ctx, 3, -2, 1.3); }
  ctx.restore();
}

export function drawColbyPortrait(ctx, x, y, scale = 1, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const bob = Math.sin(t * 2) * 1.5; ctx.translate(0, bob);
  const earTw = Math.sin(t * 3.1) * 0.06 + (Math.sin(t * 0.7) > 0.96 ? 0.15 : 0);
  const O = P.colby, C = P.colbyWhite;
  // ears
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * 34, -34); ctx.rotate(s * (0.15 + earTw));
    style(ctx, O, 3, true, 14); fillStroke(ctx, [[-14 * s, 12], [0, -34], [16 * s, 10]], 0.35);
    style(ctx, '#ff5fa2', 2, false); fillStroke(ctx, [[-6 * s, 8], [0, -20], [8 * s, 7]], 0.35);
    ctx.restore();
  }
  // head
  style(ctx, O, 3.5, true, 16);
  ctx.beginPath(); ctx.moveTo(0, -42);
  ctx.bezierCurveTo(46, -42, 60, -6, 52, 18); ctx.bezierCurveTo(44, 46, 20, 52, 0, 52);
  ctx.bezierCurveTo(-20, 52, -44, 46, -52, 18); ctx.bezierCurveTo(-60, -6, -46, -42, 0, -42); ctx.closePath();
  ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
  // marbled cream patches (cheese swirls)
  ctx.fillStyle = C; ctx.strokeStyle = C; ctx.shadowBlur = 0; ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(-8, -42); ctx.bezierCurveTo(-22, -34, -30, -16, -14, -14); ctx.bezierCurveTo(-6, -22, 0, -32, -8, -42); ctx.fill();
  ctx.beginPath(); ctx.moveTo(30, 30); ctx.bezierCurveTo(46, 18, 54, 10, 50, 22); ctx.bezierCurveTo(44, 40, 34, 46, 24, 46); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-18, 6, -28, 22, -18, 40); ctx.bezierCurveTo(-8, 52, 8, 52, 18, 40); ctx.bezierCurveTo(28, 22, 18, 6, 0, 6); ctx.fill();
  ctx.globalAlpha = 1;
  // marbling swirls
  style(ctx, O, 1.6, false); ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.bezierCurveTo(-32, -6, -26, 4, -18, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(38, -16); ctx.bezierCurveTo(30, -10, 24, -20, 16, -14); ctx.stroke();
  ctx.globalAlpha = 1;
  // eyes (blink every ~4s)
  const blink = (t % 4) > 3.85 ? 0.12 : 1;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * 21, -8); ctx.scale(1, blink);
    ctx.fillStyle = '#05030f'; ctx.strokeStyle = P.wall; ctx.shadowColor = P.wall; ctx.shadowBlur = 8; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse ? ctx.ellipse(0, 0, 10, 11, 0, 0, TAU) : ctx.arc(0, 0, 10, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = '#7df9ff'; ctx.beginPath(); ctx.arc(s * 1.5, 1, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#05030f'; ctx.beginPath(); ctx.arc(s * 1.5, 1, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s * 1.5 + 2.5, -3, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // nose + mouth
  style(ctx, '#ff5fa2', 2, true, 8);
  fillStroke(ctx, [[-5, 8], [5, 8], [0, 14]], 0.8);
  style(ctx, C, 2, false);
  ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, 19); ctx.moveTo(-10, 24); ctx.quadraticCurveTo(-4, 24, 0, 19); ctx.quadraticCurveTo(4, 24, 10, 24); ctx.stroke();
  // whiskers
  style(ctx, '#ffffff', 1.6, true, 6);
  const wig = Math.sin(t * 2.4) * 2;
  for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(s * 22, 14 + i * 4);
    ctx.quadraticCurveTo(s * 50, 10 + i * 9 + wig, s * 82, 8 + i * 17 + wig * 1.5); ctx.stroke();
  }
  ctx.restore();
}

// ---- logo ------------------------------------------------------------------------------------
// Stroke letters on a 10x14 cell grid. Each glyph is a list of polylines (arrays of [x,y]); 'O' and others use arcs via polylines.
function oval(cx, cy, rx, ry, n = 16) { const p = []; for (let i = 0; i <= n; i++) p.push([cx + Math.cos(i * TAU / n) * rx, cy + Math.sin(i * TAU / n) * ry]); return p; }
const GLYPHS = {
  O: [oval(5, 7, 5, 7)],
  M: [[[0, 14], [0, 0], [5, 8], [10, 0], [10, 14]]],
  E: [[[10, 0], [0, 0], [0, 14], [10, 14]], [[0, 7], [8, 7]]],
  G: [[[10, 2], [8, 0], [2, 0], [0, 2], [0, 12], [2, 14], [8, 14], [10, 12], [10, 7], [5, 7]]],
  A: [[[0, 14], [5, 0], [10, 14]], [[2, 9], [8, 9]]],
  R: [[[0, 14], [0, 0], [8, 0], [10, 2], [10, 6], [8, 8], [0, 8]], [[5, 8], [10, 14]]],
  T: [[[0, 0], [10, 0]], [[5, 0], [5, 14]]],
  C: [[[10, 2], [8, 0], [2, 0], [0, 2], [0, 12], [2, 14], [8, 14], [10, 12]]],
  L: [[[0, 0], [0, 14], [10, 14]]],
  U: [[[0, 0], [0, 12], [2, 14], [8, 14], [10, 12], [10, 0]]],
  X: [[[0, 0], [10, 14]], [[10, 0], [0, 14]]],
  B: [[[0, 0], [0, 14], [8, 14], [10, 12], [10, 9], [8, 7], [0, 7]], [[0, 0], [8, 0], [10, 2], [10, 5], [8, 7]]],
};
const LOGO_COLORS = ['#ff9b2e', '#ffc933', '#ff4fd8', '#7df9ff'];
function logoWord(ctx, word, cx, y, cw, ch, gap, t, phase) {
  const total = word.length * cw + (word.length - 1) * gap;
  let x = cx - total / 2;
  for (let i = 0; i < word.length; i++, x += cw + gap) {
    const g = GLYPHS[word[i]]; if (!g) continue;
    const col = LOGO_COLORS[(i + phase) % LOGO_COLORS.length];
    const flick = 0.85 + 0.15 * Math.sin(t * 7 + i * 1.7 + phase);
    ctx.globalAlpha = flick;
    for (const pass of [0, 1]) {
      style(ctx, pass ? '#fff3cf' : col, pass ? 1.4 : 5, pass === 0, 18);
      if (pass === 0) ctx.globalAlpha = flick * 0.9;
      for (const line of g) {
        poly(ctx, line.map(([px, py]) => [x + px * cw / 10, y + py * ch / 14]), false); ctx.stroke();
      }
    }
    // cheese holes punched into the O's and G's bowl
    if (word[i] === 'O' || word[i] === 'A') {
      style(ctx, '#ffc933', 1.2, false);
      const hx = x + cw * (word[i] === 'O' ? 0.5 : 0.5), hy = y + ch * (word[i] === 'O' ? 0.5 : 0.7);
      circle(ctx, hx, hy, cw * 0.14); if (word[i] === 'O') circle(ctx, hx + cw * 0.12, hy - ch * 0.17, cw * 0.07);
    }
    ctx.globalAlpha = 1;
  }
}

export function drawLogo(ctx, cx, y, t = 0) {
  ctx.save();
  const bob = Math.sin(t * 1.6) * 1.5;
  const cw = 34, ch = 46, gap = 8, word = 'COLBAURALUX';
  logoWord(ctx, word, cx, y + bob, cw, ch, gap, t, 0);
  // tiny cat ears on the two A's
  const total = word.length * cw + (word.length - 1) * gap, x0 = cx - total / 2;
  style(ctx, '#ff9b2e', 1.6, true, 8);
  for (const i of [4, 7]) {
    const ax = x0 + i * (cw + gap) + cw / 2, ay = y + bob + 1;
    fillStroke(ctx, [[ax - 9, ay + 6], [ax - 7, ay - 5], [ax - 1, ay + 1]], 0.6);
    fillStroke(ctx, [[ax + 9, ay + 6], [ax + 7, ay - 5], [ax + 1, ay + 1]], 0.6);
  }
  style(ctx, '#ffc933', 2, true, 12);
  const uy = y + 60 + bob, hw = total / 2 - 10;
  poly(ctx, [[cx - hw, uy], [cx + hw, uy]], false); ctx.stroke();
  ctx.lineWidth = 1.2;
  for (const f of [-0.8, -0.35, 0.1, 0.55, 0.9]) circle(ctx, cx + f * hw, uy, 3 + (Math.abs(f * 10) % 3));
  ctx.restore();
}

export { SPRITES };
