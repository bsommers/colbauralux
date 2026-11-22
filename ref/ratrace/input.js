// Input: keyboard + Gamepad + touch -> game input (ARCHITECTURE.md §4/§9). Node-importable (no DOM at import time).
// createInput(target) -> { poll(), onAction(fn), isTouch(), dispose() }
// poll() returns { rot, thrust, fire, bomb, aim, pause } for the sim. Discrete UI actions are delivered to onAction listeners:
// 'up' 'down' 'left' 'right' 'select' 'back' 'pause' 'mute' 'crt' 'vic' 'fullscreen' 'bomb' and { char:'A' } / 'backspace'.

export const KEYMAP = Object.freeze({
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'fire', KeyZ: 'fire', KeyX: 'bomb', ShiftLeft: 'bomb', ShiftRight: 'bomb',
});
export const ACTION_KEYS = Object.freeze({
  Enter: 'select', NumpadEnter: 'select', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', KeyC: 'crt', KeyV: 'vic', KeyF: 'fullscreen', Backspace: 'backspace',
});

/** Pure helper: gamepad snapshot -> { rot, thrust, aim, fire, bomb, start, up/down/left/right, select, back }. */
export function readPad(pad, dead = 0.3) {
  const o = { rot: 0, thrust: 0, aim: null, fire: false, bomb: false, start: false, up: false, down: false, left: false, right: false, select: false, back: false };
  if (!pad) return o;
  const ax = pad.axes || [], b = (i) => !!(pad.buttons && pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5));
  const sx = ax[0] || 0, sy = ax[1] || 0, mag = Math.hypot(sx, sy);
  const dl = b(14), dr = b(15), du = b(12), dd = b(13);
  if (mag > dead) { o.aim = Math.atan2(sy, sx); o.thrust = Math.min(1, (mag - dead) / (1 - dead)); }
  else { o.rot = (dr ? 1 : 0) - (dl ? 1 : 0); if (du) o.thrust = 1; }
  o.fire = b(0) || b(7); o.bomb = b(1) || b(2) || b(6);
  o.start = b(9);
  o.up = du || sy < -0.6; o.down = dd || sy > 0.6; o.left = dl || sx < -0.6; o.right = dr || sx > 0.6;
  o.select = b(0); o.back = b(1);
  return o;
}

