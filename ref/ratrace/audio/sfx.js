// Pure-JS SFX synthesis: every effect is a list of layers rendered to a Float32Array (Node-safe, deterministic).
export const SR = 22050;

// layer: {w:'sine|square|saw|tri|noise', f0, f1?, t0?, d, v, a?, fm?:[ratio,index], lp?:0..1, duty?, vib?:[hz,depth]}
const L = (w, f0, f1, d, v, o = {}) => ({ w, f0, f1: f1 ?? f0, d, v, ...o });
const note = (m) => 440 * Math.pow(2, (m - 69) / 12);
const arp = (ms, step, w, v, d) => ms.map((m, i) => L(w, note(m), note(m), d, v, { t0: i * step }));

export const SFX_DEFS = {
  thrust: { loop: true, dur: 0.5, layers: [L('saw', 52, 52, 0.5, 0.5, { flat: true, vib: [7, 0.06] }), L('noise', 0, 0, 0.5, 0.45, { flat: true, lp: 0.08 }), L('square', 26, 26, 0.5, 0.25, { flat: true })] },
  fire: { dur: 0.16, layers: [L('square', 1500, 260, 0.16, 0.5, { duty: 0.25 }), L('noise', 0, 0, 0.04, 0.3, { lp: 0.6 })] },
  bounce: { dur: 0.28, layers: [L('sine', 180, 520, 0.12, 0.7), L('sine', 520, 140, 0.16, 0.7, { t0: 0.12, vib: [28, 0.15] })] },
  hit: { dur: 0.14, layers: [L('noise', 0, 0, 0.1, 0.5, { lp: 0.5 }), L('square', 420, 120, 0.14, 0.4)] },
  boom_small: { dur: 0.4, layers: [L('noise', 0, 0, 0.4, 0.7, { lp: 0.25, sweep: 0.05 }), L('sine', 140, 40, 0.35, 0.6)] },
  boom_big: { dur: 1.0, layers: [L('noise', 0, 0, 1.0, 0.8, { lp: 0.18, sweep: 0.03 }), L('sine', 100, 28, 0.9, 0.8), L('saw', 70, 25, 0.8, 0.3)] },
  mine_burst: { dur: 0.45, layers: [L('noise', 0, 0, 0.3, 0.6, { lp: 0.7 }), L('square', 900, 90, 0.4, 0.35, { fm: [3.1, 4] }), L('sine', 200, 60, 0.45, 0.5)] },
  ebullet: { dur: 0.2, layers: [L('saw', 300, 700, 0.2, 0.35, { vib: [40, 0.3] }), L('square', 900, 400, 0.15, 0.2)] },
  pickup: { dur: 0.55, layers: [L('sine', 520, 900, 0.14, 0.6, { vib: [9, 0.02] }), L('sine', 900, 600, 0.35, 0.6, { t0: 0.14, vib: [8, 0.05], fm: [2, 1.2] })] }, // "mi-aow"
  bomb: { dur: 1.3, layers: [L('noise', 0, 0, 1.3, 0.7, { lp: 0.2, sweep: 0.015 }), L('sine', 300, 30, 1.2, 0.8), L('saw', 1200, 100, 0.6, 0.3)] },
  death: { dur: 0.9, layers: [L('saw', 800, 80, 0.9, 0.5, { vib: [14, 0.1] }), L('noise', 0, 0, 0.6, 0.5, { lp: 0.3 }), L('square', 400, 50, 0.8, 0.3)] },
  wave_start: { dur: 0.6, layers: arp([57, 60, 64, 69], 0.12, 'square', 0.4, 0.2) },
  wave_clear: { dur: 0.8, layers: arp([60, 64, 67, 72, 76], 0.1, 'square', 0.4, 0.25).concat(arp([48, 52, 55, 60, 64], 0.1, 'tri', 0.4, 0.25)) },
  extralife: { dur: 1.0, layers: [L('sine', 600, 1000, 0.18, 0.6, { fm: [2, 1] }), L('sine', 800, 500, 0.5, 0.6, { t0: 0.2, vib: [9, 0.06], fm: [2, 1.5] }), ...arp([72, 76, 79, 84], 0.09, 'square', 0.2, 0.2).map((l) => ({ ...l, t0: l.t0 + 0.6 }))] },
  deathrat_warn: { dur: 0.9, layers: [L('square', 220, 220, 0.18, 0.5), L('square', 165, 165, 0.18, 0.5, { t0: 0.22 }), L('square', 220, 220, 0.18, 0.5, { t0: 0.44 }), L('square', 165, 165, 0.2, 0.5, { t0: 0.66 })] },
  menu_move: { dur: 0.06, layers: [L('square', 880, 880, 0.06, 0.4, { duty: 0.5 })] },
  menu_select: { dur: 0.25, layers: [L('square', 660, 660, 0.08, 0.4), L('square', 990, 990, 0.17, 0.4, { t0: 0.08 })] },
  gameover: { dur: 1.4, layers: arp([67, 63, 60, 55], 0.28, 'saw', 0.35, 0.4).concat([L('sine', 90, 40, 0.5, 0.5, { t0: 0.9 })]) },
  hiscore: { dur: 1.2, layers: arp([60, 64, 67, 72, 67, 72, 76, 79], 0.1, 'square', 0.35, 0.2).concat(arp([48, 52, 55, 60], 0.2, 'tri', 0.4, 0.4)) },
  launch: { dur: 0.35, layers: [L('saw', 120, 900, 0.3, 0.4, { lp: 0.5 }), L('noise', 0, 0, 0.3, 0.3, { lp: 0.3 })] },
};

