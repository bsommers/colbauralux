import test from 'node:test'; import assert from 'node:assert/strict';
import { LEVELS, generateLevel, validateLevel } from '../src/sim/levels.js';

test('>= 14 campaign levels, all valid', () => {
  assert.ok(LEVELS.length >= 14);
  const names = new Set();
  for (const l of LEVELS) {
    const v = validateLevel(l); assert.ok(v.ok, `${l.id} ${l.name}: ${v.errors.join('; ')}`);
    assert.ok(l.name && l.blurb && l.par > 0, `meta ${l.id}`); names.add(l.name);
  }
  assert.equal(names.size, LEVELS.length);
  assert.deepEqual(LEVELS.map((l) => l.id), LEVELS.map((_, i) => i + 1));
});
test('level 1 is a neutral grab; later levels have 1..3 enemies', () => {
  assert.equal(LEVELS[0].ai.length, 0);
  assert.ok(LEVELS.some((l) => l.ai.length === 3) && LEVELS.some((l) => l.ai.length === 2));
});
test('50 generated seeds validate across configs', () => {
  for (let s = 1; s <= 50; s++) {
    const opts = { enemies: 1 + (s % 3), planets: 7 + (s % 10) };
    const l = generateLevel(s, opts); const v = validateLevel(l);
    assert.ok(v.ok, `seed ${s} ${JSON.stringify(opts)}: ${v.errors.join('; ')}`);
    assert.equal(l.ai.length, opts.enemies);
  }
});
test('default options validate', () => { for (let s = 100; s < 150; s++) assert.ok(validateLevel(generateLevel(s)).ok, `seed ${s}`); });
test('generation is deterministic and seed-sensitive', () => {
  assert.deepEqual(generateLevel(7, { enemies: 2 }), generateLevel(7, { enemies: 2 }));
  assert.notDeepEqual(generateLevel(7), generateLevel(8));
});
test('symmetric fairness: equal strength per side and mirrored neutrals', () => {
  for (let s = 1; s <= 30; s++) {
    const l = generateLevel(s, { enemies: 1 + (s % 3), planets: 9 });
    const tot = {}; for (const p of l.planets) if (p.owner) { tot[p.owner] = tot[p.owner] || [0, 0]; tot[p.owner][0]++; tot[p.owner][1] += p.units; }
    const vals = Object.values(tot).map(String); assert.equal(new Set(vals).size, 1, `seed ${s}`);
    if (l.ai.length === 1) {
      const neu = l.planets.filter((p) => !p.owner);
      for (const p of neu) assert.ok(neu.some((q) => Math.abs(q.x - (960 - p.x)) <= 1 && Math.abs(q.y - (540 - p.y)) <= 1 && q.size === p.size), `mirror ${s}`);
    }
  }
});
test('validateLevel rejects bad levels', () => {
  const base = generateLevel(3);
  const bad = (f) => { const l = JSON.parse(JSON.stringify(base)); f(l); return validateLevel(l).ok; };
  assert.equal(bad((l) => { l.planets[0].x = 5; }), false);
  assert.equal(bad((l) => { l.planets[2].x = l.planets[3].x; l.planets[2].y = l.planets[3].y; }), false);
  assert.equal(bad((l) => { l.planets.forEach((p) => { if (p.owner === 2) p.owner = 0; }); }), false);
  assert.equal(bad((l) => { l.planets.length = 3; }), false);
  assert.equal(bad((l) => { l.planets[0].units += 3; }), false);
  assert.equal(validateLevel({}).ok, false);
});
