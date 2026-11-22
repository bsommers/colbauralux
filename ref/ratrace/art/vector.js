// Neon-vector art for OMEGA RATRACE (ARCHITECTURE.md §6). Pure canvas path drawing, no DOM at import.
// Every sprite faces +x at angle 0 and is drawn centred on (x, y).
import { PALETTE as P, SPRITES, KINDS, TUNING, BOX } from '../core/defs.js';

const TAU = Math.PI * 2;
const RADII = {
  colby: TUNING.ship.r, colby_icon: 8, hairball: KINDS.hairball.r, mouse: KINDS.mouse.r, rat: KINDS.rat.r,
  commander: KINDS.commander.r, mine: KINDS.mine.r, deathrat: KINDS.deathrat.r, ebullet: KINDS.ebullet.r,
  tuna: KINDS.tuna.r, yarn: 8,
};

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

function hairball(ctx, o) {
  const t = o.t || 0, c = o.color || P.hairball;
  style(ctx, c, 1.4, o.glow !== false, 10);
  circle(ctx, 0, 0, 3, true, 0.6); circle(ctx, 0, 0, 3);
  // scribbly fur strands
  for (let i = 0; i < 5; i++) {
    const a = t * 9 + i * (TAU / 5);
    poly(ctx, [[Math.cos(a) * 2, Math.sin(a) * 2], [Math.cos(a + 0.4) * 4.6, Math.sin(a + 0.4) * 4.6]], false); ctx.stroke();
  }
}

