import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { createBus } from '../src/core/events.js';
import { TUNING } from '../src/core/defs.js';

const P = (x, y, size, owner, units, level = 0) => ({ x, y, size, owner, units, level });
const mk = (planets, extra = {}) => createGame({ seed: 7, level: { id: 't', name: 't', planets, ai: [] , ...extra.level }, ai: false, ...extra.opts });
const run = (g, sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g.update(1 / 60); };
// Two far planets (so ships need time) with a neutral bystander.
const base = () => [P(100, 270, 2, 1, 20), P(860, 270, 2, 2, 5), P(480, 60, 1, 0, 3)];

test('deterministic replay', () => {
  const trace = () => {
    const ev = [];
    const bus = createBus(); bus.on('*', (t, p) => ev.push(t + JSON.stringify(p)));
    const g = createGame({ seed: 42, bus, ai: false, level: { planets: base(), ai: [] } });
    g.send([0], 1, 1); run(g, 3); g.send([0], 2, 0.5); run(g, 12);
    return JSON.stringify([g.t, g.planets.map(p => [p.owner, p.units, p.level, p.gen]), g.ships, g.stats]) + ev.join('|');
  };
  assert.equal(trace(), trace());
});

test('send pct and queue accounting', () => {
  const g = mk(base());
  assert.equal(g.send([0], 1, 0.5), 10);
  assert.equal(g.planets[0].units, 10);
  assert.equal(g.planets[0].queue[0].n, 10);
  assert.equal(g.send([1], 0), 0, 'player cannot order enemy planet');
  assert.equal(g.send([0], 0), 0, 'from===to ignored');
  g.planets[0].units = 1;
  assert.equal(g.send([0], 1, 0.1), 1, 'min 1');
  g.planets[0].units = 0;
  assert.equal(g.send([0], 1, 1), 0);
  g.setSendPct(0.25); assert.equal(g.sendPct, 0.25);
});

test('queue drains at launchPerSec into ships', () => {
  const g = mk(base());
  g.send([0], 1, 1);
  run(g, 0.2);
  const expected = Math.floor(TUNING.launchPerSec * 0.2);
  assert.ok(Math.abs(g.ships.length - expected) <= 2, `ships ${g.ships.length} vs ${expected}`);
  const s = g.ships[0];
  assert.ok(s.vx > 0 && s.to === 1 && s.owner === 1);
});

test('1:1 annihilation', () => {
  const g = mk([P(100, 270, 1, 1, 10), P(860, 270, 1, 2, 10), P(480, 270, 1, 0, 0)]);
  g.planets[2].owner = 0;
  g.sendAs(1, [0], 1, 1); g.sendAs(2, [1], 0, 1);
  const a = 10, b = 10;
  g.stats.kills; run(g, 8);
  assert.equal(g.ships.filter(s => s.owner === 1).length, 0);
  assert.equal(g.ships.filter(s => s.owner === 2).length, 0);
  assert.equal(g.stats.kills[1], a); assert.equal(g.stats.kills[2], b);
});

test('unequal fleets leave the difference', () => {
  const g = mk([P(100, 270, 1, 1, 30), P(860, 270, 1, 2, 30)]);
  g.sendAs(1, [0], 1, 1);
  g.planets[1].units = 10; g.sendAs(2, [1], 0, 1);
  g.planets[0].gen = 0;
  // run until fleets clash, before arrival
  run(g, 4.5);
  const c1 = g.ships.filter(s => s.owner === 1).length, c2 = g.ships.filter(s => s.owner === 2).length;
  assert.equal(c2, 0);
  assert.ok(c1 > 0 && c1 <= 20 + 1);
});

test('capture rule: arrival reduces garrison, 0 garrison flips (neutral too)', () => {
  const g = mk([P(100, 270, 2, 1, 30), P(400, 270, 1, 0, 2)]);
  const ev = [];
  g.bus.on('planet', (p) => ev.push(p));
  g.send([0], 1, 0.5); // 15 ships vs 2 units
  run(g, 6);
  const p = g.planets[1];
  assert.equal(p.owner, 1);
  assert.equal(p.level, 0);
  assert.ok(p.units >= TUNING.captureStartUnits);
  assert.equal(ev[0].owner, 1); assert.equal(ev[0].prev, 0);
  assert.equal(g.stats.captured, 1);
});

test('capture needs garrison to hit 0 first (not captured by equal ships)', () => {
  const g = mk([P(100, 270, 2, 1, 30), P(400, 270, 1, 0, 5), P(900, 500, 1, 2, 1)]);
  g.planets[0].units = 10;
  g.send([0], 1, 0.5); // 5 ships vs 5 units -> garrison 0, still neutral
  run(g, 5);
  assert.equal(g.planets[1].owner, 0);
  assert.equal(g.planets[1].units, 0);
});

