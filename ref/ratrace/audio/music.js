// Step-sequenced chip tracks, rendered offline to loopable Float32Array buffers.
import { SR } from './sfx.js';

const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Tracks: bpm, steps per bar = 16, bars >= 8. Each voice: wave, vol, notes[bars*16] (midi | null | 0=rest), gate (fraction of step).
function build({ bpm, bars, prog, arp, bass, lead, arpW = 'square', leadW = 'square', drums = true, swing = 0, vol = {} }) {
  const n = bars * 16;
  const A = new Array(n).fill(null), B = new Array(n).fill(null), Ld = new Array(n).fill(null), D = new Array(n).fill(null);
  for (let b = 0; b < bars; b++) {
    const ch = prog[b % prog.length]; // {r:root midi, t:[intervals]}
    for (let s = 0; s < 16; s++) {
      const i = b * 16 + s;
      const pat = arp[s % arp.length];
      if (pat != null) A[i] = ch.r + 12 + ch.t[pat % ch.t.length] + (pat >= ch.t.length ? 12 : 0);
      const bp = bass[s];
      if (bp != null) B[i] = ch.r - 12 + bp;
      const lp = lead?.[(b % lead.length)]?.[s];
      if (lp != null) Ld[i] = ch.r + 12 + lp;
      if (drums) D[i] = s % 4 === 0 ? 'k' : s % 4 === 2 ? 'h' : (s % 8 === 6 ? 's' : null);
    }
  }
  return { bpm, bars, swing, voices: [
    { wave: arpW, vol: vol.arp ?? 0.16, notes: A, gate: 0.6, duty: 0.25 },
    { wave: 'tri', vol: vol.bass ?? 0.42, notes: B, gate: 0.85 },
    { wave: leadW, vol: vol.lead ?? 0.2, notes: Ld, gate: 0.9, duty: 0.5, vib: true },
  ], drums: D };
}
const m = [0, 3, 7], M = [0, 4, 7], m7 = [0, 3, 7, 10];
const OCT = [0, 2, 4, 2, 0, 2, 4, 2, 0, 2, 4, 2, 0, 2, 4, 2];

export const TRACKS = {
  // heroic/jaunty C major
  title: build({ bpm: 128, bars: 8, prog: [{ r: 60, t: M }, { r: 65, t: M }, { r: 67, t: M }, { r: 60, t: M }, { r: 57, t: m }, { r: 65, t: M }, { r: 67, t: M }, { r: 67, t: M }],
    arp: [0, null, 1, null, 2, null, 1, null], bass: [0, null, null, 0, 7, null, null, 0, 0, null, null, 0, 7, null, 12, null],
    lead: [[12, null, null, 7, null, 12, null, 14, 16, null, null, null, 14, null, 12, null], [null, 16, null, 14, 12, null, 7, null, 9, null, 12, null, null, null, null, null]], vol: { lead: 0.24 } }),
  // driving minor, chip arps
  wave_a: build({ bpm: 138, bars: 8, prog: [{ r: 57, t: m7 }, { r: 57, t: m7 }, { r: 53, t: [0, 4, 7, 11] }, { r: 55, t: M }, { r: 57, t: m7 }, { r: 60, t: M }, { r: 53, t: [0, 4, 7, 11] }, { r: 52, t: M }],
    arp: [0, 1, 2, 3, 2, 1, 2, 3], bass: [0, null, 0, null, 0, null, 12, null, 0, null, 0, null, 7, null, 5, null], arpW: 'square' }),
  // faster, tenser
  wave_b: build({ bpm: 164, bars: 8, prog: [{ r: 55, t: m }, { r: 51, t: M }, { r: 53, t: m }, { r: 50, t: M }, { r: 55, t: m }, { r: 51, t: M }, { r: 58, t: M }, { r: 50, t: [0, 4, 7, 10] }],
    arp: [0, 2, 1, 2, 0, 2, 1, 2], bass: [0, 0, null, 0, 0, null, 0, 7, 0, 0, null, 0, 0, null, 12, 7], arpW: 'saw',
    lead: [[null, null, 12, null, 15, null, 14, null, null, null, 10, null, 12, null, null, null]], leadW: 'square', vol: { arp: 0.12, lead: 0.18 } }),
  // sad, slow, no drums
  gameover: build({ bpm: 70, bars: 8, prog: [{ r: 57, t: m }, { r: 53, t: M }, { r: 55, t: M }, { r: 52, t: m }, { r: 57, t: m }, { r: 53, t: M }, { r: 52, t: m }, { r: 52, t: m }],
    arp: [0, null, null, null, 1, null, null, null, 2, null, null, null, 1, null, null, null], bass: [0, null, null, null, null, null, null, null, 7, null, null, null, null, null, null, null], drums: false, arpW: 'tri',
    lead: [[12, null, null, null, null, null, 11, null, 9, null, null, null, null, null, null, null], [null, null, null, null, 7, null, null, null, 4, null, null, null, null, null, null, null]], leadW: 'tri', vol: { arp: 0.25, lead: 0.3 } }),
  // fanfare, bright
  hiscore: build({ bpm: 144, bars: 8, prog: [{ r: 60, t: M }, { r: 67, t: M }, { r: 65, t: M }, { r: 60, t: M }, { r: 65, t: M }, { r: 67, t: M }, { r: 69, t: m }, { r: 67, t: M }],
    arp: [0, 1, 2, 1, 2, 1, 2, 1], bass: [0, null, 7, null, 0, null, 7, null, 0, null, 7, null, 12, null, 7, null],
    lead: [[0, null, 4, null, 7, null, 12, 12, null, null, 7, null, 12, null, 16, null], [14, null, 12, null, 11, null, 12, null, 7, null, null, null, 4, null, 7, null]], vol: { lead: 0.26 } }),
};

