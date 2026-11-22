import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput, planetAt } from '../src/core/input.js';
import { loadSettings, saveSettings, sanitizeSettings, starsFor, recordClear, isUnlocked, loadProgress, saveProgress } from '../src/core/settings.js';
import { createMenu, menuAction } from '../src/ui/menus.js';
import { createHud, drawHud } from '../src/ui/hud.js';
import { createScreens } from '../src/ui/screens.js';
import { createBus } from '../src/core/events.js';

function fakeTarget() {
  const m = new Map();
  return { addEventListener(ev, fn) { (m.get(ev) || m.set(ev, []).get(ev)).push(fn); }, removeEventListener(ev, fn) { m.set(ev, (m.get(ev) || []).filter((f) => f !== fn)); },
    emit(ev, e) { for (const f of m.get(ev) || []) f({ preventDefault() {}, ...e }); } };
}
function fakeGame() {
  const planets = [{ id: 0, x: 100, y: 100, r: 30, owner: 1 }, { id: 1, x: 300, y: 100, r: 30, owner: 1 }, { id: 2, x: 500, y: 100, r: 30, owner: 0 }, { id: 3, x: 300, y: 300, r: 30, owner: 2 }];
  const g = { state: 'play', planets, sendPct: 0.5, sent: [], send(from, to) { this.sent.push({ from: [...from], to }); return from.length; } };
  return g;
}
function setup(over = {}) {
  const canvas = fakeTarget(), keys = fakeTarget(), g = fakeGame();
  let t = 1000;
  const inp = createInput(canvas, { getGame: () => g, keyTarget: keys, now: () => t, ...over });
  const ptr = (type, x, y, id = 1) => canvas.emit(type, { pointerId: id, clientX: x, clientY: y, button: 0, pointerType: 'touch' });
  return { canvas, keys, g, inp, ptr, tick: (ms) => { t += ms; } };
}

test('swipe from own planet across another own planet to enemy sends both', () => {
  const { g, inp, ptr } = setup();
  ptr('pointerdown', 100, 100);
  for (let x = 110; x <= 300; x += 20) ptr('pointermove', x, 100);
  assert.deepEqual([...inp.ui.selection].sort(), [0, 1]);
  assert.ok(inp.ui.dragPath.length > 3);
  ptr('pointermove', 300, 250);
  ptr('pointermove', 300, 300);
  assert.equal(inp.ui.target, 3);
  ptr('pointerup', 300, 300);
  assert.deepEqual(g.sent, [{ from: [0, 1], to: 3 }]);
  assert.equal(inp.ui.selection.size, 0);
  assert.equal(inp.ui.dragPath, null);
});

test('release on empty space cancels', () => {
  const { g, inp, ptr } = setup();
  ptr('pointerdown', 100, 100); ptr('pointermove', 200, 200); ptr('pointermove', 400, 400); ptr('pointerup', 400, 400);
  assert.equal(g.sent.length, 0);
  assert.equal(inp.ui.selection.size, 0);
});

test('tap own planet selects, tap other planet sends', () => {
  const { g, inp, ptr } = setup();
  ptr('pointerdown', 100, 100); ptr('pointerup', 100, 100);
  assert.deepEqual([...inp.ui.selection], [0]);
  ptr('pointerdown', 500, 100); ptr('pointerup', 500, 100);
  assert.deepEqual(g.sent, [{ from: [0], to: 2 }]);
  assert.equal(inp.ui.selection.size, 0);
});

test('tap selected planet again deselects', () => {
  const { g, inp, ptr } = setup();
  ptr('pointerdown', 100, 100); ptr('pointerup', 100, 100);
  ptr('pointerdown', 100, 100); ptr('pointerup', 100, 100);
  assert.equal(inp.ui.selection.size, 0); assert.equal(g.sent.length, 0);
});

test('swipe starting on enemy/neutral selects nothing', () => {
  const { g, inp, ptr } = setup();
  ptr('pointerdown', 500, 100); ptr('pointermove', 300, 100); ptr('pointermove', 100, 100); ptr('pointerup', 100, 100);
  assert.equal(g.sent.length, 0); assert.equal(inp.ui.selection.size, 0);
});

test('multi-touch: second pointer ignored while a swipe is active', () => {
  const { g, inp, ptr } = setup();
  ptr('pointerdown', 100, 100, 1);
  ptr('pointerdown', 300, 100, 2); ptr('pointermove', 300, 100, 2); ptr('pointerup', 300, 100, 2);
  assert.deepEqual([...inp.ui.selection], [0]);
  ptr('pointermove', 400, 100, 1); ptr('pointerup', 500, 100, 1);
  assert.deepEqual(g.sent, [{ from: [0], to: 2 }]);
});

