// Renderer: logical 800x450 scaled to canvas, particles, shake, flash, CRT pass.
import { W, H, BOX, PALETTE, TUNING, KINDS } from '../core/defs.js';
import { createParticles } from './particles.js';
import { createBackground } from './background.js';
import { createVicTarget, quantizeTarget, blitVic } from './vic.js';

let art = null;
try { art = await import('../art/vector.js'); } catch { art = null; }

const ENEMY_ORDER = ['tuna', 'mine', 'mouse', 'rat', 'commander', 'deathrat', 'ebullet', 'hairball'];

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
  let vic = !!(settings && settings.vic), vicT = null, vicScan = false;
  let crt = settings && settings.crt !== undefined ? !!settings.crt : true;
  let shakeMag = 0, shakeDur = 0, shakeT = 0;
  let flash = null; // {color,a,dur,t}
  let wallHot = 0;
  let time = 0, lastNow = null;
  let scale = 1, ox = 0, oy = 0, dpr = 1;
  let off = null, offCtx = null, scan = null;
  const unsubs = [];

  if (bus && bus.on) {
    unsubs.push(bus.on('shake', (e) => { if (!e) return; if (e.mag >= shakeMag * (shakeT / (shakeDur || 1)) || shakeT <= 0) { shakeMag = e.mag; shakeDur = Math.max(0.01, e.dur || 0.2); shakeT = shakeDur; } }));
    unsubs.push(bus.on('flash', (e) => { if (e) flash = { color: e.color || '#fff', a: e.a ?? 0.5, dur: Math.max(0.01, e.dur || 0.2), t: Math.max(0.01, e.dur || 0.2) }; }));
    unsubs.push(bus.on('sfx', (e) => { if (e && e.name === 'bounce') wallHot = 0.18; }));
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

  function ensureCRT() {
    if (!off) { off = makeCanvas(canvas, canvas.width, canvas.height); offCtx = off ? off.getContext('2d') : null; }
    if (!scan) {
      scan = makeCanvas(canvas, canvas.width, canvas.height);
      const s = scan && scan.getContext('2d');
      if (s) {
        const step = Math.max(2, Math.round(2 * dpr));
        s.fillStyle = 'rgba(0,0,0,0.22)';
        for (let y = 0; y < canvas.height; y += step) s.fillRect(0, y, canvas.width, Math.max(1, step / 2));
        const g = s.createRadialGradient(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35,
          canvas.width / 2, canvas.height / 2, Math.hypot(canvas.width, canvas.height) * 0.55);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
        s.fillStyle = g; s.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    return !!(off && offCtx && scan);
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  function pos(e, alpha) {
    const px = e.prev ? e.prev.x : e.px, py = e.prev ? e.prev.y : e.py;
    if (px === undefined || py === undefined) return [e.x, e.y];
    return [lerp(px, e.x, alpha), lerp(py, e.y, alpha)];
  }

  function sprite(c, name, x, y, angle, sc, opts) {
    if (art && art.drawSprite) { art.drawSprite(c, name, x, y, angle, sc, opts); return; }
    const r = (KINDS[name] ? KINDS[name].r : TUNING.ship.r);
    c.save(); c.strokeStyle = (opts && opts.color) || PALETTE[name] || PALETTE.text; c.lineWidth = 1.5;
    c.strokeRect(x - r, y - r, r * 2, r * 2); c.restore();
  }

  function drawWorld(c, game, alpha, ui, isVic) {
    if (isVic) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); } else bg.draw(c, time); // VIC: plain black (moon/stars quantise to blobs)
    const hot = wallHot > 0;
    if (isVic) { // quantiser-friendly cheese box: yellow outline, dark interior, black holes
      const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
      c.save(); c.fillStyle = '#000'; c.fillRect(BOX.x0, BOX.y0, bw, bh);
      c.strokeStyle = '#aa7449'; c.lineWidth = 3;
      for (const [fx, fy, r] of [[0.2, 0.3, 12], [0.7, 0.25, 9], [0.5, 0.7, 14], [0.85, 0.75, 8]]) { c.beginPath(); c.arc(BOX.x0 + fx * bw, BOX.y0 + fy * bh, r, 0, 6.2832); c.stroke(); }
      c.strokeStyle = '#bfce72'; c.lineWidth = 6; c.strokeRect(BOX.x0, BOX.y0, bw, bh); c.restore();
    } else if (art && art.drawMouseHole) art.drawMouseHole(c, time);
    else { c.save(); c.strokeStyle = PALETTE.box; c.lineWidth = 2; c.strokeRect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0); c.restore(); }
    if (art && art.drawWallRect) art.drawWallRect(c, 0, 0, W, H, time, hot ? { color: PALETTE.wallHot, hot: true } : {});
    else { c.save(); c.strokeStyle = hot ? PALETTE.wallHot : PALETTE.wall; c.lineWidth = 2; c.strokeRect(1, 1, W - 2, H - 2); c.restore(); }
    if (hot && art && art.drawWallRect) { // extra hot outline so flash is visible regardless of art opts
      c.save(); c.globalAlpha = Math.min(1, wallHot / 0.18) * 0.8; c.strokeStyle = PALETTE.wallHot; c.lineWidth = 2;
      c.strokeRect(1, 1, W - 2, H - 2); c.strokeRect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0); c.restore();
    }
    const ents = (game && game.ents) || [];
    for (const kind of ENEMY_ORDER) {
      for (const e of ents) {
        if (e.dead || e.kind !== kind) continue;
        const [x, y] = pos(e, alpha);
        if (kind === 'hairball') {
          c.save(); c.globalAlpha = 0.35; c.strokeStyle = PALETTE.hairball; c.lineWidth = 2; c.beginPath();
          c.moveTo(x, y); c.lineTo(x - e.vx * 0.04, y - e.vy * 0.04); c.stroke(); c.restore();
        }
        const blink = kind === 'tuna' && e.t > 6 && Math.floor(e.t * 8) % 2 === 0;
        sprite(c, kind, x, y, e.angle || 0, 1, { t: (game.t || 0) + (e.id || 0), blink, hurt: e.hurt || 0, glow: true });
      }
    }
    const s = game && game.ship;
    if (s && s.alive !== false && game.state !== 'dying' && game.state !== 'gameover') {
      const [x, y] = pos(s, alpha);
      const tint = s.hurtT > 0; // red while recovering from a hull hit
      const blink = !tint && s.invuln > 0 && Math.floor(time * 12) % 2 === 0;
      sprite(c, 'colby', x, y, s.angle || 0, 1, { t: time, thrust: s.thrusting ? 1 : 0, blink, tint, glow: true });
    }
    particles.draw(c);
  }

  function overlay(c) {
    if (flash && flash.t > 0) {
      c.save(); c.globalAlpha = Math.max(0, flash.a * (flash.t / flash.dur)); c.fillStyle = flash.color; c.fillRect(0, 0, W, H); c.restore();
    }
  }

  function scene(c, game, alpha, ui, ov) {
    const sc = ov ? ov.s : scale, tx = ov ? 0 : ox, ty = ov ? 0 : oy;
    c.save();
    c.setTransform(sc, 0, 0, sc, tx, ty);
    c.beginPath(); c.rect(0, 0, W, H); c.clip();
    let sx = 0, sy = 0;
    if (shakeT > 0) {
      const m = shakeMag * (shakeT / shakeDur);
      sx = Math.sin(time * 97.3) * m; sy = Math.cos(time * 83.1) * m;
    }
    c.translate(sx, sy);
    drawWorld(c, game, alpha, ui, !!ov);
    c.restore();
    c.save(); c.setTransform(sc, 0, 0, sc, tx, ty); c.beginPath(); c.rect(0, 0, W, H); c.clip();
    overlay(c);
    if (ui) { if (typeof ui.screens === 'function') ui.screens(c); if (typeof ui.hud === 'function') ui.hud(c, !!ov); }
    c.restore();
  }

  function draw(game, alpha = 1, ui) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = lastNow == null ? 0 : Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    time += dt;
    bg.update(dt); particles.update(dt);
    if (shakeT > 0) shakeT -= dt;
    if (flash && flash.t > 0) flash.t -= dt;
    if (wallHot > 0) wallHot -= dt;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (vic && (vicT || (vicT = createVicTarget((w, h) => makeCanvas(canvas, w, h))))) {
      vicT.ctx.setTransform(1, 0, 0, 1, 0, 0);
      vicT.ctx.fillStyle = '#000'; vicT.ctx.fillRect(0, 0, vicT.w, vicT.h);
      scene(vicT.ctx, game, alpha, ui, { s: vicT.w / W });
      quantizeTarget(vicT);
      blitVic(ctx, vicT, ox, oy, W * scale, H * scale, vicScan);
    } else if (crt && ensureCRT()) {
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.fillStyle = '#000'; offCtx.fillRect(0, 0, off.width, off.height);
      scene(offCtx, game, alpha, ui);
      ctx.drawImage(off, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      // chromatic fringe
      const f = Math.max(1, dpr);
      ctx.globalAlpha = 0.12; ctx.drawImage(off, f, 0); ctx.drawImage(off, -f, 0);
      // bloom
      try { ctx.filter = `blur(${Math.round(4 * dpr)}px)`; ctx.globalAlpha = 0.3; ctx.drawImage(off, 0, 0); ctx.filter = 'none'; } catch { /* no filter support */ }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.drawImage(scan, 0, 0);
    } else {
      scene(ctx, game, alpha, ui);
    }
    ctx.restore();
  }

  return {
    draw, resize,
    setCRT(on) { crt = !!on; },
    setVic(on) { vic = !!on; },
    setVicScanlines(on) { vicScan = !!on; },
    shot() { return canvas.toDataURL ? canvas.toDataURL('image/png') : null; },
    particles, background: bg,
    destroy() { for (const u of unsubs) if (typeof u === 'function') u(); particles.destroy && particles.destroy(); },
  };
}
