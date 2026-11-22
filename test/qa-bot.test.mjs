import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { runOne } from '../tools/botplay.mjs';
import { LEVELS } from '../src/sim/levels.js';

test('runOne is deterministic and finite', () => {
  const a = runOne(LEVELS[0], 'normal', 1, { maxSeconds: 60 });
  const b = runOne(LEVELS[0], 'normal', 1, { maxSeconds: 60 });
  assert.equal(a.winner, b.winner); assert.equal(a.time, b.time); assert.equal(a.peak, b.peak);
  assert.equal(a.bad, false); assert.ok(a.msStep >= 0);
});
test('level 1 is won by the autopilot', () => {
  assert.equal(runOne(LEVELS[0], 'normal', 2, { maxSeconds: 120 }).winner, 'player');
});
test('cli --json emits one row per level x diff', () => {
  const out = execFileSync('node', ['tools/botplay.mjs', '--levels', '1-2', '--diffs', 'normal,hard', '--seeds', '1', '--json', '--maxSeconds', '90'], { cwd: new URL('..', import.meta.url).pathname }).toString();
  const rows = JSON.parse(out);
  assert.equal(rows.length, 4);
  for (const r of rows) assert.ok(['player', 'ai', 'mixed', 'timeout'].includes(r.winner));
});
