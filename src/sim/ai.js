// Enemy AI (ARCHITECTURE §6). Sees only what a player sees: planets, ships, their owners/units.
import { TUNING, DIFFICULTY, DEFAULT_DIFFICULTY, PERSONALITIES } from '../core/defs.js';
import { createRng } from '../core/rng.js';

const SIZE_VAL = [0, 1, 1.5, 2.2];

// Per-personality knobs.
const P = {
  rusher:   { reserve: 0.08, minKeep: 2, margin: 0.05, frac: 0.7,  neutW: 0.7, enemW: 1.6, actions: 3, defend: false, aheadToAttack: 0,   range: 1e9, avoidFleet: false },
  turtle:   { reserve: 0.35, minKeep: 4, margin: 0.25, frac: 1,    neutW: 1.3, enemW: 1.0, actions: 2, defend: true,  aheadToAttack: 1.5, range: 460, avoidFleet: true },
  expander: { reserve: 0.15, minKeep: 3, margin: 0.2,  frac: 1,    neutW: 2.4, enemW: 0.9, actions: 3, defend: true,  aheadToAttack: 1.1, range: 1e9, avoidFleet: false },
  balanced: { reserve: 0.2,  minKeep: 3, margin: 0.15, frac: 1,    neutW: 1.5, enemW: 1.3, actions: 2, defend: true,  aheadToAttack: 0.9, range: 1e9, avoidFleet: false },
  sniper:   { reserve: 0.15, minKeep: 3, margin: 0.04, frac: 1,    neutW: 1.5, enemW: 1.2, actions: 3, defend: true,  aheadToAttack: 0,   range: 1e9, avoidFleet: true },
};