export function createInput(target, opts = {}) {
  const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
  const tgt = target || (hasDom ? window : null);
  const keys = new Set();
  const listeners = new Set();
  const fireAct = (a) => { for (const fn of listeners) { try { fn(a); } catch (e) { console.error(e); } } };
  let bombEdge = false, prevPad = readPad(null), padFire = false, touchOn = false;
  const touch = { stickId: null, cx: 0, cy: 0, ax: 0, ay: 0, mag: 0, aim: null, fire: false, bomb: false, fireId: null, bombId: null };
  const cleanups = [];
  const on = (el, ev, fn, o) => { if (!el || !el.addEventListener) return; el.addEventListener(ev, fn, o); cleanups.push(() => el.removeEventListener(ev, fn, o)); };

  on(hasDom ? window : tgt, 'keydown', (e) => {
    const c = e.code;
    if (opts.textMode && opts.textMode() && /^Key[A-Z]$/.test(c) && !e.metaKey && !e.ctrlKey && !e.altKey) { if (!e.repeat) fireAct({ char: c.slice(3) }); e.preventDefault?.(); return; }
    if (KEYMAP[c] || ACTION_KEYS[c] || /^Key[A-Z]$/.test(c)) { if (e.metaKey || e.ctrlKey || e.altKey) return; }
    if (KEYMAP[c] || ACTION_KEYS[c]) e.preventDefault?.();
    if (e.repeat) return;
    keys.add(c);
    const k = KEYMAP[c];
    if (k === 'bomb') { bombEdge = true; fireAct('bomb'); }
    else if (k === 'fire') fireAct('select');
    else if (k) fireAct(k);
    const a = ACTION_KEYS[c];
    if (a) fireAct(a);
    if (/^Key[A-Z]$/.test(c)) fireAct({ char: c.slice(3) });
    if (/^Digit[0-9]$/.test(c)) fireAct({ char: c.slice(5) });
  });
  on(hasDom ? window : tgt, 'keyup', (e) => { keys.delete(e.code); });
  on(hasDom ? window : tgt, 'blur', () => { keys.clear(); });

  // ---- touch overlay (created lazily on first touch; hidden otherwise)
  let ui = null;
  function mkTouchUi() {
    if (ui || !hasDom) return;
    ui = document.createElement('div'); ui.id = 'touch';
    ui.innerHTML = '<div class="tz" id="tstick"><div id="tknob"></div></div><div class="tp" id="tpause">II</div><div class="tb" id="tbomb">BOMB</div><div class="tb" id="tfire">FIRE</div>';
    document.body.appendChild(ui);
    cleanups.push(() => ui.remove());
  }
  function enableTouch() { if (touchOn) return; touchOn = true; mkTouchUi(); document.body.classList.add('touch'); }
  const hit = (el, t) => { if (!el) return false; const r = el.getBoundingClientRect(); return t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom; };
  function tStart(e) {
    enableTouch();
    for (const t of e.changedTouches) {
      const f = document.getElementById('tfire'), bm = document.getElementById('tbomb');
      if (hit(document.getElementById('tpause'), t)) { fireAct('pause'); }
      else if (hit(f, t)) { touch.fire = true; touch.fireId = t.identifier; fireAct('select'); }
      else if (hit(bm, t)) { touch.bomb = true; touch.bombId = t.identifier; bombEdge = true; fireAct('bomb'); }
      else if (t.clientX < window.innerWidth * 0.5 && touch.stickId === null) {
        touch.stickId = t.identifier; touch.cx = t.clientX; touch.cy = t.clientY; touch.mag = 0; touch.aim = null; fireAct('select');
      } else fireAct('select');
    }
    e.preventDefault?.();
  }
  function tMove(e) {
    for (const t of e.changedTouches) if (t.identifier === touch.stickId) {
      const dx = t.clientX - touch.cx, dy = t.clientY - touch.cy, R = 50, m = Math.hypot(dx, dy);
      touch.mag = Math.min(1, m / R); touch.aim = m > 8 ? Math.atan2(dy, dx) : null;
      if (m > 8) { if (Math.abs(dx) > Math.abs(dy)) fireAct(dx > 0 ? 'right' : 'left'); else fireAct(dy > 0 ? 'down' : 'up'); }
      const k = document.getElementById('tknob'); if (k) k.style.transform = `translate(${dx / (m || 1) * Math.min(m, R)}px,${dy / (m || 1) * Math.min(m, R)}px)`;
    }
    e.preventDefault?.();
  }
  function tEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stickId) { touch.stickId = null; touch.mag = 0; touch.aim = null; const k = document.getElementById('tknob'); if (k) k.style.transform = ''; }
      if (t.identifier === touch.fireId) { touch.fire = false; touch.fireId = null; }
      if (t.identifier === touch.bombId) { touch.bomb = false; touch.bombId = null; }
    }
    e.preventDefault?.();
  }
  if (hasDom) {
    on(window, 'touchstart', tStart, { passive: false }); on(window, 'touchmove', tMove, { passive: false });
    on(window, 'touchend', tEnd, { passive: false }); on(window, 'touchcancel', tEnd, { passive: false });
    if (opts.forceTouch) enableTouch();
  }

  function pad() {
    try { const ps = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of ps) if (p && p.connected) return p; } catch { /* ignore */ }
    return null;
  }

  function poll() {
    const p = readPad(pad());
    // pad edges -> actions
    for (const k of ['up', 'down', 'left', 'right']) if (p[k] && !prevPad[k]) fireAct(k);
    if (p.select && !prevPad.select) fireAct('select');
    if (p.back && !prevPad.back) fireAct('back');
    if (p.start && !prevPad.start) { fireAct('pause'); }
    if (p.bomb && !prevPad.bomb) bombEdge = true;
    prevPad = p;
    const kl = keys.has('ArrowLeft') || keys.has('KeyA'), kr = keys.has('ArrowRight') || keys.has('KeyD');
    const ku = keys.has('ArrowUp') || keys.has('KeyW');
    const kf = keys.has('Space') || keys.has('KeyZ');
    let rot = (kr ? 1 : 0) - (kl ? 1 : 0), thrust = ku ? 1 : 0, aim = null;
    if (rot === 0 && p.rot) rot = p.rot;
    if (p.thrust > thrust) thrust = p.thrust;
    if (p.aim !== null && rot === 0) aim = p.aim;
    if (touch.aim !== null && rot === 0) { aim = touch.aim; thrust = Math.max(thrust, touch.mag); }
    const out = { rot, thrust, fire: kf || p.fire || touch.fire, bomb: bombEdge, aim };
    bombEdge = false;
    return out;
  }

  return {
    poll, isTouch: () => touchOn,
    onAction(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    _key(code, down) { if (down) keys.add(code); else keys.delete(code); },
    dispose() { for (const c of cleanups.splice(0)) c(); listeners.clear(); keys.clear(); },
  };
}
