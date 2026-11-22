// Dump every SFX and MUSIC track to out/audio/*.wav and print peak/rms.  usage: node tools/sfx-wav.mjs [outdir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { SFX, MUSIC } from '../src/core/defs.js';
import { renderSfx, SR } from '../src/audio/sfx.js';
import { renderTrack } from '../src/audio/music.js';

export function wav16(f32, sr = SR) {
  const b = Buffer.alloc(44 + f32.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + f32.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(f32.length * 2, 40);
  for (let i = 0; i < f32.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, f32[i])) * 32767), 44 + i * 2);
  return b;
}
export function stats(f) {
  let pk = 0, s = 0;
  for (const v of f) { pk = Math.max(pk, Math.abs(v)); s += v * v; }
  return { peak: pk, rms: Math.sqrt(s / f.length), sec: f.length / SR };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? 'out/audio';
  mkdirSync(dir, { recursive: true });
  for (const [kind, names, fn] of [['sfx', SFX, renderSfx], ['music', MUSIC, renderTrack]]) {
    for (const n of names) {
      const f = fn(n); writeFileSync(`${dir}/${kind}_${n}.wav`, wav16(f));
      const s = stats(f);
      console.log(`${kind}_${n} ${s.sec.toFixed(2)}s peak=${s.peak.toFixed(2)} rms=${s.rms.toFixed(3)}`);
    }
  }
}