function resolveDifficulty(d) {
  if (d && typeof d === 'object') return d;
  return DIFFICULTY.find((x) => x.id === d) || DIFFICULTY.find((x) => x.id === DEFAULT_DIFFICULTY) || DIFFICULTY[1];
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const planetProd = (p) => (TUNING.prod[p.level] || 0) * (TUNING.sizeProd[p.size] || 0);

export function createAI({ owner, personality = 'balanced', difficulty, rng } = {}) {
  if (!PERSONALITIES.includes(personality)) personality = 'balanced';
  const cfg = P[personality];
  const diff = resolveDifficulty(difficulty);
  const r = rng && typeof rng.next === 'function' ? (rng.fork ? rng.fork() : rng) : createRng(1000 + (owner | 0) * 7919);
  const period = 0.9 / (diff.aiRate || 1);
  let timer = r.range(0.2, 1.0) * period; // staggered first decision

  function decide(g) {
    const planets = g.planets;
    const mine = [];
    const others = [];
    for (const p of planets) (p.owner === owner ? mine : others).push(p);
    if (!mine.length) return;

    // Ships in flight, by target planet.
    const friendTo = new Map();
    const hostileTo = new Map();      // hostile ships heading to each planet, keyed by target
    const hostileNear = new Map();    // enemy ship counts near a planet (<130px), any destination
    for (const s of g.ships) {
      if (s.dead) continue;
      const m = s.owner === owner ? friendTo : hostileTo;
      m.set(s.to, (m.get(s.to) || 0) + 1);
    }
    let enemyShips = 0, myShips = 0;
    for (const s of g.ships) { if (s.dead) continue; if (s.owner === owner) myShips++; else enemyShips++; }
    for (const p of others) {
      if (p.owner === 0) continue;
      let c = 0;
      for (const s of g.ships) if (!s.dead && s.owner !== owner && s.owner === p.owner && dist(s, p) < 130) c++;
      hostileNear.set(p.id, c);
    }

    let myUnits = myShips, enemyUnits = enemyShips;
    for (const p of planets) { if (p.owner === owner) myUnits += p.units; else if (p.owner !== 0) enemyUnits += p.units; }
    const ahead = enemyUnits > 0 ? myUnits / enemyUnits : 9;
    const hasEnemy = others.some((p) => p.owner !== 0 && p.owner !== owner);

    // Spendable units per own planet.
    const used = new Set();
    const avail = new Map();
    const threat = new Map();
    for (const p of mine) {
      const inc = (hostileTo.get(p.id) || 0) - (friendTo.get(p.id) || 0);
      threat.set(p.id, Math.max(0, inc));
      const keep = Math.max(cfg.minKeep, Math.ceil(p.units * cfg.reserve), Math.max(0, inc) + (inc > 0 ? 2 : 0));
      avail.set(p.id, Math.max(0, p.units - keep));
    }

    const send = (src, to, take) => {
      const p = src;
      const n = Math.min(take, p.units);
      if (n < 1) return 0;
      const pct = Math.min(1, (n + 0.01) / p.units);
      const q = g.sendAs(owner, [p.id], to.id, pct);
      avail.set(p.id, Math.max(0, avail.get(p.id) - n));
      used.add(p.id);
      return q || 0;
    };

    let actions = 0;

    // 1. Defence: reinforce own planets that will fall to inbound ships.
    if (cfg.defend) {
      for (const p of mine) {
        const inc = (hostileTo.get(p.id) || 0) - (friendTo.get(p.id) || 0);
        if (inc <= p.units) continue;
        let want = inc - p.units + 3;
        const helpers = mine.filter((q) => q !== p && !used.has(q.id) && avail.get(q.id) > 0).sort((a, b) => dist(a, p) - dist(b, p));
        for (const h of helpers) {
          if (want <= 0) break;
          const take = Math.min(avail.get(h.id), want);
          if (take >= 1) { send(h, p, take); want -= take; }
        }
      }
    }

    // 2. Offence / expansion.
    const cands = [];
    for (const t of others) {
      if (t.owner !== 0 && !hasEnemy) continue;
      const isNeutral = t.owner === 0;
      if (!isNeutral && ahead < cfg.aheadToAttack && personality !== 'rusher') {
        // behind: only pick off weak planets
        if (t.units > 6) continue;
      }
      let nearest = 1e9, cx = 0, cy = 0;
      for (const m of mine) { const d = dist(m, t); if (d < nearest) nearest = d; cx += m.x; cy += m.y; }
      if (nearest > cfg.range) continue;
      const travel = Math.max(0, nearest - t.r) / TUNING.shipSpeed;
      let need = t.units + (isNeutral ? 0 : planetProd(t) * (t.owner > 1 ? (diff.aiProd || 1) : 1) * travel);
      need += (isNeutral ? 0 : (hostileTo.get(t.id) || 0) * 0); // enemy reinforcements are already in t.units on arrival; ignore
      if (!isNeutral) need += 0;
      need = need * (1 + cfg.margin) + 2 - (friendTo.get(t.id) || 0);
      if (need <= 0) continue;
      if (cfg.avoidFleet && !isNeutral && (hostileNear.get(t.id) || 0) > 14) continue;
      const value = SIZE_VAL[t.size] * (isNeutral ? cfg.neutW : cfg.enemW);
      const score = value / (need + 6) / (1 + nearest / 260);
      cands.push({ t, need, score, nearest });
    }
    if (personality === 'rusher') cands.sort((a, b) => a.nearest + a.need * 2 - (b.nearest + b.need * 2) || b.score - a.score);
    else cands.sort((a, b) => b.score - a.score);

    for (const c of cands) {
      if (actions >= cfg.actions) break;
      const srcs = mine.filter((m) => !used.has(m.id) && avail.get(m.id) >= 1)
        .sort((a, b) => dist(a, c.t) - dist(b, c.t));
      let total = 0;
      for (const s of srcs) total += avail.get(s.id);
      if (total < c.need * cfg.frac) continue;
      let left = Math.min(c.need, total);
      if (personality === 'rusher') left = total; // big wave
      let sent = 0;
      for (const s of srcs) {
        if (left <= 0) break;
        const take = Math.min(avail.get(s.id), Math.ceil(left));
        sent += send(s, c.t, take);
        left -= take;
      }
      if (sent > 0) actions++;
    }

    // 3. Capped planets waste production: push surplus to the most useful friendly planet (front line / near level-up).
    for (const p of mine) {
      if (used.has(p.id)) continue;
      const cap = TUNING.cap[p.level];
      if (p.units < cap * 0.9 || avail.get(p.id) < 5) continue;
      let best = null, bs = -1e9;
      for (const q of mine) {
        if (q === p) continue;
        let near = 1e9;
        for (const e of others) if (e.owner !== 0 || true) near = Math.min(near, dist(q, e));
        const room = TUNING.cap[q.level] - q.units;
        if (room < 4) continue;
        const s = -near + room * 2 - dist(p, q) * 0.3;
        if (s > bs) { bs = s; best = q; }
      }
      if (best) send(p, best, Math.floor(avail.get(p.id) * 0.6));
    }
  }

  return {
    owner, personality,
    act(g, dt = 1 / 60) {
      timer -= dt;
      if (timer > 0) return;
      timer += period * r.range(0.8, 1.25);
      if (timer < 0.05) timer = 0.05;
      decide(g);
    },
  };
}
