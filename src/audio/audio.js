// WebAudio front-end. Node-importable; pass `ctxFactory` (or globalThis.AudioContext) to enable sound.
import { SFX, MUSIC } from '../core/defs.js';
import { renderSfx, SR } from './sfx.js';
import { renderTrack } from './music.js';

export function createAudio({ bus, ctxFactory } = {}) {
  const vol = { master: 0.8, sfx: 1, music: 0.6 };
  let ctx = null, master = null, sfxBus = null, musBus = null, muted = false;
  let wantMusic = null, curMusic = null, curSrc = null, curGain = null;
  const cache = new Map();
  const mk = ctxFactory ?? (typeof globalThis.AudioContext === 'function' ? () => new globalThis.AudioContext() : typeof globalThis.webkitAudioContext === 'function' ? () => new globalThis.webkitAudioContext() : null);

  const apply = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    const set = (g, v) => { try { g.gain.setTargetAtTime(v, t, 0.01); } catch { g.gain.value = v; } };
    set(master, muted ? 0 : vol.master); set(sfxBus, vol.sfx); set(musBus, vol.music);
  };
  function ensure() {
    if (ctx || !mk) return ctx;
    try {
      ctx = mk();
      master = ctx.createGain(); sfxBus = ctx.createGain(); musBus = ctx.createGain();
      sfxBus.connect(master); musBus.connect(master); master.connect(ctx.destination);
      apply();
    } catch { ctx = null; }
    return ctx;
  }
  function buffer(key, render) {
    if (cache.has(key)) return cache.get(key);
    const data = render();
    if (!data) return null;
    const b = ctx.createBuffer(1, data.length, SR);
    if (b.copyToChannel) b.copyToChannel(data, 0); else b.getChannelData(0).set(data);
    cache.set(key, b);
    return b;
  }
  function startMusic() {
    if (!ctx || wantMusic === curMusic) return;
    if (curSrc) {
      const s = curSrc, g = curGain, t = ctx.currentTime;
      try { g.gain.setTargetAtTime(0, t, 0.08); s.stop(t + 0.4); } catch { try { s.stop(); } catch { /* */ } }
      curSrc = curGain = null;
    }
    curMusic = wantMusic;
    if (!curMusic) return;
    const b = buffer('m:' + curMusic, () => renderTrack(curMusic));
    if (!b) return;
    curSrc = ctx.createBufferSource(); curGain = ctx.createGain();
    curSrc.buffer = b; curSrc.loop = true;
    curSrc.connect(curGain); curGain.connect(musBus);
    curSrc.start(0);
  }
  let hitVoices = 0;
  function play(name) {
    if (!SFX.includes(name) || muted || !ensure()) return;
    if (name === 'hit' && hitVoices >= 8) return;   // voice limit: hit is spammed
    const b = buffer('s:' + name, () => renderSfx(name));
    if (!b) return;
    const src = ctx.createBufferSource();
    src.buffer = b; src.connect(sfxBus);
    if (name === 'hit') {
      hitVoices++;
      try { src.playbackRate.value = 0.8 + Math.random() * 0.5; } catch { /* stub */ }
      const done = () => { hitVoices = Math.max(0, hitVoices - 1); };
      let fired = false;
      src.onended = () => { if (!fired) { fired = true; done(); } };
      // fallback if the context never fires 'ended' (stubs): release after the buffer length
      setTimeout(() => { if (!fired) { fired = true; done(); } }, 120).unref?.();
    }
    src.start(0);
  }
  function music(name) {
    wantMusic = name && MUSIC.includes(name) ? name : null;
    if (ensure()) startMusic();
  }
  const api = {
    resume() { if (ensure() && ctx.state === 'suspended') { const p = ctx.resume?.(); p?.catch?.(() => {}); } startMusic(); return api; },
    setVolume(v = {}) { for (const k of ['master', 'sfx', 'music']) if (typeof v[k] === 'number') vol[k] = Math.min(1, Math.max(0, v[k])); apply(); },
    play, music,
    get muted() { return muted; },
    setMuted(b) { muted = !!b; apply(); },
  };
  bus?.on('sfx', (p) => play(p?.name));
  bus?.on('music', (p) => music(p?.name ?? null));
  return api;
}
