import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { TUNING, DIFFICULTY, PERSONALITIES } from '../src/core/defs.js';
import { createRng } from '../src/core/rng.js';
import { createAI } from '../src/sim/ai.js';
import { createAutopilot } from '../src/sim/autopilot.js';

const HAVE_GAME = existsSync(new URL('../src/sim/game.js', import.meta.url));
const HAVE_LEVELS = existsSync(new URL('../src/sim/levels.js', import.meta.url));

// ---- Minimal stub implementing the §4 rules (used when game.js is absent, and for unit tests) ----
function stubGame(level, seed = 1) {
  const g = { t: 0, planets: [], ships: [], sendPct: 0.5, state: 'play', rng: createRng(seed), ais: [], sent: [] };
  level.planets.forEach((p, id) => g.planets.push({ id, ...p, r: TUNING.planetR[p.size], gen: 0, queue: [] }));
  let sid = 1;
  g.sendAs = (owner, from, to, pct = g.sendPct) => {
    let tot = 0;
    for (const id of from) {
      const p = g.planets[id];
      if (!p || p.owner !== owner || id === to || p.units < 1) continue;
      const n = Math.max(1, Math.floor(p.units * pct));
      p.units -= n; p.queue.push({ to, owner, n }); tot += n;
    }
    g.sent.push({ owner, from, to, tot });
    return tot;
  };
  g.update = (dt) => {
    g.t += dt;
    for (const p of g.planets) {
      if (p.owner > 0 && p.units < TUNING.cap[p.level]) {
        p.gen += TUNING.prod[p.level] * TUNING.sizeProd[p.size] * dt;
        while (p.gen >= 1) { p.gen--; p.units++; }
        if (p.level < 2 && p.units >= TUNING.levelUpAt[p.level]) p.level++;
      }
      let rel = Math.max(1, Math.floor(TUNING.launchPerSec * dt));
      while (p.queue.length && rel-- > 0) {
        const q = p.queue[0], t = g.planets[q.to];
        const d = Math.hypot(t.x - p.x, t.y - p.y) || 1;
        g.ships.push({ id: sid++, owner: q.owner, x: p.x + (t.x - p.x) / d * p.r, y: p.y + (t.y - p.y) / d * p.r,
          vx: (t.x - p.x) / d * TUNING.shipSpeed, vy: (t.y - p.y) / d * TUNING.shipSpeed, to: q.to, dead: false });
        if (--q.n <= 0) p.queue.shift();
      }
    }
    for (const s of g.ships) { s.x += s.vx * dt; s.y += s.vy * dt; }
    for (let i = 0; i < g.ships.length; i++) { const a = g.ships[i]; if (a.dead) continue;
      for (let j = i + 1; j < g.ships.length; j++) { const b = g.ships[j];
        if (!b.dead && a.owner !== b.owner && Math.hypot(a.x - b.x, a.y - b.y) <= TUNING.fightR) { a.dead = b.dead = true; break; } } }
    for (const s of g.ships) { if (s.dead) continue; const t = g.planets[s.to];
      if (Math.hypot(s.x - t.x, s.y - t.y) <= t.r) { s.dead = true;
        if (t.owner === s.owner) { if (t.units < TUNING.cap[t.level]) t.units++; }
        else if (t.units > 0) t.units--; else { t.owner = s.owner; t.units = 1; t.level = 0; t.queue = []; } } }
    g.ships = g.ships.filter((s) => !s.dead);
    for (const a of g.ais) a.act(g, dt);
    const alive = (o) => g.planets.some((p) => p.owner === o) || g.ships.some((s) => s.owner === o);
    if (!alive(1)) g.state = 'lost'; else if (![2, 3, 4].some(alive)) g.state = 'won';
  };
  return g;
}

function duel(seedLevel) {
  // mirrored 1v1, 4 free neutrals in the middle
  const planets = [
    { x: 120, y: 270, size: 2, owner: 1, units: 20, level: 0 }, { x: 840, y: 270, size: 2, owner: 2, units: 20, level: 0 },
    { x: 300, y: 120, size: 1, owner: 0, units: 8, level: 0 }, { x: 660, y: 420, size: 1, owner: 0, units: 8, level: 0 },
    { x: 300, y: 420, size: 1, owner: 0, units: 8, level: 0 }, { x: 660, y: 120, size: 1, owner: 0, units: 8, level: 0 },
    { x: 480, y: 270, size: 3, owner: 0, units: 15, level: 0 },
  ];
  return { planets, ai: [{ owner: 2, personality: 'balanced' }] };
}

test('createAI issues legal sends and respects cadence', () => {
  const g = stubGame(duel());
  const ai = createAI({ owner: 2, personality: 'expander', difficulty: 'normal', rng: createRng(5) });
  let calls = 0;
  const orig = g.sendAs; g.sendAs = (...a) => { calls++; return orig(...a); };
  for (let i = 0; i < 60 * 30; i++) { g.update(1 / 60); ai.act(g, 1 / 60); }
  assert.ok(calls > 0 && calls < 1800, 'acts, but not every frame: ' + calls);
  for (const s of g.sent) assert.equal(g.planets[s.from[0]].owner === 2 || s.owner !== 2, true);
});