function ebullet(ctx, o) { // cheese pellet: tiny wedge with a bite
  const t = o.t || 0, c = o.color || P.ebullet;
  style(ctx, c, 1.4, o.glow !== false, 9);
  ctx.save(); ctx.rotate(t * 6);
  fillStroke(ctx, [[4, 0], [-3, -3.6], [-3, 3.6]], 0.55);
  ctx.restore();
  dot(ctx, 0, 0, 0.9, '#fff3cf');
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

function deathrat(ctx, o) {
  const t = o.t || 0, c = o.color || P.death, pulse = 0.7 + 0.3 * Math.sin(t * 12);
  style(ctx, c, 2, o.glow !== false, 14);
  // skull
  fillStroke(ctx, [[17, 0], [10, -8], [0, -12], [-10, -9], [-13, -3], [-13, 3], [-10, 9], [0, 12], [10, 8]], 0.22);
  // rat ears (spiky)
  fillStroke(ctx, [[2, -11], [-1, -19], [-8, -10]], 0.4);
  fillStroke(ctx, [[2, 11], [-1, 19], [-8, 10]], 0.4);
  // eye sockets
  ctx.globalAlpha *= pulse;
  fillStroke(ctx, [[2, -8], [9, -5], [3, -2]], 1);
  fillStroke(ctx, [[2, 8], [9, 5], [3, 2]], 1);
  ctx.globalAlpha /= pulse;
  // nose + teeth
  dot(ctx, 15.5, 0, 1.2, '#ffffff');
  style(ctx, '#ffffff', 1, false);
  for (let i = -2; i <= 2; i++) poly(ctx, [[10, i * 1.6], [13, i * 1.6]], false), ctx.stroke();
  // crossbones tail
  style(ctx, c, 1.6, o.glow !== false, 8);
  const w = Math.sin(t * 6) * 3;
  poly(ctx, [[-13, 0], [-18, w], [-23, -w], [-27, w]], false); ctx.stroke();
}

function mine(ctx, o) {
  const t = o.t || 0, armed = o.armed !== false, c = o.color || P.mine;
  const pulse = armed ? 0.5 + 0.5 * Math.sin(t * 10) : 0.25;
  style(ctx, c, 1.7, o.glow !== false, 6 + 8 * pulse);
  ctx.save(); ctx.rotate(t * 0.8);
  // Swiss wheel (octagon-ish) with holes
  const pts = []; for (let i = 0; i < 10; i++) pts.push([Math.cos(i * TAU / 10) * 9, Math.sin(i * TAU / 10) * 9]);
  fillStroke(ctx, pts, 0.28);
  ctx.restore();
  ctx.lineWidth = 1.2;
  circle(ctx, -2.5, -2, 1.9); circle(ctx, 3, 1.5, 1.5); circle(ctx, -1, 4, 1.1);
  ctx.globalAlpha *= (0.35 + pulse * 0.65); dot(ctx, 0, 0, 1.6, armed ? '#ff2d55' : c); ctx.globalAlpha /= (0.35 + pulse * 0.65);
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

const DRAW = {
  colby: (c, o) => colbyHead(c, o, false), colby_icon: colbyIcon, hairball, mouse, rat: (c, o) => rat(c, o, false),
  commander: (c, o) => rat(c, o, true), mine, deathrat, ebullet, tuna, yarn,
};

export function drawSprite(ctx, name, x, y, angle = 0, scale = 1, opts = {}) {
  const fn = DRAW[name];
  if (!fn) return;
  const o = { ...(opts || {}) };
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  if (scale !== 1) ctx.scale(scale, scale);
  if (o.hurt > 0.5) o.color = '#ffffff'; // white flash
  fn(ctx, o);
  ctx.restore();
}

// ---- walls & hole ---------------------------------------------------------------------------
export function drawWallRect(ctx, x0, y0, x1, y1, t = 0, opts = {}) {
  const c = opts.color || P.wall, hot = Math.max(0, Math.min(1, opts.hot || 0));
  const col = hot > 0.05 ? P.wallHot : c;
  ctx.save();
  style(ctx, col, 2 + hot * 1.5, opts.glow !== false, 10 + hot * 10);
  ctx.globalAlpha *= 0.55 + hot * 0.45 + 0.1 * Math.sin(t * 3);
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.stroke();
  ctx.globalAlpha = 1;
  // marching energy dashes
  ctx.setLineDash && ctx.setLineDash([6, 10]);
  ctx.lineDashOffset = -t * 40;
  ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.rect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6); ctx.stroke();
  ctx.setLineDash && ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // corner posts
  style(ctx, col, 1.8, opts.glow !== false, 12);
  for (const [px, py] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
    const r = 5 + Math.sin(t * 5 + px + py) * 0.8;
    circle(ctx, px, py, r, true, 0.35); circle(ctx, px, py, r);
    dot(ctx, px, py, 1.6, '#ffffff');
  }
  ctx.restore();
}

export function drawMouseHole(ctx, t = 0) {
  const { x0, y0, x1, y1 } = BOX, w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  ctx.save();
  style(ctx, P.box, 2, true, 10);
  ctx.globalAlpha = 0.09; ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.fill(); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.stroke();
  // cheese-wheel rim: inner inset with scalloped crust corners
  ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.rect(x0 + 7, y0 + 7, w - 14, h - 14); ctx.stroke();
  ctx.globalAlpha = 1;
  // cheese holes (slowly bobbing)
  ctx.lineWidth = 1.3;
  const holes = [[0.12, 0.2, 9], [0.3, 0.78, 12], [0.55, 0.12, 7], [0.82, 0.25, 11], [0.9, 0.78, 8], [0.7, 0.85, 6], [0.06, 0.62, 6], [0.44, 0.9, 5]];
  for (const [fx, fy, r] of holes) circle(ctx, x0 + fx * w, y0 + fy * h + Math.sin(t * 0.8 + fx * 9) * 1.2, r);
  // mouse-hole arches on all four sides, with a glowing dark gap
  const arch = (ax, ay, rot) => {
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(rot);
    ctx.fillStyle = '#05030f'; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-16, -10); ctx.arc(0, -10, 16, Math.PI, 0); ctx.lineTo(16, 0); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; style(ctx, P.orange, 1.8, true, 9);
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-16, -10); ctx.arc(0, -10, 16, Math.PI, 0); ctx.lineTo(16, 0); ctx.stroke();
    // glinting eyes inside
    const g = 0.5 + 0.5 * Math.sin(t * 3 + ax);
    ctx.globalAlpha = 0.4 + 0.6 * g; dot(ctx, -4, -9, 1.3, '#ff2d55'); dot(ctx, 4, -9, 1.3, '#ff2d55'); ctx.globalAlpha = 1;
    ctx.restore();
  };
  arch(cx, y0, Math.PI); arch(cx, y1, 0); arch(x0, cy, Math.PI / 2); arch(x1, cy, -Math.PI / 2);
  // label
  ctx.restore();
}

// ---- Colby portrait --------------------------------------------------------------------------
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
  logoWord(ctx, 'OMEGA', cx, y + bob, 34, 46, 12, t, 0);
  logoWord(ctx, 'RATRACE', cx, y + 58 + bob, 34, 46, 12, t, 2);
  // underline cheese wedge motif with holes
  style(ctx, '#ffc933', 2, true, 12);
  const uy = y + 112 + bob, hw = 150;
  poly(ctx, [[cx - hw, uy], [cx + hw, uy]], false); ctx.stroke();
  ctx.lineWidth = 1.2;
  for (const f of [-0.8, -0.35, 0.1, 0.55, 0.9]) circle(ctx, cx + f * hw, uy, 3 + (Math.abs(f * 10) % 3));
  ctx.restore();
}

export { SPRITES };