test('friendly arrival reinforces; absorbed at cap', () => {
  const g = mk([P(100, 270, 2, 1, 20), P(300, 270, 3, 1, 95, 2), P(900, 500, 1, 2, 1)]);
  g.planets[1].gen = 0;
  g.send([0], 1, 1);
  run(g, 4);
  assert.equal(g.planets[1].units, TUNING.cap[2]);
});

test('production stops at cap, levelup at threshold with event', () => {
  const g = mk([P(100, 270, 3, 1, 23), P(900, 500, 1, 2, 1)]);
  const lv = [];
  g.bus.on('levelup', (e) => lv.push(e));
  run(g, 3);
  assert.equal(g.planets[0].level, 1);
  assert.deepEqual(lv[0], { id: 0, level: 1 });
  const g2 = mk([P(100, 270, 3, 1, 60, 2), P(900, 500, 1, 2, 1)]);
  g2.planets[0].units = TUNING.cap[2] - 1;
  run(g2, 5);
  assert.equal(g2.planets[0].units, TUNING.cap[2]);
});

test('queue dropped when source planet changes owner', () => {
  const g = mk([P(100, 270, 1, 1, 40), P(860, 270, 2, 2, 30), P(900, 100, 1, 2, 1)]);
  g.send([0], 1, 1);
  g.planets[0].units = 0;
  // enemy takes planet 0
  g.sendAs(2, [1], 0, 1);
  run(g, 0.05);
  const q0 = g.planets[0].queue.length;
  assert.ok(q0 >= 0);
  // force flip directly via ships: simulate by setting owner through arrival
  const g2 = mk([P(100, 270, 1, 1, 40), P(130, 270, 1, 2, 5), P(900, 500, 1, 2, 1)]);
  g2.planets[0].units = 0; g2.planets[0].queue.push({ to: 2, owner: 1, n: 50 });
  g2.sendAs(2, [1], 0, 1);
  run(g2, 2);
  assert.equal(g2.planets[0].owner, 2);
  assert.equal(g2.planets[0].queue.length, 0);
});

test('win and lose, state emitted once', () => {
  const g = mk([P(100, 270, 2, 1, 30), P(300, 270, 1, 2, 0)]);
  const st = [];
  g.bus.on('state', (e) => st.push(e.state));
  g.send([0], 1, 0.2);
  run(g, 5);
  assert.equal(g.state, 'won');
  run(g, 1);
  assert.deepEqual(st, ['won']);
  const l = mk([P(100, 270, 1, 1, 0), P(300, 270, 2, 2, 20)]);
  l.sendAs(2, [1], 0, 1);
  run(l, 5);
  assert.equal(l.state, 'lost');
});

test('maxShips cap holds and queues wait', () => {
  const g = mk([P(100, 270, 3, 1, 100, 2), P(860, 270, 3, 2, 100, 2), P(480, 60, 1, 0, 1)]);
  for (const p of g.planets.slice(0, 2)) p.units = 100;
  let peak = 0;
  for (let i = 0; i < 900; i++) {
    if (i % 20 === 0) { g.planets[0].units = 100; g.planets[1].units = 100; g.send([0], 2, 1); g.sendAs(2, [1], 2, 1); }
    g.update(1 / 60); peak = Math.max(peak, g.ships.length);
  }
  assert.ok(peak <= TUNING.maxShips);
});

test('900 ships step under 4 ms average', () => {
  const g = mk([P(100, 270, 3, 1, 100, 2), P(860, 270, 3, 2, 100, 2), P(480, 60, 1, 0, 1), P(480, 480, 1, 0, 1)]);
  for (let i = 0; i < 900; i++) {
    const owner = 1 + (i & 1), to = 2 + (i % 2);
    const x = 150 + g.rng.next() * 660, y = 100 + g.rng.next() * 340;
    g.ships.push({ id: 100000 + i, owner, x, y, vx: 0, vy: owner === 1 ? 95 : -95, to, t: 0, dead: false });
  }
  const N = 60; let sum = 0, cnt = 0;
  for (let k = 0; k < N; k++) {
    // keep ~900 alive: top up each step
    while (g.ships.length < 900) {
      const i = g.ships.length;
      g.ships.push({ id: 200000 + k * 1000 + i, owner: 1 + (i & 1), x: 150 + g.rng.next() * 660, y: 100 + g.rng.next() * 340, vx: 0, vy: 95, to: 2, t: 0, dead: false });
    }
    const t0 = performance.now(); g.update(1 / 60); sum += performance.now() - t0; cnt++;
  }
  const avg = sum / cnt;
  assert.ok(avg < 4, `avg ${avg.toFixed(2)} ms`);
});
