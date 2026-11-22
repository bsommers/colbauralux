// Omega Ratrace entry: wires sim, render, art, audio, input and UI (ARCHITECTURE.md §9).
import { TICK, W, H, DIFFICULTY, hullFor } from './core/defs.js';
import { createBus } from './core/events.js';
import { loadSettings, saveSettings, loadHi, saveHi, topScore } from './core/settings.js';
import { createInput } from './core/input.js';
import { createGame } from './sim/game.js';
import { createAutopilot } from './sim/autopilot.js';
import { createRenderer } from './render/renderer.js';
import { createAudio } from './audio/audio.js';
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { drawText } from './ui/font.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => { const v = Number(q.get(k)); return q.has(k) && isFinite(v) ? v : d; };
const P = { autostart: q.get('autostart') === '1', seed: num('seed', null), wave: Math.max(1, Math.floor(num('wave', 1))), bot: q.get('bot') === '1', debug: q.get('debug') === '1', vic: q.get('vic') === '1', difficulty: (q.get('difficulty') || '').toLowerCase() };

const canvas = document.getElementById('game');
const bus = createBus();
const settings = loadSettings();
if (P.vic) settings.vic = true;
if (DIFFICULTY.some((d) => d.id === P.difficulty)) settings.difficulty = P.difficulty;
let hi = loadHi();

const renderer = createRenderer(canvas, { bus, settings });
const audio = createAudio({ bus });
const hud = createHud(bus);
const bot = createAutopilot();
const demoBus = createBus();                       // attract-mode events: only visual effects reach the main bus
for (const t of ['fx', 'shake', 'flash']) demoBus.on(t, (e) => bus.emit(t, e));

function applySettings(s) {
  audio.setVolume({ master: s.master, sfx: s.sfx, music: s.music });
  audio.setMuted(!!s.mute);
  renderer.setCRT(!!s.crt);
  renderer.setVic(!!s.vic);
  saveSettings(s);
}

let game = null, demo = null, paused = false, hitstop = 0, overT = -1, acc = 0, last = 0, fps = 60;
const fresh = (b, o) => createGame({ bus: b, seed: P.seed ?? ((Date.now() ^ (Math.random() * 1e9)) >>> 0), hiscore: topScore(hi), hull: hullFor(settings.difficulty), ...o });
function newDemo() { demo = fresh(demoBus, { seed: ((Date.now() / 7) | 0) % 9973 + 1, startWave: 1 + (Math.random() * 3 | 0) }); }

const screens = createScreens({
  settings, hi, bus,
  cb: {
    start() { hud.reset(); game = fresh(bus, { startWave: P.wave }); overT = -1; paused = false; },
    quit() { game = null; paused = false; overT = -1; hud.reset(); newDemo(); },
    setPaused(on) { paused = !!on; if (on) bus.emit('sfx', { name: 'menu_select' }); },
    applySettings(s, persist) { applySettings(s); },
    saveHi(list) { hi = list; saveHi(list); },
    fullscreen() { toggleFullscreen(); },
  },
});

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen(); else (document.documentElement.requestFullscreen || (() => {})).call(document.documentElement);
  } catch { /* ignore */ }
}

const input = createInput(window, { textMode: () => screens.mode === 'initials' });
let gestured = false;
function gesture() { if (!gestured) { gestured = true; try { audio.resume(); } catch { /* ignore */ } } }
for (const ev of ['keydown', 'pointerdown', 'touchstart']) window.addEventListener(ev, gesture, { passive: true });

input.onAction((a) => {
  gesture();
  const text = screens.mode === 'initials';
  if (a === 'mute' && !text) { settings.mute = !settings.mute; applySettings(settings); return; }
  if (a === 'crt' && !text) { settings.crt = !settings.crt; applySettings(settings); return; }
  if (a === 'vic' && !text) { settings.vic = !settings.vic; applySettings(settings); return; }
  if (a === 'fullscreen' && !text) { toggleFullscreen(); return; }
  screens.action(a);
});

bus.on('wave', (e) => { if (screens.mode === 'play' && e) bus.emit('music', { name: e.n % 2 ? 'wave_a' : 'wave_b' }); });
bus.on('gameover', () => { if (screens.mode === 'play') overT = 1.6; });
demoBus.on('gameover', () => { demo = null; });
bus.on('pause', (e) => { if (e && e.on === false) hitstop = 0; });
bus.on('hitstop', (e) => { if (e && e.ms) hitstop = Math.min(250, Math.max(hitstop, e.ms)); });

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => renderer.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden) { screens.pauseGame(); input.poll(); } });
window.addEventListener('blur', () => screens.pauseGame());
document.addEventListener('fullscreenchange', () => renderer.resize());

applySettings(settings);
newDemo();
bus.emit('music', { name: 'title' });
if (P.autostart) screens.startGame();

function step(dt) {
  const mode = screens.mode;
  if (mode === 'title') {
    if (!demo) newDemo();
    demo.update(dt, bot.act(demo));
  } else if (game) {
    const raw = input.poll();
    let inp = raw;
    if (P.bot && mode === 'play') inp = bot.act(game);
    else if (mode === 'play' && settings.autofire) inp = { ...raw, fire: true };
    if (mode === 'play' || mode === 'pause' || mode === 'options') game.update(dt, { ...inp, pause: paused });
    else game.update(dt, {});
    if (overT > 0 && (overT -= dt) <= 0) { overT = -1; hud.reset(); screens.onGameOver(game.score); }
  }
  hud.update(dt);
  screens.update(dt);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.1, (now - last) / 1000 || TICK); last = now;
  fps += (1 / Math.max(dtReal, 1e-3) - fps) * 0.05;
  if (screens.mode === 'title' || screens.mode === 'gameover' || screens.mode === 'initials') input.poll(); // keep pad edges alive
  if (hitstop > 0) hitstop -= dtReal * 1000; else acc += dtReal;
  let n = 0;
  while (acc >= TICK && n++ < 5) { step(TICK); acc -= TICK; }
  if (n >= 5) acc = 0;
  const g = screens.mode === 'title' ? demo : game;
  const t = performance.now() / 1000;
  renderer.draw(g, acc / TICK, {
    hud: (ctx, vic) => { const m = screens.mode; if ((m === 'play' || m === 'pause' || m === 'options') && game) hud.draw(ctx, game, t, { vic, quiet: m !== 'play' }); },
    screens: (ctx) => {
      screens.draw(ctx, t);
      if (P.debug) drawText(ctx, `FPS ${fps.toFixed(0)} ENTS ${g ? g.ents.length : 0} ${screens.mode}`, 4, H - 10, { scale: 1, color: '#7df9ff' });
    },
  });
}
requestAnimationFrame(frame);
window.__omega = { bus, screens, input, get game() { return game; }, get demo() { return demo; }, renderer, audio, settings, W };
