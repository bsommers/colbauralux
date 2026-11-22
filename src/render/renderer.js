// Renderer: logical 960x540 letterboxed onto the canvas. Background -> planets -> ships (batched by owner)
// -> particles -> ripples -> selection/drag overlay -> shake/flash -> optional CRT -> ui callbacks.
import { W, H, PALETTE, TUNING, FACTIONS, PLAYER, factionOf } from '../core/defs.js';
import { createParticles } from './particles.js';
import { createBackground } from './background.js';

let art = null;
try { art = await import('../art/vector.js'); } catch { art = null; }

const TAU = Math.PI * 2;
const SHIP_LEN = 4.5;      // triangle half-length (logical px)
const GLOW_R = 5.5;
const ADDITIVE_ART_MAX = 120; // use art.drawShip only while few ships are alive; beyond that the batched path wins

function makeCanvas(like, w, h) {
  try {
    if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  } catch { /* fall through */ }
  if (like && typeof like.__makeCanvas === 'function') return like.__makeCanvas(w, h);
  return null;
}

export function createRenderer(canvas, { bus, settings } = {}) {
  const ctx = canvas.getContext('2d');
  const particles = createParticles(bus);
  const bg = createBackground(1);
  let crt = settings && settings.crt !== undefined ? !!settings.crt : true;
  let shakeMag = 0, shakeDur = 0, shakeT = 0;
  let flash = null;
  let time = 0, lastNow = null;
  let scale = 1, ox = 0, oy = 0, dpr = 1;
  let off = null, offCtx = null, scan = null;
  const ripples = []; // {id,x,y,color,t,dur}
  const unsubs = [];

  if (bus && bus.on) {
    unsubs.push(bus.on('shake', (e) => { if (!e) return; if (e.mag >= shakeMag * (shakeT / (shakeDur || 1)) || shakeT <= 0) { shakeMag = e.mag; shakeDur = Math.max(0.01, e.dur || 0.2); shakeT = shakeDur; } }));
    unsubs.push(bus.on('flash', (e) => { if (e) flash = { color: e.color || '#fff', a: e.a ?? 0.5, dur: Math.max(0.01, e.dur || 0.2), t: Math.max(0.01, e.dur || 0.2) }; }));
    // planet captured: ripple ring in the new owner's colour; position resolved from the game at draw time
    unsubs.push(bus.on('planet', (e) => {
      if (!e) return;
      if (ripples.length >= 24) ripples.shift();
      ripples.push({ id: e.id, x: null, y: null, color: factionOf(e.owner).color, t: 0, dur: 1.1 });
    }));
  }

  function resize() {
    dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cw = canvas.clientWidth || canvas.width / dpr || W;
    const ch = canvas.clientHeight || canvas.height / dpr || H;
    const pw = Math.max(1, Math.round(cw * dpr)), ph = Math.max(1, Math.round(ch * dpr));
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    scale = Math.min(pw / W, ph / H);
    ox = Math.round((pw - W * scale) / 2); oy = Math.round((ph - H * scale) / 2);
    off = null; offCtx = null; scan = null;
  }
  resize();

  function toLogical(clientX, clientY) {
    const r = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: canvas.width / dpr, height: canvas.height / dpr };
    const rw = r.width || canvas.width / dpr, rh = r.height || canvas.height / dpr;
    const px = (clientX - r.left) * (canvas.width / rw), py = (clientY - r.top) * (canvas.height / rh);
    return { x: (px - ox) / scale, y: (py - oy) / scale };
  }

  function ensureCRT() {
    if (!off) { off = makeCanvas(canvas, canvas.width, canvas.height); offCtx = off ? off.getContext('2d') : null; }
    if (!scan) {
      scan = makeCanvas(canvas, canvas.width, canvas.height);
      const s = scan && scan.getContext('2d');
      if (s) {
        const step = Math.max(2, Math.round(2 * dpr));
        s.fillStyle = 'rgba(0,0,0,0.2)';
        for (let y = 0; y < canvas.height; y += step) s.fillRect(0, y, canvas.width, Math.max(1, step / 2));
        const g = s.createRadialGradient(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35,
          canvas.width / 2, canvas.height / 2, Math.hypot(canvas.width, canvas.height) * 0.55);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
        s.fillStyle = g; s.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    return !!(off && offCtx && scan);
  }

  // ---- planets -------------------------------------------------------------------------------------------
  function planetFallback(c, p, t, o) {
    const col = factionOf(p.owner).color;
    c.save();
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 3;
    c.globalAlpha = 0.18; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
    c.globalAlpha = 1; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.stroke();
    for (let i = 0; i < (p.level | 0); i++) { c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y, p.r - 5 - i * 4, 0, TAU); c.stroke(); }
    if (o && (o.selected || o.targeted || o.hover)) { c.strokeStyle = PALETTE.select; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, p.r + 6, 0, TAU); c.stroke(); }
    if (p.units > 0 || p.owner) { c.fillStyle = PALETTE.text; c.font = '12px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(p.units | 0), p.x, p.y); }
    c.restore();
  }

  function drawPlanets(c, game, ui) {
    const ps = game.planets || [];
    const sel = ui && ui.selection, hover = ui ? ui.hover : null, target = ui ? ui.target : null;
    const hasArt = art && typeof art.drawPlanet === 'function';
    for (const p of ps) {
      const o = { selected: !!(sel && sel.has && sel.has(p.id)), hover: hover === p.id, targeted: target === p.id, flash: p.flash || 0 };
      if (hasArt) art.drawPlanet(c, p, time, o); else planetFallback(c, p, time, o);
    }
  }

  // ---- ships: batched by owner ---------------------------------------------------------------------------
  const owners = [1, 2, 3, 4];
  function drawShips(c, game, alpha) {
    const ships = game.ships;
    const n = ships ? ships.length : 0;
    if (!n) return;
    const a = alpha * (1 / 60); // extrapolate from the last fixed step
    if (art && typeof art.drawShip === 'function' && n <= ADDITIVE_ART_MAX) {
      for (const s of ships) {
        if (s.dead) continue;
        art.drawShip(c, s.owner, s.x + s.vx * a, s.y + s.vy * a, Math.atan2(s.vy, s.vx), time);
      }
    } else {
      for (let oi = 0; oi < owners.length; oi++) {
        const ow = owners[oi];
        const col = factionOf(ow).color;
        c.fillStyle = col;
        c.beginPath();
        let any = false;
        for (let i = 0; i < n; i++) {
          const s = ships[i];
          if (s.owner !== ow || s.dead) continue;
          any = true;
          const x = s.x + s.vx * a, y = s.y + s.vy * a;
          const sp = Math.hypot(s.vx, s.vy) || 1;
          const dx = (s.vx / sp) * SHIP_LEN, dy = (s.vy / sp) * SHIP_LEN;
          c.moveTo(x + dx, y + dy);
          c.lineTo(x - dx - dy * 0.8, y - dy + dx * 0.8);
          c.lineTo(x - dx + dy * 0.8, y - dy - dx * 0.8);
          c.closePath();
        }
        if (any) c.fill();
      }
    }
    // additive glow pass: one path per owner
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = n > 300 ? 0.1 : 0.16;
    for (let oi = 0; oi < owners.length; oi++) {
      const ow = owners[oi];
      c.fillStyle = factionOf(ow).color;
      c.beginPath();
      let any = false;
      for (let i = 0; i < n; i++) {
        const s = ships[i];
        if (s.owner !== ow || s.dead) continue;
        any = true;
        const x = s.x + s.vx * a, y = s.y + s.vy * a;
        c.moveTo(x + GLOW_R, y); c.arc(x, y, GLOW_R, 0, TAU);
      }
      if (any) c.fill();
    }
    c.restore();
  }

  function drawRipples(c, game) {
    if (!ripples.length) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const r of ripples) {
      if (r.x === null) {
        const p = game && game.planets && game.planets[r.id];
        if (!p) { r.t = r.dur; continue; }
        r.x = p.x; r.y = p.y; r.r0 = p.r;
      }
      const k = r.t / r.dur;
      c.globalAlpha = (1 - k) * 0.9; c.strokeStyle = r.color; c.lineWidth = 3 * (1 - k) + 1;
      c.beginPath(); c.arc(r.x, r.y, r.r0 + k * 90, 0, TAU); c.stroke();
      if (k < 0.7) { c.globalAlpha = (1 - k / 0.7) * 0.5; c.lineWidth = 2; c.beginPath(); c.arc(r.x, r.y, r.r0 + k * 45, 0, TAU); c.stroke(); }
    }
    c.restore();
  }

  function drawOverlay(c, game, ui) {
    if (!ui) return;
    const ps = game.planets || [];
    if (ui.selection && ui.selection.size && art && art.drawSelectRing) {
      for (const id of ui.selection) { const p = ps[id]; if (p) art.drawSelectRing(c, p.x, p.y, p.r + 8, time); }
    }
    const path = ui.dragPath;
    if (path && path.length > 1) {
      const col = PALETTE.arrow;
      if (art && art.drawSendArrow) art.drawSendArrow(c, path, time, col);
      else {
        c.save(); c.strokeStyle = col; c.lineWidth = 2; c.setLineDash([6, 5]); c.lineDashOffset = -time * 30; c.beginPath();
        c.moveTo(path[0].x, path[0].y); for (let i = 1; i < path.length; i++) c.lineTo(path[i].x, path[i].y); c.stroke(); c.restore();
      }
    }
  }

  function drawWorld(c, game, alpha, ui) {
    bg.draw(c, time);
    if (game) {
      drawPlanets(c, game, ui);
      drawShips(c, game, alpha);
    }
    particles.draw(c);
    drawRipples(c, game);
    if (game) drawOverlay(c, game, ui);
  }

  function scene(c, game, alpha, ui) {
    c.save();
    c.setTransform(scale, 0, 0, scale, ox, oy);
    c.beginPath(); c.rect(0, 0, W, H); c.clip();
    let sx = 0, sy = 0;
    if (shakeT > 0) {
      const m = shakeMag * (shakeT / shakeDur);
      sx = Math.sin(time * 97.3) * m; sy = Math.cos(time * 83.1) * m;
    }
    c.translate(sx, sy);
    drawWorld(c, game, alpha, ui);
    c.restore();
    c.save(); c.setTransform(scale, 0, 0, scale, ox, oy); c.beginPath(); c.rect(0, 0, W, H); c.clip();
    if (flash && flash.t > 0) {
      c.save(); c.globalAlpha = Math.max(0, flash.a * (flash.t / flash.dur)); c.fillStyle = flash.color; c.fillRect(0, 0, W, H); c.restore();
    }
    c.restore();
  }
  function uiPass(c, ui) {
    if (!ui) return;
    c.save(); c.setTransform(scale, 0, 0, scale, ox, oy); c.beginPath(); c.rect(0, 0, W, H); c.clip();
    if (typeof ui.hud === 'function') ui.hud(c);
    if (typeof ui.screens === 'function') ui.screens(c);
    c.restore();
  }

  function step(dt) {
    time += dt;
    bg.update(dt); particles.update(dt);
    if (shakeT > 0) shakeT -= dt;
    if (flash && flash.t > 0) flash.t -= dt;
    for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].t += dt; if (ripples[i].t >= ripples[i].dur) ripples.splice(i, 1); }
  }

  function draw(game, alpha = 1, ui) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = lastNow == null ? 0 : Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    step(dt);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (crt && ensureCRT()) {
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.fillStyle = '#000'; offCtx.fillRect(0, 0, off.width, off.height);
      scene(offCtx, game, alpha, ui);
      ctx.drawImage(off, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      const f = Math.max(1, dpr);
      ctx.globalAlpha = 0.1; ctx.drawImage(off, f, 0); ctx.drawImage(off, -f, 0);
      try { ctx.filter = `blur(${Math.round(4 * dpr)}px)`; ctx.globalAlpha = 0.25; ctx.drawImage(off, 0, 0); ctx.filter = 'none'; } catch { /* no filter support */ }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.drawImage(scan, 0, 0);
    } else {
      scene(ctx, game, alpha, ui);
    }
    uiPass(ctx, ui); // hud/screens stay crisp, drawn after the CRT pass
    ctx.restore();
  }

  return {
    draw, resize, toLogical,
    setCRT(on) { crt = !!on; },
    shot() { return canvas.toDataURL ? canvas.toDataURL('image/png') : null; },
    particles, background: bg, ripples, step,
    destroy() { for (const u of unsubs) if (typeof u === 'function') u(); particles.destroy && particles.destroy(); },
  };
}