test('AI never sends from planets it does not own and never to itself', () => {
  for (const pers of PERSONALITIES) {
    const g = stubGame(duel());
    const ai = createAI({ owner: 2, personality: pers, difficulty: 'hard', rng: createRng(2) });
    const orig = g.sendAs;
    g.sendAs = (o, from, to, pct) => { assert.equal(o, 2); for (const f of from) { assert.notEqual(f, to); assert.ok(pct > 0 && pct <= 1); } return orig(o, from, to, pct); };
    for (let i = 0; i < 60 * 60; i++) { g.update(1 / 60); ai.act(g, 1 / 60); }
  }
});

test('deterministic for same seed', () => {
  const run = () => { const g = stubGame(duel()); const ai = createAI({ owner: 2, personality: 'balanced', rng: createRng(9) });
    const pl = createAutopilot({ owner: 1, personality: 'rusher', rng: createRng(4) });
    for (let i = 0; i < 60 * 60; i++) { g.update(1 / 60); ai.act(g, 1 / 60); pl.act(g, 1 / 60); }
    return JSON.stringify(g.planets.map((p) => [p.owner, p.units])); };
  assert.equal(run(), run());
});

test('unknown personality/difficulty fall back safely', () => {
  const ai = createAI({ owner: 2, personality: 'nonsense', difficulty: 'nope' });
  const g = stubGame(duel()); for (let i = 0; i < 600; i++) { g.update(1 / 60); ai.act(g, 1 / 60); }
});

test('stub: each personality beats a do-nothing player within 4 minutes', () => {
  for (const pers of PERSONALITIES) for (const seed of [1, 2, 3]) {
    const g = stubGame(duel(), seed);
    const ai = createAI({ owner: 2, personality: pers, difficulty: 'normal', rng: createRng(seed) });
    g.ais.push(ai);
    while (g.t < 240 && g.state === 'play') g.update(1 / 30);
    assert.equal(g.state, 'lost', `${pers} seed ${seed} state ${g.state} t=${g.t.toFixed(0)}`);
  }
});

test('stub: AI vs AI is not always a first-mover (owner 1) win', () => {
  const wins = { 1: 0, 2: 0, draw: 0 };
  for (const a of PERSONALITIES) for (const b of PERSONALITIES) for (const seed of [1, 2]) {
    const g = stubGame(duel(), seed);
    g.ais.push(createAI({ owner: 1, personality: a, rng: createRng(seed) }), createAI({ owner: 2, personality: b, rng: createRng(seed + 100) }));
    while (g.t < 240 && g.state === 'play') g.update(1 / 30);
    if (g.state === 'lost') wins[2]++; else if (g.state === 'won') wins[1]++; else wins.draw++;
  }
  assert.ok(wins[2] > 0 && wins[1] > 0, JSON.stringify(wins));
});

// ---- Real game (only when sim-core and levels are present) ----
test('real game: each personality beats do-nothing on generated 1v1 within 4 minutes', { skip: !(HAVE_GAME && HAVE_LEVELS) }, async () => {
  const { createGame } = await import('../src/sim/game.js');
  const { generateLevel } = await import('../src/sim/levels.js');
  const bus = { emit() {}, on() {} };
  for (const pers of PERSONALITIES) for (const seed of [1, 2, 3, 4]) {
    const level = generateLevel(seed, { enemies: 1 }); level.ai = [{ owner: 2, personality: pers }];
    const g = createGame({ seed, bus, level, difficulty: 'normal', ai: true });
    while (g.t < 240 && g.state === 'play') g.update(1 / 30);
    assert.equal(g.state, 'lost', `${pers} seed ${seed}: ${g.state} t=${g.t.toFixed(0)}`);
  }
});

test('real game: AI-vs-AI not always first-mover win', { skip: !(HAVE_GAME && HAVE_LEVELS) }, async () => {
  const { createGame } = await import('../src/sim/game.js');
  const { generateLevel } = await import('../src/sim/levels.js');
  const bus = { emit() {}, on() {} };
  const wins = { 1: 0, 2: 0, draw: 0 };
  for (const a of PERSONALITIES) for (const b of PERSONALITIES) for (const seed of [1, 2]) {
    const level = generateLevel(seed, { enemies: 1 }); level.ai = [{ owner: 2, personality: b }];
    const g = createGame({ seed, bus, level, difficulty: 'normal', ai: true });
    const pl = createAutopilot({ owner: 1, personality: a, rng: createRng(seed * 31) });
    while (g.t < 240 && g.state === 'play') { pl.act(g, 1 / 30); g.update(1 / 30); }
    if (g.state === 'lost') wins[2]++; else if (g.state === 'won') wins[1]++; else wins.draw++;
  }
  assert.ok(wins[2] > 0 && wins[1] > 0, JSON.stringify(wins));
});
