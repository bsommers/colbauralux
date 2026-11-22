// Input: pointer swipe-select + keyboard -> selection/sends (ARCHITECTURE.md §10). Node-importable (no DOM at import time).
// createInput(canvas, { toLogical, getGame, keyTarget?, hudHit?, enabled? }) -> { ui, poll(), onAction(fn), setEnabled(b), clear(), dispose() }
//   ui = { selection:Set<id>, hover:id|null, target:id|null, dragPath:[{x,y}]|null }   (live object, same one the renderer reads)
//   poll() -> frameState { selection, hover, target, dragPath, dragging, sendPct }
// Discrete actions to onAction listeners: 'up' 'down' 'left' 'right' 'select' 'back' 'pause' 'speed' 'restart' 'next' 'mute' 'crt'
//   'all' 'clear' 'fullscreen', { sendPct: 0.25.. }, { click:{x,y} } (pointer press while disabled / on a HUD button), { hud: action }.
import { PLAYER, TUNING } from './defs.js';

export const KEYMAP = Object.freeze({
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'select', NumpadEnter: 'select',
  Space: 'pause', KeyP: 'pause', KeyF: 'speed', KeyR: 'restart', KeyN: 'next', KeyM: 'mute', KeyC: 'crt', KeyA: 'all', KeyV: 'fullscreen',
});
export const TAP_MOVE = 8, DOUBLE_TAP_MS = 350, HIT_SLACK = 8, PATH_MAX = 96;

/** Planet under (x,y) with slack (px), nearest centre wins; null if none. */
export function planetAt(game, x, y, slack = HIT_SLACK) {
  let best = null, bd = Infinity;
  for (const p of (game && game.planets) || []) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= p.r + slack && d < bd) { best = p; bd = d; }
  }
  return best;
}

