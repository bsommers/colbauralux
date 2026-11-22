// Particle system: pooled, hard cap 1500. Subscribes to `fx` events.
import { PALETTE } from '../core/defs.js';

export const MAX_PARTICLES = 1500;
const TAU = Math.PI * 2;

export function createParticles(bus) {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pool = Array.from({ length: MAX_PARTICLES }, () => ({ on: false }));
  let live = 0, cursor = 0;

  function alloc() {
    if (live >= MAX_PARTICLES) return null;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool[(cursor + i) % MAX_PARTICLES];
      if (!p.on) { cursor = (cursor + i + 1) % MAX_PARTICLES; p.on = true; live++; return p; }
    }
    return null;
  }
  function add(o) {
    const p = alloc(); if (!p) return null;
    p.kind = o.kind || 'dot'; p.x = o.x; p.y = o.y; p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.life = p.max = o.life || 0.5; p.size = o.size ?? 2; p.grow = o.grow || 0; p.color = o.color || '#fff';
    p.drag = o.drag ?? 0; p.g = o.g || 0; p.rot = o.rot || 0; p.vr = o.vr || 0; p.len = o.len || 0;
    return p;
  }
  function burst(x, y, n, color, speed, life, size, kind = 'dot', extra = {}) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, s = speed * (0.3 + rnd() * 0.7);
      if (!add({ kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + rnd() * 0.6), size: size * (0.6 + rnd() * 0.8),
        color, drag: 1.5, rot: a, ...extra })) return;
    }
  }

  const handlers = {
    boom_small(x, y, o) { burst(x, y, 14, o.color || PALETTE.orange, 150, 0.5, 2); add({ kind: 'ring', x, y, life: 0.3, size: 4, grow: 60, color: o.color || PALETTE.cream }); },
    boom_big(x, y, o) {
      burst(x, y, 60, o.color || PALETTE.orange, 280, 0.9, 2.5); burst(x, y, 30, PALETTE.cream, 200, 0.7, 2, 'spark');
      add({ kind: 'ring', x, y, life: 0.6, size: 6, grow: 200, color: PALETTE.cream });
      add({ kind: 'ring', x, y, life: 0.9, size: 3, grow: 130, color: o.color || PALETTE.wallHot });
    },
    crumbs(x, y, o) { burst(x, y, o.n || 10, o.color || PALETTE.cheese, o.speed || 130, 0.8, 2.5, 'crumb', { g: 120, vr: 8 }); },
    spark(x, y, o) {
      const n = o.n || 6, base = o.angle;
      for (let i = 0; i < n; i++) {
        const a = base != null ? base + (rnd() - 0.5) * 1.6 : rnd() * TAU, s = (o.speed || 160) * (0.4 + rnd() * 0.6);
        if (!add({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25 + rnd() * 0.25, size: 1.5, len: 5, color: o.color || PALETTE.wall, drag: 2, rot: a })) return;
      }
    },
    ring(x, y, o) { add({ kind: 'ring', x, y, life: 0.45, size: o.r || 4, grow: 90, color: o.color || PALETTE.wall }); },
    thrust(x, y, o) {
      const a = (o.angle ?? 0) + Math.PI;
      for (let i = 0; i < (o.n || 2); i++) {
        const d = a + (rnd() - 0.5) * 0.5, s = (o.speed || 90) * (0.6 + rnd() * 0.6);
        if (!add({ kind: 'puff', x, y, vx: Math.cos(d) * s, vy: Math.sin(d) * s, life: 0.3 + rnd() * 0.2, size: 2.5, grow: 5, color: o.color || PALETTE.orange, drag: 2 })) return;
      }
    },
    trail(x, y, o) { add({ kind: 'puff', x, y, life: 0.25, size: o.r || 2, grow: -4, color: o.color || PALETTE.hairball }); },
    launch(x, y, o) {
      const n = o.n || 12, a0 = rnd() * TAU;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * TAU;
        if (!add({ kind: 'dot', x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14, vx: -Math.sin(a) * 120 - Math.cos(a) * 60, vy: Math.cos(a) * 120 - Math.sin(a) * 60,
          life: 0.5, size: 2, color: o.color || PALETTE.wallHot, drag: 2.5 })) return;
      }
      add({ kind: 'ring', x, y, life: 0.35, size: 14, grow: -30, color: PALETTE.wallHot });
    },
    confetti(x, y, o) {
      const cols = [PALETTE.cheese, PALETTE.orange, PALETTE.wallHot, PALETTE.wall, PALETTE.cream];
      for (let i = 0; i < (o.n || 40); i++) {
        const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2, s = 100 + rnd() * 220;
        if (!add({ kind: 'conf', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.4 + rnd() * 1.0, size: 2 + rnd() * 2, color: cols[i % cols.length], g: 220, drag: 0.8, rot: rnd() * TAU, vr: (rnd() - 0.5) * 14 })) return;
      }
    },
  };

  function spawn(type, x, y, opts = {}) { const h = handlers[type]; if (h) h(x, y, opts || {}); }
  const off = bus && bus.on ? bus.on('fx', (e) => e && spawn(e.type, e.x, e.y, e.opts)) : null;

  return {
    spawn, get count() { return live; }, max: MAX_PARTICLES,
    update(dt) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = pool[i]; if (!p.on) continue;
        p.life -= dt;
        if (p.life <= 0) { p.on = false; live--; continue; }
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.grow) p.size = Math.max(0.2, p.size + p.grow * dt);
      }
    },
    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = pool[i]; if (!p.on) continue;
        const k = Math.max(0, Math.min(1, p.life / p.max));
        ctx.globalAlpha = k; ctx.strokeStyle = p.color; ctx.fillStyle = p.color;
        switch (p.kind) {
          case 'ring': ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, TAU); ctx.stroke(); break;
          case 'spark': {
            const c = Math.cos(p.rot), s = Math.sin(p.rot);
            ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - c * p.len, p.y - s * p.len); ctx.stroke(); break;
          }
          case 'crumb': case 'conf': ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2); ctx.restore(); break;
          default: ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    },
    clear() { for (const p of pool) p.on = false; live = 0; },
    destroy() { if (off) off(); },
  };
}