function osc(w, ph, duty) {
  switch (w) {
    case 'sine': return Math.sin(2 * Math.PI * ph);
    case 'square': return (ph % 1) < (duty ?? 0.5) ? 1 : -1;
    case 'saw': return 2 * (ph % 1) - 1;
    case 'tri': { const p = ph % 1; return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; }
    default: return 0;
  }
}

// Render one layer set into buf (adds). Deterministic LCG noise.
export function mixLayers(buf, layers, sr, t00 = 0, gain = 1, seed = 12345) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (const l of layers) {
    const i0 = Math.floor((t00 + (l.t0 || 0)) * sr), n = Math.floor(l.d * sr);
    let ph = 0, lpv = 0, mph = 0;
    const att = Math.max(l.a ?? 0.004, 1e-4);
    for (let i = 0; i < n && i0 + i < buf.length; i++) {
      const t = i / sr, k = t / l.d;
      let f = l.f0 * Math.pow(Math.max(l.f1, 1) / Math.max(l.f0, 1), k);
      if (l.vib) f *= 1 + l.vib[1] * Math.sin(2 * Math.PI * l.vib[0] * t);
      let x;
      if (l.w === 'noise') {
        x = rnd();
        const lp0 = l.lp ?? 1, c = l.sweep != null ? Math.max(l.sweep, lp0 * (1 - k)) : lp0;
        lpv += c * (x - lpv); x = lpv * ((l.lp ?? 1) < 0.5 ? 3 : 1);
      } else {
        ph += f / sr;
        if (l.fm) { mph += (f * l.fm[0]) / sr; x = osc(l.w, ph + (l.fm[1] / (2 * Math.PI)) * Math.sin(2 * Math.PI * mph), l.duty); }
        else x = osc(l.w, ph, l.duty);
        if (l.lp) { lpv += l.lp * (x - lpv); x = lpv; }
      }
      const env = l.flat ? Math.min(1, t / 0.02, (l.d - t) / 0.02) : Math.min(1, t / att) * Math.pow(1 - k, 1.6);
      buf[i0 + i] += x * env * l.v * gain;
    }
  }
}

export function renderSfx(name, sr = SR) {
  const d = SFX_DEFS[name];
  if (!d) return null;
  const buf = new Float32Array(Math.ceil(d.dur * sr));
  mixLayers(buf, d.layers, sr);
  let pk = 0;
  for (const v of buf) pk = Math.max(pk, Math.abs(v));
  const g = pk > 0 ? 0.8 / pk : 1;
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * g * 1.1) * 0.9;
  return buf;
}
export const isLoop = (name) => !!SFX_DEFS[name]?.loop;