export function createInput(canvas, opts = {}) {
  const toLogical = opts.toLogical || ((x, y) => ({ x, y }));
  const getGame = opts.getGame || (() => null);
  const hudHit = opts.hudHit || null;
  const now = opts.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const ui = { selection: new Set(), hover: null, target: null, dragPath: null };
  const listeners = new Set();
  const cleanups = [];
  let enabled = opts.enabled !== false;
  let drag = null; // { id, start:{x,y}, moved, fromId|null, onOwn }
  let lastTap = null; // { t, x, y }
  const fire = (a) => { for (const fn of [...listeners]) { try { fn(a); } catch (e) { console.error(e); } } };
  const on = (el, ev, fn, o) => { if (el && el.addEventListener) { el.addEventListener(ev, fn, o); cleanups.push(() => el.removeEventListener && el.removeEventListener(ev, fn, o)); } };
  const playing = () => { const g = getGame(); return enabled && g && g.state === 'play' ? g : null; };
  const own = (p) => p && p.owner === PLAYER;

  function prune(g) {
    for (const id of [...ui.selection]) { const p = g && g.planets[id]; if (!own(p)) ui.selection.delete(id); }
    if (ui.target != null && !(g && g.planets[ui.target])) ui.target = null;
  }
  function endDrag() { drag = null; ui.dragPath = null; ui.target = null; }
  function clear() { ui.selection.clear(); endDrag(); }
  function selectAll() { const g = getGame(); if (!g) return; ui.selection.clear(); for (const p of g.planets) if (own(p)) ui.selection.add(p.id); }
  function sendTo(g, id) {
    if (!ui.selection.size) return 0;
    const from = [...ui.selection];
    const n = g.send(from, id);
    ui.selection.clear();
    return n || 0;
  }

  function pos(e) { return toLogical(e.clientX, e.clientY); }

  function down(e) {
    if (e.button !== undefined && e.button > 0 && e.pointerType === 'mouse') return;
    const pt = pos(e);
    if (hudHit) { const a = hudHit(pt.x, pt.y); if (a) { fire({ hud: a }); e.preventDefault && e.preventDefault(); return; } }
    const g = playing();
    if (!g) { fire({ click: pt }); e.preventDefault && e.preventDefault(); return; }
    if (drag) return; // another pointer is already driving a gesture (multi-touch safe)
    prune(g);
    const p = planetAt(g, pt.x, pt.y);
    drag = { id: e.pointerId, start: pt, moved: false, fromId: p ? p.id : null, startedOnOwn: own(p), wasSel: ui.selection.size > 0 };
    ui.dragPath = [pt];
    ui.hover = p ? p.id : null;
    if (own(p)) ui.selection.add(p.id);
    try { canvas && canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault && e.preventDefault();
  }
  function move(e) {
    const pt = pos(e);
    const g = getGame();
    if (g && (!drag || drag.id === e.pointerId)) { const h = planetAt(g, pt.x, pt.y); ui.hover = h ? h.id : null; }
    if (!drag || drag.id !== e.pointerId) return;
    const gg = playing();
    if (!gg) { endDrag(); return; }
    if (!drag.moved && Math.hypot(pt.x - drag.start.x, pt.y - drag.start.y) > TAP_MOVE) drag.moved = true;
    const path = ui.dragPath, last = path[path.length - 1];
    if (Math.hypot(pt.x - last.x, pt.y - last.y) >= 4) { path.push(pt); if (path.length > PATH_MAX) path.splice(1, path.length - PATH_MAX); }
    // swipe selects every own planet it passes over (only when the swipe began on an own planet)
    const p = planetAt(gg, pt.x, pt.y);
    if (drag.startedOnOwn && own(p) && drag.moved) ui.selection.add(p.id);
    ui.target = drag.moved && p ? p.id : null;
    e.preventDefault && e.preventDefault();
  }
  function up(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const pt = pos(e), g = playing(), d = drag;
    endDrag();
    if (!g) return;
    prune(g);
    const p = planetAt(g, pt.x, pt.y);
    const t = now();
    if (d.moved) {
      // swipe: release on any planet sends the selection; on empty space it cancels
      if (p && ui.selection.size) { const n = sendTo(g, p.id); fire({ sent: n, to: p.id }); }
      else clear();
      lastTap = null;
      return;
    }
    // tap
    if (p) {
      if (own(p) && !d.wasSel) { /* selected on press; stays selected */ }
      else if (own(p) && ui.selection.size === 1 && ui.selection.has(p.id) && d.wasSel) ui.selection.delete(p.id); // tap selected planet again = deselect
      else if (ui.selection.size) { const n = sendTo(g, p.id); fire({ sent: n, to: p.id }); }
      lastTap = null;
    } else {
      const dbl = lastTap && t - lastTap.t <= DOUBLE_TAP_MS && Math.hypot(pt.x - lastTap.x, pt.y - lastTap.y) < 40;
      if (dbl) { selectAll(); lastTap = null; } else { ui.selection.clear(); lastTap = { t, x: pt.x, y: pt.y }; }
    }
  }
  function cancel(e) { if (drag && drag.id === e.pointerId) { endDrag(); } }

  on(canvas, 'pointerdown', down);
  on(canvas, 'pointermove', move);
  on(canvas, 'pointerup', up);
  on(canvas, 'pointercancel', cancel);
  on(canvas, 'lostpointercapture', cancel);
  on(canvas, 'contextmenu', (e) => e.preventDefault && e.preventDefault());

  const kt = opts.keyTarget || (typeof window !== 'undefined' ? window : null);
  on(kt, 'keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code;
    if (c === 'Escape') {
      e.preventDefault && e.preventDefault();
      if (e.repeat) return;
      if (playing() && (ui.selection.size || drag)) clear(); else fire('back');
      return;
    }
    const dm = /^Digit([1-4])$/.exec(c) || /^Numpad([1-4])$/.exec(c);
    if (dm) { if (!e.repeat) fire({ sendPct: TUNING.sendPct[Number(dm[1]) - 1] }); return; }
    const a = KEYMAP[c];
    if (!a) return;
    e.preventDefault && e.preventDefault();
    if (e.repeat && a !== 'up' && a !== 'down' && a !== 'left' && a !== 'right') return;
    if (a === 'all') { if (playing()) selectAll(); fire('all'); return; }
    fire(a);
  });
  on(kt, 'blur', () => { endDrag(); });

  return {
    ui,
    poll() {
      const g = getGame();
      if (g) prune(g);
      return { selection: ui.selection, hover: ui.hover, target: ui.target, dragPath: ui.dragPath, dragging: !!drag, sendPct: g ? g.sendPct : TUNING.defaultSendPct };
    },
    onAction(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setEnabled(b) { enabled = !!b; if (!enabled) clear(); },
    clear, selectAll,
    dispose() { for (const c of cleanups.splice(0)) c(); listeners.clear(); ui.selection.clear(); drag = null; },
  };
}