export function trackSeconds(t) { return (t.bars * 16 * 60) / (t.bpm * 4); }

export function renderTrack(name, sr = SR) {
  const t = TRACKS[name];
  if (!t) return null;
  const stepT = 60 / (t.bpm * 4), n = t.bars * 16, len = Math.round(n * stepT * sr);
  const buf = new Float32Array(len);
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (const v of t.voices) {
    for (let i = 0; i < n; i++) {
      const mn = v.notes[i];
      if (mn == null) continue;
      const f = mf(mn), i0 = Math.round(i * stepT * sr), nn = Math.round(stepT * v.gate * sr * (v.wave === 'tri' && v.gate > 0.8 ? 1.4 : 1));
      let ph = 0;
      for (let j = 0; j < nn; j++) {
        const tt = j / sr, k = j / nn;
        ph += (f * (v.vib ? 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * tt) : 1)) / sr;
        const p = ph % 1;
        let x = v.wave === 'square' ? (p < (v.duty ?? 0.5) ? 1 : -1) : v.wave === 'saw' ? 2 * p - 1 : p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
        x *= Math.min(1, tt / 0.003) * Math.min(1, (1 - k) * 8) * (v.wave === 'tri' ? 1 : 0.6 + 0.4 * (1 - k));
        buf[(i0 + j) % len] += x * v.vol;   // wrap tail for seamless loop
      }
    }
  }
  if (t.drums) for (let i = 0; i < n; i++) {
    const d = t.drums[i];
    if (!d) continue;
    const i0 = Math.round(i * stepT * sr), dd = d === 'k' ? 0.14 : d === 's' ? 0.1 : 0.04, nn = Math.round(dd * sr);
    let ph = 0, lp = 0;
    for (let j = 0; j < nn; j++) {
      const k = j / nn, e = Math.pow(1 - k, 2);
      let x;
      if (d === 'k') { ph += (130 * Math.pow(0.25, k)) / sr; x = Math.sin(2 * Math.PI * ph) * 0.55; }
      else { const r = rnd(); lp += (d === 's' ? 0.5 : 0.9) * (r - lp); x = (d === 's' ? lp : r - lp) * (d === 's' ? 0.35 : 0.18); }
      buf[(i0 + j) % len] += x * e;
    }
  }
  let pk = 0;
  for (const v of buf) pk = Math.max(pk, Math.abs(v));
  const g = pk > 0 ? 0.75 / pk : 1;
  for (let i = 0; i < len; i++) buf[i] *= g;
  return buf;
}
