import test from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../src/art/vector.js';
import { SPRITES, FACTIONS } from '../src/core/defs.js';

function stub() {
  const calls = []; let ops = 0, blur = 0, depth = 0;
  const target = { calls };
  return new Proxy(target, {
    get(t, k) {
      if (k === 'ops') return () => ops; if (k === 'blurSet') return () => blur; if (k === 'depth') return () => depth;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k in t) return t[k];
      return (...a) => { ops++; if (k === 'save') depth++; if (k === 'restore') depth--; calls.push(k); };
    },
    set(t, k, v) { if (k === 'shadowBlur' && v > 0) blur++; t[k] = v; return true; },
  });
}
const finite = (ctx) => true;

test('every sprite draws and balances save/restore', () => {
  for (const n of SPRITES) { const c = stub(); V.drawSprite(c, n, 10, 10, 0.5, 2, { t: 1 }); assert.ok(c.ops() > 0, n); assert.equal(c.depth(), 0, n); assert.ok(V.spriteRadius(n) > 0); }
});
test('drawShip is cheap, glow-free, per owner', () => {
  for (const o of [1, 2, 3, 4]) { const c = stub(); V.drawShip(c, o, 5, 5, 1, 0.3); assert.ok(c.ops() <= 24, `ops ${c.ops()}`); assert.equal(c.blurSet(), 0); assert.equal(c.depth(), 0); }
});
test('drawPlanet all owners/levels/sizes', () => {
  for (const owner of [0, 1, 2, 3, 4]) for (const level of [0, 1, 2]) for (const size of [1, 2, 3]) {
    const c = stub(); V.drawPlanet(c, { id: 3, x: 100, y: 100, r: [0, 22, 32, 44][size], size, owner, level, units: 30 }, 1.2, { selected: true, hover: true, targeted: true, flash: 1 });
    assert.ok(c.ops() > 20); assert.equal(c.depth(), 0);
  }
  const c = stub(); V.drawPlanet(c, { id: 1, x: 0, y: 0, r: 22, owner: 0, level: 0, units: 0 }, 0); assert.ok(c.ops() > 0);
});
test('ui helpers + portrait + logo + badge', () => {
  for (const f of [(c) => V.drawSelectRing(c, 1, 1, 20, 0), (c) => V.drawSendArrow(c, [[0, 0], [50, 50], { x: 80, y: 20 }], 1, '#fff'),
    (c) => V.drawSendArrow(c, [[0, 0]], 1), (c) => V.drawColbyPortrait(c, 5, 5, 1, 1), (c) => V.drawLogo(c, 480, 60, 1),
    ...FACTIONS.map((_, i) => (c) => V.drawFactionBadge(c, i, 10, 10, 1))]) { const c = stub(); f(c); assert.equal(c.depth(), 0); }
});
