import test from 'node:test';
import assert from 'node:assert/strict';
import { SFX, MUSIC } from '../src/core/defs.js';
import { createBus } from '../src/core/events.js';
import { createAudio } from '../src/audio/audio.js';
import { renderSfx, SFX_DEFS, SR } from '../src/audio/sfx.js';
import { renderTrack, TRACKS, trackSeconds } from '../src/audio/music.js';

const pk = (f) => f.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

function fakeCtx() {
  const log = { sources: [], started: 0, state: 'suspended' };
  const param = () => ({ value: 0, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect() {}, gain: param() });
  const ctx = {
    currentTime: 0, destination: {}, get state() { return log.state; },
    resume() { log.state = 'running'; return Promise.resolve(); },
    createGain: node,
    createBuffer: (c, n) => ({ length: n, getChannelData: () => new Float32Array(n) }),
    createBufferSource() {
      const s = { connect() {}, buffer: null, loop: false, playbackRate: { value: 1 }, start() { log.started++; }, stop() {} };
      log.sources.push(s); return s;
    },
  };
  return { ctx, log };
}

test('every SFX and MUSIC name has a definition', () => {
  for (const n of SFX) assert.ok(SFX_DEFS[n], 'sfx ' + n);
  for (const n of MUSIC) assert.ok(TRACKS[n], 'music ' + n);
});

test('offline SFX: finite, audible, no clipping, sane duration', () => {
  for (const n of SFX) {
    const f = renderSfx(n);
    assert.ok(f.length / SR > 0.03 && f.length / SR < 2, n + ' duration');
    const p = pk(f);
    assert.ok(p > 0.3 && p <= 0.95, `${n} peak ${p}`);
    assert.ok(f.every(Number.isFinite), n);
  }
  assert.ok(renderSfx('hit').length / SR <= 0.1, 'hit very short');
});

test('offline MUSIC: >= 8 bars, peak ok, loop seam smooth', () => {
  for (const n of MUSIC) {
    assert.ok(TRACKS[n].bars >= 8, n);
    const f = renderTrack(n);
    assert.ok(Math.abs(f.length / SR - trackSeconds(TRACKS[n])) < 0.01, n + ' length');
    const p = pk(f);
    assert.ok(p > 0.5 && p <= 0.8, `${n} peak ${p}`);
    assert.ok(f.every(Number.isFinite), n);
    // seam: jump between last and first sample no bigger than typical sample-to-sample step
    let big = 0; for (let i = 1; i < f.length; i++) big = Math.max(big, Math.abs(f[i] - f[i - 1]));
    assert.ok(Math.abs(f[0] - f[f.length - 1]) <= Math.max(0.25, big), `${n} seam`);
    assert.deepEqual(Array.from(renderTrack(n).slice(0, 500)), Array.from(f.slice(0, 500)), n + ' deterministic');
  }
});

test('createAudio is Node-safe with no AudioContext', () => {
  const bus = createBus();
  const a = createAudio({ bus });
  a.play('capture'); a.music('title'); a.resume(); a.setVolume({ master: 0.5 });
  bus.emit('sfx', { name: 'hit' }); bus.emit('music', { name: null });
  a.setMuted(true); assert.equal(a.muted, true);
});

test('plays every name through a stub context, bus-driven', async () => {
  const { ctx, log } = fakeCtx();
  const bus = createBus();
  const a = createAudio({ bus, ctxFactory: () => ctx });
  await a.resume();
  for (const n of SFX) bus.emit('sfx', { name: n });
  bus.emit('sfx', { name: 'bogus' });
  const sfxStarted = log.started;
  assert.equal(sfxStarted, SFX.length);
  for (const n of MUSIC) bus.emit('music', { name: n });
  assert.ok(log.sources.some((s) => s.loop));
  bus.emit('music', { name: null });
  a.setMuted(true); a.play('select');
  assert.equal(log.sources.length, SFX.length + MUSIC.length);
});

test('hit is voice-limited to 8 concurrent', () => {
  const { ctx, log } = fakeCtx();
  const a = createAudio({ ctxFactory: () => ctx });
  for (let i = 0; i < 30; i++) a.play('hit');
  assert.equal(log.started, 8);
});
