import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../src/core/events.js';
import { FX_TYPES, W, H } from '../src/core/defs.js';
import { createRenderer } from '../src/render/renderer.js';
import { createParticles, MAX_PARTICLES } from '../src/render/particles.js';
import { createBackground } from '../src/render/background.js';

// Recording stub 2D context: counts every call, never draws.
function stubCtx() {
  const counts = {};
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k === '__counts') return counts;
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => { counts[k] = (counts[k] || 0) + 1; return grad; };
      return (...a) => { counts[k] = (counts[k] || 0) + 1; };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return ctx;
}
function stubCanvas() {
  const c = stubCtx();
  return { width: W, height: H, clientWidth: W, clientHeight: H, getContext: () => c, ctx: c, getBoundingClientRect: () => ({ left: 10, top: 20, width: W, height: H }), __makeCanvas: () => stubCanvas() };
}
function game(nShips = 0) {
  const planets = [0, 1, 2, 3].map((i) => ({ id: i, x: 120 + i * 220, y: 270, size: 2, r: 32, owner: i, units: 10 + i, level: i % 3, flash: 0 }));
  const ships = [];
  for (let i = 0; i < nShips; i++) ships.push({ id: i, owner: 1 + (i % 4), x: (i * 37) % W, y: (i * 53) % H, vx: 60 * Math.cos(i), vy: 60 * Math.sin(i), to: 0, t: 0, dead: false });
  return { t: 1, state: 'play', planets, ships };
}

test('draw works with 0 ships and with ui callbacks', () => {
  const bus = createBus(), cv = stubCanvas();
  const r = createRenderer(cv, { bus, settings: { crt: false } });
  let hud = 0, scr = 0;
  r.draw(game(0), 1, { selection: new Set([1]), hover: 2, target: 3, dragPath: [{ x: 1, y: 1 }, { x: 50, y: 60 }], hud: () => hud++, screens: () => scr++ });
  assert.equal(hud, 1); assert.equal(scr, 1);
  r.draw(null, 1);
});

test('every FX_TYPES has a handler and spawns particles', () => {
  const bus = createBus(), p = createParticles(bus);
  for (const t of FX_TYPES) {
    p.clear(); bus.emit('fx', { type: t, x: 100, y: 100, opts: {} });
    assert.ok(p.count > 0, `fx ${t} spawned nothing`);
    p.update(0.016); p.draw(stubCtx());
    p.update(3); assert.equal(p.count, 0, `fx ${t} particles must expire`);
  }
  bus.emit('fx', { type: 'bogus', x: 1, y: 1 }); bus.emit('fx', { type: 'boom', x: NaN, y: 1 });
});

test('particle pool is capped', () => {
  const p = createParticles(createBus());
  for (let i = 0; i < 200; i++) p.spawn('confetti', 5, 5, { n: 40 });
  assert.ok(p.count <= MAX_PARTICLES);
});

test('capture ripple appears and expires', () => {
  const bus = createBus(), cv = stubCanvas();
  const r = createRenderer(cv, { bus, settings: { crt: false } });
  bus.emit('planet', { id: 2, owner: 1, prev: 0 });
  assert.equal(r.ripples.length, 1);
  r.draw(game(0), 1);
  assert.equal(r.ripples[0].x, 120 + 2 * 220);
  r.step(2); assert.equal(r.ripples.length, 0);
});

test('toLogical maps client coords', () => {
  const r = createRenderer(stubCanvas(), { bus: createBus(), settings: { crt: false } });
  const p = r.toLogical(10 + W / 2, 20 + H / 2);
  assert.ok(Math.abs(p.x - W / 2) < 1 && Math.abs(p.y - H / 2) < 1);
});

test('background draws and updates', () => {
  const b = createBackground(3); b.update(0.5); b.draw(stubCtx(), 1);
});

test('600 ships batched: bounded canvas ops and fast', () => {
  const cv = stubCanvas();
  const r = createRenderer(cv, { bus: createBus(), settings: { crt: false } });
  const g = game(600);
  r.draw(g, 1);
  const c = cv.ctx.__counts;
  const snap = () => { for (const k in c) delete c[k]; };
  snap(); r.draw(game(0), 1); const base = c.fill || 0;
  snap(); r.draw(g, 1);
  const fills = c.fill || 0, arcs = c.arc || 0;
  assert.ok(fills - base <= 8, `600 ships add ${fills - base} fills`);  // <= 2 per owner, not per ship
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const t0 = performance.now(); for (let i = 0; i < 120; i++) r.draw(g, 0.5); const ms = (performance.now() - t0) / 120;
  console.log(`# 600 ships: ${total} ctx calls/frame, fill=${fills}, arc=${arcs}, ${ms.toFixed(3)} ms/frame (stub)`);
  assert.ok(ms < 8, `frame ${ms}ms`);
});
