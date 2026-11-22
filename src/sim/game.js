// Colbauralux simulation core (ARCHITECTURE.md §4/§5). No DOM, randomness only from g.rng.
import { W, H, PLAYER, TUNING, DIFFICULTY, DEFAULT_DIFFICULTY } from '../core/defs.js';
import { createRng } from '../core/rng.js';
import { createBus } from '../core/events.js';
import { createGrid } from './spatial.js';

let createAI = null;
try { ({ createAI } = await import('./ai.js')); } catch { createAI = null; }

const diffOf = (id) => DIFFICULTY.find((d) => d.id === id) || DIFFICULTY.find((d) => d.id === DEFAULT_DIFFICULTY) || DIFFICULTY[1];
const OWNER_COLOR = { 1: '#ff9a1f', 2: '#b05cff', 3: '#35e0ff', 4: '#ff3b3b' };

export function createGame(opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const bus = opts.bus || createBus();
  const level = JSON.parse(JSON.stringify(opts.level || { id: 'empty', name: '', planets: [], ai: [] }));
  const baseDiff = diffOf(opts.difficulty);
  const rng = createRng(seed);
  const ownerDiff = {};
  for (const a of level.ai || []) ownerDiff[a.owner] = (a.difficulty && opts.difficulty == null) ? diffOf(a.difficulty) : baseDiff;
  const diffFor = (owner) => ownerDiff[owner] || baseDiff;

  const planets = (level.planets || []).map((p, id) => ({
    id, x: p.x, y: p.y, size: p.size, r: TUNING.planetR[p.size],
    owner: p.owner | 0, units: Math.max(0, Math.floor(p.units ?? 0)), level: p.level | 0,
    gen: 0, flash: 0, queue: [], _la: 0,
  }));
  for (const p of planets) p.gen = p.owner > 0 ? rng.next() * 0.99 : 0;

  const g = {
    t: 0, state: 'play', planets, ships: [], rng, bus, level, sendPct: opts.sendPct ?? TUNING.defaultSendPct,
    difficulty: baseDiff, ais: [], seed,
    stats: { time: 0, kills: { 1: 0, 2: 0, 3: 0, 4: 0 }, losses: 0, captured: 0, lost: 0, peakShips: 0 },
  };
  let nextShipId = 1;
  const hadEnemy = planets.some((p) => p.owner >= 2) || (level.ai || []).length > 0;
  let hitFxAt = -1, hitSfxAt = -1, scoreAt = 0, tauntDone = false;
  const grid = createGrid(TUNING.fightR * 2, W, H);

  const emit = (t, p) => bus.emit(t, p);
  const fx = (type, x, y, o) => emit('fx', o ? { type, x, y, opts: o } : { type, x, y });

  // ---- AI ----
  if (opts.ai !== false && createAI) {
    for (const a of level.ai || []) {
      try {
        g.ais.push(createAI({ owner: a.owner, personality: a.personality, difficulty: diffFor(a.owner),
          rng: createRng((seed + a.owner * 977) >>> 0) }));
      } catch { /* AI failed to construct: that owner stays passive */ }
    }
  }

  // ---- commands ----
  g.setSendPct = (p) => { g.sendPct = Math.min(1, Math.max(0.01, p)); };
  g.sendAs = (owner, fromIds, toId, pct) => {
    if (g.state !== 'play') return 0;
    const to = planets[toId];
    if (!to) return 0;
    const f = pct ?? g.sendPct;
    let total = 0;
    for (const id of fromIds || []) {
      const p = planets[id];
      if (!p || p.owner !== owner || id === toId || p.units < 1) continue;
      const n = Math.min(p.units, Math.max(1, Math.floor(p.units * f)));
      p.units -= n;
      p.queue.push({ to: toId, owner, n });
      total += n;
      emit('launch', { from: id, to: toId, owner, n });
    }
    if (total > 0 && owner === PLAYER) emit('sfx', { name: 'send', x: to.x, y: to.y });
    return total;
  };
  g.send = (fromIds, toId, pct) => g.sendAs(PLAYER, fromIds, toId, pct);

  // ---- helpers ----
  function checkLevelUp(p) {
    while (p.level < TUNING.levelUpAt.length && p.units >= TUNING.levelUpAt[p.level]) {
      p.level++;
      emit('levelup', { id: p.id, level: p.level });
      emit('sfx', { name: 'levelup', x: p.x, y: p.y });
      fx('levelup', p.x, p.y, { color: OWNER_COLOR[p.owner], r: p.r });
      emit('popup', { text: 'LEVEL ' + (p.level + 1), x: p.x, y: p.y - p.r - 8, color: OWNER_COLOR[p.owner] });
    }
  }
  function capture(p, owner) {
    const prev = p.owner;
    p.owner = owner; p.units = TUNING.captureStartUnits; p.level = 0; p.gen = 0; p.queue.length = 0; p._la = 0;
    p.flash = 1;
    if (owner === PLAYER) g.stats.captured++;
    if (prev === PLAYER) g.stats.lost++;
    emit('planet', { id: p.id, owner, prev });
    const name = owner === PLAYER ? (prev === 0 ? 'neutral_capture' : 'capture') : (prev === PLAYER ? 'lost' : 'capture');
    emit('sfx', { name, x: p.x, y: p.y });
    fx('capture', p.x, p.y, { color: OWNER_COLOR[owner], r: p.r });
    emit('shake', { mag: prev === PLAYER || owner === PLAYER ? 4 : 2, dur: 0.2 });
    if (owner === PLAYER) emit('popup', { text: prev === 0 ? 'CLAIMED!' : 'CAPTURED!', x: p.x, y: p.y - p.r - 8, color: OWNER_COLOR[1] });
  }
  function arrive(s, p) {
    if (s.owner === p.owner) {
      if (p.units < TUNING.cap[p.level]) { p.units++; checkLevelUp(p); }
    } else if (p.units > 0) {
      p.units--; p.flash = 1;
      if (s.owner === PLAYER) g.stats.losses++;
      if (g.t - hitFxAt >= 0.04) { hitFxAt = g.t; fx('spark', s.x, s.y, { color: OWNER_COLOR[s.owner], n: 4 }); }
      emit('hit', { x: s.x, y: s.y, owner: s.owner });
      if (g.t - hitSfxAt >= 0.05) { hitSfxAt = g.t; emit('sfx', { name: 'hit', x: s.x, y: s.y }); }
    } else {
      capture(p, s.owner);
    }
  }
  function spawn(p, q) {
    const tp = planets[q.to];
    const base = Math.atan2(tp.y - p.y, tp.x - p.x);
    const a = base + (rng.next() - 0.5) * 0.5;
    const x = p.x + Math.cos(a) * (p.r + 1), y = p.y + Math.sin(a) * (p.r + 1);
    const dx = tp.x - x, dy = tp.y - y, d = Math.hypot(dx, dy) || 1;
    g.ships.push({ id: nextShipId++, owner: q.owner, x, y, vx: dx / d * TUNING.shipSpeed, vy: dy / d * TUNING.shipSpeed, to: q.to, t: 0, dead: false });
  }

  // ---- step ----
  g.update = (dtIn) => {
    if (g.state !== 'play') return;
    const dt = Math.min(dtIn, 1 / 30);
    g.t += dt; g.stats.time = g.t;

    if (!tauntDone) {
      tauntDone = true;
      const tt = level.taunt;
      if (tt) {
        const o = typeof tt === 'object' ? tt : {};
        emit('taunt', { text: typeof tt === 'string' ? tt : (o.text || ''), dur: o.dur || 4, owner: o.owner ?? (level.ai?.[0]?.owner ?? 2) });
      }
    }
    for (const a of g.ais) a.act(g, dt);

    // production, flash, queue drain
    for (const p of planets) {
      if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 4);
      if (p.owner > 0) {
        const cap = TUNING.cap[p.level];
        p.gen += TUNING.prod[p.level] * TUNING.sizeProd[p.size] * (p.owner > 1 ? diffFor(p.owner).aiProd : 1) * dt;
        while (p.gen >= 1) {
          p.gen -= 1;
          if (p.units < cap) { p.units++; } else { p.gen = 0; break; }
        }
        checkLevelUp(p);
      }
      if (p.queue.length) {
        p._la += TUNING.launchPerSec * dt;
        while (p._la >= 1 && p.queue.length && g.ships.length < TUNING.maxShips) {
          const q = p.queue[0];
          if (q.owner !== p.owner) { p.queue.length = 0; break; }
          spawn(p, q);
          p._la -= 1;
          if (--q.n <= 0) p.queue.shift();
        }
        if (!p.queue.length) p._la = 0;
        else if (g.ships.length >= TUNING.maxShips) p._la = Math.min(p._la, 1);
      }
    }

    // move + arrivals
    const ships = g.ships;
    for (let i = 0; i < ships.length; i++) {
      const s = ships[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt;
      const p = planets[s.to];
      const dx = p.x - s.x, dy = p.y - s.y;
      if (dx * dx + dy * dy <= p.r * p.r) { s.dead = true; arrive(s, p); }
    }

    // combat via grid
    grid.clear();
    for (let i = 0; i < ships.length; i++) if (!ships[i].dead) grid.insert(ships[i]);
    let me = null, best = null, bestD = 0;
    const visit = (o) => {
      if (o.dead || o.owner === me.owner || o === me) return;
      const dx = o.x - me.x, dy = o.y - me.y, d = dx * dx + dy * dy;
      if (best === null || d < bestD || (d === bestD && o.id < best.id)) { best = o; bestD = d; }
    };
    for (let i = 0; i < ships.length; i++) {
      const s = ships[i];
      if (s.dead) continue;
      me = s; best = null;
      grid.query(s.x, s.y, TUNING.fightR, visit);
      if (best) {
        s.dead = true; best.dead = true;
        g.stats.kills[s.owner]++; g.stats.kills[best.owner]++;
        if (s.owner === PLAYER || best.owner === PLAYER) g.stats.losses++;
        const mx = (s.x + best.x) / 2, my = (s.y + best.y) / 2;
        emit('hit', { x: mx, y: my, owner: s.owner });
        if (g.t - hitFxAt >= 0.04) { hitFxAt = g.t; fx('spark', mx, my, { color: OWNER_COLOR[s.owner], n: 5 }); }
        if (g.t - hitSfxAt >= 0.05) { hitSfxAt = g.t; emit('sfx', { name: 'hit', x: mx, y: my }); }
      }
    }

    // compact, count
    let w = 0, mine = 0, enemy = 0;
    for (let i = 0; i < ships.length; i++) {
      const s = ships[i];
      if (s.dead) continue;
      ships[w++] = s;
      if (s.owner === PLAYER) mine++; else if (s.owner >= 2) enemy++;
    }
    ships.length = w;
    if (mine > g.stats.peakShips) g.stats.peakShips = mine;

    // win / lose
    let pPlayer = 0, pEnemy = 0, pNeutral = 0;
    for (const p of planets) { if (p.owner === PLAYER) pPlayer++; else if (p.owner >= 2) pEnemy++; else pNeutral++; }
    let next = 'play';
    if (pPlayer === 0 && mine === 0) next = 'lost';
    else if (hadEnemy ? (pEnemy === 0 && enemy === 0) : pNeutral === 0) next = 'won';
    if (next !== 'play') {
      g.state = next;
      const win = next === 'won';
      emit('state', { state: next });
      emit('score', { ...g.stats, kills: { ...g.stats.kills } });
      emit('music', { name: win ? 'victory' : 'defeat' });
      emit('sfx', { name: win ? 'win' : 'lose' });
      emit('banner', { text: win ? 'CHEESE-TASTIC!' : 'CAT-ASTROPHE!', sub: win ? 'All the cheese is yours' : 'The rats got the cheese', dur: 3 });
      emit('flash', { color: win ? '#ffd23f' : '#ff3b3b', a: 0.4, dur: 0.6 });
    } else if (g.t - scoreAt >= 1) {
      scoreAt = g.t;
      emit('score', { ...g.stats, kills: { ...g.stats.kills } });
    }
  };

  return g;
}
