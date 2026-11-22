// Parallax stars + drifting nebula + faint grid + cheese moon. Deterministic per seed.
import { W, H, PALETTE } from '../core/defs.js';

const TAU = Math.PI * 2;

export function createBackground(seed = 1) {
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const stars = Array.from({ length: 120 }, () => ({ x: rnd() * W, y: rnd() * H, z: 0.2 + rnd() * 0.8, ph: rnd() * TAU }));
  const nebula = Array.from({ length: 4 }, (_, i) => ({
    x: rnd() * W, y: rnd() * H, r: 140 + rnd() * 120, v: 3 + rnd() * 4, hue: [275, 190, 330, 40][i], ph: rnd() * TAU,
  }));
  const moon = { x: 120, y: 90, r: 34, holes: Array.from({ length: 6 }, () => ({ a: rnd() * TAU, d: rnd() * 0.6, r: 0.08 + rnd() * 0.12 })) };
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const st of stars) { st.x -= 6 * st.z * dt; if (st.x < 0) { st.x += W; st.y = rnd() * H; } }
      for (const n of nebula) { n.x -= n.v * dt; if (n.x + n.r < 0) n.x = W + n.r; }
      moon.x += 2 * dt; if (moon.x - moon.r > W) moon.x = -moon.r;
    },
    draw(ctx, time = t) {
      ctx.save();
      ctx.fillStyle = PALETTE.bg; ctx.fillRect(0, 0, W, H);
      // nebula: soft radial blobs (gradient guarded for stub contexts)
      if (ctx.createRadialGradient) {
        for (const n of nebula) {
          const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
          const a = 0.07 + 0.02 * Math.sin(time * 0.3 + n.ph);
          g.addColorStop(0, `hsla(${n.hue},80%,55%,${a})`); g.addColorStop(1, `hsla(${n.hue},80%,55%,0)`);
          ctx.fillStyle = g; ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
        }
      }
      ctx.strokeStyle = PALETTE.dim; ctx.globalAlpha = 0.06; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.globalAlpha = 0.3; ctx.fillStyle = PALETTE.cheese; ctx.beginPath(); ctx.arc(moon.x, moon.y, moon.r, 0, TAU); ctx.fill();
      ctx.fillStyle = PALETTE.bg;
      for (const h of moon.holes) { ctx.beginPath(); ctx.arc(moon.x + Math.cos(h.a) * h.d * moon.r, moon.y + Math.sin(h.a) * h.d * moon.r, h.r * moon.r, 0, TAU); ctx.fill(); }
      ctx.fillStyle = PALETTE.cream;
      for (const st of stars) { ctx.globalAlpha = (0.3 + 0.5 * st.z) * (0.7 + 0.3 * Math.sin(time * 2 + st.ph)); ctx.fillRect(st.x, st.y, st.z * 1.6, st.z * 1.6); }
      ctx.restore();
    },
  };
}
