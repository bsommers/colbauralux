// Pure-JS SFX synthesis: every effect is a list of layers rendered to a Float32Array (Node-safe, deterministic).
export const SR = 22050;

// layer: {w:'sine|square|saw|tri|noise', f0, f1?, t0?, d, v, a?, fm?:[ratio,index], lp?:0..1, duty?, vib?:[hz,depth]}
const L = (w, f0, f1, d, v, o = {}) => ({ w, f0, f1: f1 ?? f0, d, v, ...o });
const note = (m) => 440 * Math.pow(2, (m - 69) / 12);
const arp = (ms, step, w, v, d) => ms.map((m, i) => L(w, note(m), note(m), d, v, { t0: i * step }));

export const SFX_DEFS = {
  select: { dur: 0.1, layers: [L('sine', 700, 1100, 0.1, 0.5)] },
  // one rising whoosh per send command
  send: { dur: 0.32, layers: [L('saw', 180, 1100, 0.3, 0.35, { lp: 0.4 }), L('noise', 0, 0, 0.3, 0.3, { lp: 0.25, sweep: 0.05 })] },
  launch: { dur: 0.35, layers: [L('saw', 120, 900, 0.3, 0.4, { lp: 0.5 }), L('noise', 0, 0, 0.3, 0.3, { lp: 0.3 })] },
  // spammed: very short, quiet
  hit: { dur: 0.05, layers: [L('noise', 0, 0, 0.04, 0.5, { lp: 0.5 }), L('square', 520, 160, 0.05, 0.3)] },
  capture: { dur: 0.6, layers: arp([60, 64, 67, 72, 76], 0.09, 'square', 0.35, 0.18).concat(arp([48, 55], 0.2, 'tri', 0.4, 0.3)) },
  lost: { dur: 0.7, layers: arp([69, 65, 62, 57], 0.16, 'saw', 0.3, 0.22).concat([L('sine', 110, 55, 0.35, 0.4, { t0: 0.35 })]) },
  levelup: { dur: 0.7, layers: [L('sine', 1320, 1320, 0.5, 0.5, { fm: [3.5, 1.5] }), L('sine', 1760, 1760, 0.6, 0.35, { t0: 0.12, fm: [3.5, 1] }), L('sine', 880, 880, 0.3, 0.3)] },
  neutral_capture: { dur: 0.4, layers: arp([67, 72, 76], 0.08, 'square', 0.35, 0.16) },
  win: { dur: 1.2, layers: arp([60, 64, 67, 72, 67, 72, 76, 79], 0.1, 'square', 0.35, 0.2).concat(arp([48, 52, 55, 60], 0.2, 'tri', 0.4, 0.4)) },
  lose: { dur: 1.4, layers: arp([67, 63, 60, 55], 0.28, 'saw', 0.35, 0.4).concat([L('sine', 90, 40, 0.5, 0.5, { t0: 0.9 })]) },
  menu_move: { dur: 0.06, layers: [L('square', 880, 880, 0.06, 0.4, { duty: 0.5 })] },
  menu_select: { dur: 0.25, layers: [L('square', 660, 660, 0.08, 0.4), L('square', 990, 990, 0.17, 0.4, { t0: 0.08 })] },
  // formant blips
  meow: { dur: 0.5, layers: [L('saw', 500, 900, 0.14, 0.4, { vib: [9, 0.02], lp: 0.35 }), L('saw', 900, 480, 0.34, 0.4, { t0: 0.14, vib: [8, 0.05], lp: 0.3 }), L('sine', 1800, 1500, 0.4, 0.15, { fm: [2, 1.2] })] },
  squeak: { dur: 0.14, layers: [L('sine', 1800, 3000, 0.07, 0.5), L('sine', 3000, 2200, 0.07, 0.5, { t0: 0.07 }), L('square', 2400, 2400, 0.12, 0.12, { lp: 0.3 })] },
  speed: { dur: 0.3, layers: arp([72, 79, 84], 0.07, 'square', 0.3, 0.12) },
  pause: { dur: 0.2, layers: [L('square', 523, 523, 0.08, 0.35), L('square', 392, 392, 0.12, 0.35, { t0: 0.08 })] },
  star: { dur: 0.45, layers: [L('sine', 1568, 1568, 0.4, 0.4, { fm: [2, 1] }), L('sine', 2093, 2093, 0.3, 0.3, { t0: 0.1 })] },
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