test('double-tap on empty space selects all own planets; escape clears', () => {
  const { inp, ptr, tick, keys } = setup();
  ptr('pointerdown', 700, 400); ptr('pointerup', 700, 400); tick(100);
  ptr('pointerdown', 702, 402); ptr('pointerup', 702, 402);
  assert.deepEqual([...inp.ui.selection].sort(), [0, 1]);
  keys.emit('keydown', { code: 'Escape' });
  assert.equal(inp.ui.selection.size, 0);
});

test('keys: A selects all, digits set send pct, space pauses, esc with empty selection = back', () => {
  const { inp, keys } = setup();
  const acts = []; inp.onAction((a) => acts.push(a));
  keys.emit('keydown', { code: 'KeyA' });
  assert.equal(inp.ui.selection.size, 2);
  keys.emit('keydown', { code: 'Digit3' });
  keys.emit('keydown', { code: 'Space' });
  keys.emit('keydown', { code: 'Escape' }); keys.emit('keydown', { code: 'Escape' });
  assert.deepEqual(acts.filter((a) => a !== 'all'), [{ sendPct: 0.75 }, 'pause', 'back']);
});

test('selection prunes planets that changed owner', () => {
  const { g, inp, ptr } = setup();
  ptr('pointerdown', 100, 100); ptr('pointerup', 100, 100);
  g.planets[0].owner = 2;
  assert.equal(inp.poll().selection.size, 0);
});

test('disabled input forwards clicks as actions and never sends', () => {
  const { g, inp, ptr } = setup({ enabled: false });
  const acts = []; inp.onAction((a) => acts.push(a));
  ptr('pointerdown', 100, 100); ptr('pointerup', 100, 100);
  assert.deepEqual(acts, [{ click: { x: 100, y: 100 } }]); assert.equal(g.sent.length, 0);
});

test('planetAt picks nearest within slack', () => {
  const g = fakeGame();
  assert.equal(planetAt(g, 133, 100).id, 0);
  assert.equal(planetAt(g, 200, 100), null);
});

test('settings: sanitize, roundtrip, bad json', () => {
  const mem = {}; const st = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  assert.equal(loadSettings(st).difficulty, 'normal');
  assert.equal(saveSettings({ master: 5, difficulty: 'nine', sendPct: 0.75, crt: false }, st), true);
  const s = loadSettings(st);
  assert.equal(s.master, 1); assert.equal(s.difficulty, 'nine'); assert.equal(s.sendPct, 0.75); assert.equal(s.crt, false);
  mem['colbauralux.settings'] = '{bad';
  assert.equal(loadSettings(st).master, 0.8);
  assert.equal(sanitizeSettings({ difficulty: 'x', sendPct: 3 }).sendPct, 0.5);
});

test('progress: stars, best time, unlocks', () => {
  assert.equal(starsFor(50, 60), 3); assert.equal(starsFor(80, 60), 2); assert.equal(starsFor(200, 60), 1);
  const lv = [{ id: 1, par: 60 }, { id: 2, par: 60 }, { id: 3, par: 60 }];
  let p = loadProgress({ getItem: () => null });
  assert.equal(isUnlocked(p, lv, 0), true); assert.equal(isUnlocked(p, lv, 1), false);
  let r = recordClear(p, lv[0], 80); assert.equal(r.stars, 2); assert.ok(r.best);
  r = recordClear(r.progress, lv[0], 100); assert.ok(!r.best); assert.equal(r.progress.cleared[1].time, 80);
  r = recordClear(r.progress, lv[0], 30); assert.equal(r.progress.cleared[1].stars, 3);
  assert.equal(isUnlocked(r.progress, lv, 1), true); assert.equal(isUnlocked(r.progress, lv, 2), false);
  const mem = {}; const st = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  saveProgress(r.progress, st); assert.equal(loadProgress(st).cleared[1].time, 30);
});

test('menus move/select', () => {
  let hit = 0; const m = createMenu([{ label: 'A', act: () => hit++ }, { label: 'B', act: () => (hit += 10) }]);
  menuAction(m, 'down'); menuAction(m, 'select'); assert.equal(hit, 10);
  menuAction(m, 'down'); assert.equal(m.sel, 0);
});
