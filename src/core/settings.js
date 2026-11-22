import { DIFFICULTY, TUNING } from './defs.js';
// Settings + campaign progress persistence. Node-safe: every storage access is guarded; pass `storage` to inject a fake.
export const SETTINGS_KEY = 'colbauralux.settings';
export const PROGRESS_KEY = 'colbauralux.progress';
export const DEFAULTS = Object.freeze({ master: 0.8, sfx: 1, music: 0.7, crt: true, mute: false, difficulty: 'normal', sendPct: TUNING.defaultSendPct });

function store(storage) {
  if (storage) return storage;
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
const clamp01 = (v, d) => (typeof v === 'number' && isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

/** Validate arbitrary parsed data into a full settings object (unknown keys dropped, bad values defaulted). */
export function sanitizeSettings(o) {
  o = o && typeof o === 'object' ? o : {};
  const b = (k) => (typeof o[k] === 'boolean' ? o[k] : DEFAULTS[k]);
  return {
    master: clamp01(o.master, DEFAULTS.master), sfx: clamp01(o.sfx, DEFAULTS.sfx), music: clamp01(o.music, DEFAULTS.music),
    crt: b('crt'), mute: b('mute'),
    difficulty: DIFFICULTY.some((d) => d.id === o.difficulty) ? o.difficulty : DEFAULTS.difficulty,
    sendPct: TUNING.sendPct.includes(o.sendPct) ? o.sendPct : DEFAULTS.sendPct,
  };
}
export function loadSettings(storage) {
  try { const s = store(storage); return sanitizeSettings(s ? JSON.parse(s.getItem(SETTINGS_KEY)) : null); } catch { return sanitizeSettings(null); }
}
export function saveSettings(settings, storage) {
  try { const s = store(storage); if (s) { s.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings))); return true; } } catch { /* ignore */ }
  return false;
}

/** Stars by clear time vs level.par: <= par 3, <= 1.5*par 2, else 1. */
export function starsFor(time, par) {
  if (!(par > 0) || !(time >= 0)) return 1;
  return time <= par ? 3 : time <= par * 1.5 ? 2 : 1;
}
/** Clean progress data: { cleared: { [levelId]: { time, stars } } }. */
export function sanitizeProgress(o) {
  const cleared = {};
  const src = o && typeof o === 'object' && o.cleared && typeof o.cleared === 'object' ? o.cleared : {};
  for (const k of Object.keys(src)) {
    const e = src[k];
    if (e && typeof e.time === 'number' && isFinite(e.time) && e.time >= 0) {
      cleared[k] = { time: e.time, stars: Math.min(3, Math.max(1, Math.floor(Number(e.stars)) || 1)) };
    }
  }
  return { cleared };
}
export function loadProgress(storage) {
  try { const s = store(storage); return sanitizeProgress(s ? JSON.parse(s.getItem(PROGRESS_KEY)) : null); } catch { return sanitizeProgress(null); }
}
export function saveProgress(progress, storage) {
  try { const s = store(storage); if (s) { s.setItem(PROGRESS_KEY, JSON.stringify(sanitizeProgress(progress))); return true; } } catch { /* ignore */ }
  return false;
}
/** Returns { progress (new), stars, best (bool: new best time) } after clearing `level` in `time` seconds. */
export function recordClear(progress, level, time) {
  const p = sanitizeProgress(progress), id = String(level.id);
  const stars = starsFor(time, level.par);
  const old = p.cleared[id];
  const best = !old || time < old.time;
  if (best) p.cleared[id] = { time, stars: Math.max(stars, old ? old.stars : 0) };
  else p.cleared[id] = { time: old.time, stars: Math.max(stars, old.stars) };
  return { progress: p, stars, best };
}
/** Level index i (0-based) is playable when it is first, previous one cleared, or itself cleared. */
export function isUnlocked(progress, levels, i) {
  if (i <= 0) return true;
  const c = progress && progress.cleared;
  return !!c && (!!c[levels[i - 1].id] || !!c[levels[i].id]);
}
