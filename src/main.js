// Colbauralux entry: wires sim, render, audio, input and UI (ARCHITECTURE.md §10).
import { TICK, TUNING, PLAYER } from './core/defs.js';
import { createBus } from './core/events.js';
import { loadSettings, saveSettings, loadProgress, saveProgress } from './core/settings.js';
import { createInput } from './core/input.js';
import { createGame } from './sim/game.js';
import { LEVELS, generateLevel } from './sim/levels.js';
import { createRenderer } from './render/renderer.js';
import { createHud, hudHit } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { drawText } from './ui/font.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => { const v = Number(q.get(k)); return q.has(k) && q.get(k) !== '' && isFinite(v) ? v : d; };
const P = { autostart: q.get('autostart') === '1', level: num('level', null), seed: num('seed', null), bot: q.get('bot') === '1', debug: q.get('debug') === '1' };

const canvas = document.getElementById('game');
const bus = createBus();
const settings = loadSettings();
const progress = loadProgress();

// Optional modules: guard so the shell still runs while siblings are missing.
async function opt(path, fn, fallback) { try { const m = await import(path); return fn(m); } catch (e) { if (P.debug) console.warn('optional module failed', path, e); return fallback; } }
const audio = await opt('./audio/audio.js', (m) => m.createAudio({ bus }), null);
const autopilot = await opt('./sim/autopilot.js', (m) => m.createAutopilot, null);

const renderer = createRenderer(canvas, { bus, settings });
const hud = createHud(bus);
const demoBus = createBus();                         // attract demo: only visual effects reach the main bus
for (const t of ['fx', 'shake', 'flash']) demoBus.on(t, (e) => bus.emit(t, e));

let game = null, demo = null, demoBot = null, demoEnd = 0, bot = null;
let paused = false, speedIdx = 0, acc = 0, last = 0, fps = 60, resultT = -1, lastSel = 0, gestured = false;
const speed = () => TUNING.speedSteps[speedIdx] || 1;

function applySettings(s) {
  try { audio && audio.setVolume && audio.setVolume({ master: s.master, sfx: s.sfx, music: s.music }); audio && audio.setMuted && audio.setMuted(!!s.mute); } catch { /* ignore */ }
  renderer.setCRT(!!s.crt);
  if (game) game.setSendPct(s.sendPct);
  saveSettings(s);
}

function begin(level, seed) {
  hud.reset(); input.clear(); paused = false; resultT = -1; acc = 0;
  game = createGame({ seed, bus, level, difficulty: settings.difficulty, sendPct: settings.sendPct, ai: true });
  bot = P.bot && autopilot ? autopilot({ owner: PLAYER }) : null;
  bus.emit('music', { name: 'play_a' });
  if (level.taunt) bus.emit('taunt', { text: level.taunt, dur: 3, owner: (level.ai && level.ai[0] && level.ai[0].owner) || 2 });
  bus.emit('banner', { text: level.name ? level.name.toUpperCase() : 'SKIRMISH', sub: level.blurb || '', dur: 2.5 });
}
function skirmishSeed() { return P.seed != null ? P.seed : ((Date.now() ^ (Math.random() * 1e9)) >>> 0) % 100000; }

function newDemo() {
  const seed = (Date.now() / 7 | 0) % 9973 + 1;
  const level = generateLevel(seed, { enemies: 1, planets: 9 });
  demo = createGame({ seed, bus: demoBus, level, ai: true });
  demoBot = autopilot ? autopilot({ owner: PLAYER, personality: 'balanced' }) : null;
  demoEnd = 0;
}

const screens = createScreens({
  settings, progress, levels: LEVELS, bus, unlockAll: P.debug || P.level != null,
  cb: {
    startLevel(i) { begin(LEVELS[i], 1000 + LEVELS[i].id); },
    startSkirmish() { const seed = skirmishSeed(); begin(generateLevel(seed, { enemies: 1 + (seed % 3), planets: 9 }), seed); },
    restart() {},
    quit() { game = null; paused = false; resultT = -1; hud.reset(); input.clear(); newDemo(); },
    setPaused(on) { paused = !!on; if (on) bus.emit('sfx', { name: 'pause' }); bus.emit('pause', { on: !!on }); },
    applySettings(s) { applySettings(s); },
    saveProgress(p) { saveProgress(p); },
    fullscreen() { toggleFullscreen(); },
  },
});

function toggleFullscreen() {
  try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); } catch { /* ignore */ }
}

const input = createInput(canvas, {
  toLogical: (x, y) => renderer.toLogical(x, y),
  getGame: () => game,
  hudHit: (x, y) => (screens.mode === 'play' ? hudHit(x, y) : null),
  enabled: false,
});
function gesture() { if (!gestured) { gestured = true; try { audio && audio.resume && audio.resume(); } catch { /* ignore */ } } }
for (const ev of ['keydown', 'pointerdown', 'touchstart']) window.addEventListener(ev, gesture, { passive: true });

function act(a) {
  gesture();
  if (a && a.hud) a = a.hud;
  if (a === 'mute') { settings.mute = !settings.mute; applySettings(settings); return; }
  if (a === 'crt') { settings.crt = !settings.crt; applySettings(settings); return; }
  if (a === 'fullscreen') { toggleFullscreen(); return; }
  if (a === 'speed') { if (screens.mode === 'play') { speedIdx = (speedIdx + 1) % TUNING.speedSteps.length; bus.emit('sfx', { name: 'speed' }); } return; }
  if (a && a.sendPct) { settings.sendPct = a.sendPct; if (game) game.setSendPct(a.sendPct); saveSettings(settings); bus.emit('sfx', { name: 'menu_move' }); return; }
  if (a === 'all' || (a && a.sent !== undefined)) return;
  screens.action(a);
}
input.onAction(act);

bus.on('state', (e) => { if (e && screens.mode === 'play' && (e.state === 'won' || e.state === 'lost')) resultT = 1.4; });
window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => renderer.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden) screens.pauseGame(); });
window.addEventListener('blur', () => screens.pauseGame());
document.addEventListener('fullscreenchange', () => renderer.resize());

applySettings(settings);
newDemo();
bus.emit('music', { name: 'title' });
if (P.level != null) screens.startLevel(Math.max(0, Math.min(LEVELS.length - 1, Math.floor(P.level) - 1)));
else if (P.seed != null && !P.autostart) screens.startSkirmish();
else if (P.autostart) screens.startLevel(0);

function step(dt) {
  const mode = screens.mode;
  if (game && mode === 'play') {
    if (bot) bot.act(game, dt);
    game.update(dt);
    if (resultT > 0 && (resultT -= dt) <= 0) { resultT = -1; screens.onResult(game, game.state === 'won'); }
  } else if (!game && demo) {
    if (demoBot) demoBot.act(demo, dt);
    demo.update(dt);
    if (demo.state !== 'play' && (demoEnd += dt) > 3) newDemo();
  }
  hud.update(dt);
  screens.update(dt);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.1, (now - last) / 1000 || TICK); last = now;
  fps += (1 / Math.max(dtReal, 1e-3) - fps) * 0.05;
  const mode = screens.mode;
  input.setEnabled(mode === 'play' && !paused);
  acc += dtReal * (mode === 'play' ? speed() : 1);
  let n = 0;
  while (acc >= TICK && n++ < 12) { step(TICK); acc -= TICK; }
  if (n >= 12) acc = 0;
  const fs = input.poll();
  if (fs.selection.size > lastSel) bus.emit('sfx', { name: 'select' });
  lastSel = fs.selection.size;
  const g = game || demo;
  const t = now / 1000;
  const inPlay = !!game && (mode === 'play' || mode === 'pause' || mode === 'options');
  renderer.draw(g, acc / TICK, {
    selection: fs.selection, hover: mode === 'play' ? fs.hover : null, target: fs.target, dragPath: fs.dragPath,
    hud: (ctx) => { if (inPlay) hud.draw(ctx, game, t, { quiet: mode !== 'play', speed: speed(), paused, sendPct: settings.sendPct, selected: fs.selection.size }); },
    screens: (ctx) => {
      screens.draw(ctx, t);
      if (P.debug) drawText(ctx, `FPS ${fps.toFixed(0)} SHIPS ${g ? g.ships.length : 0} ${mode}`, 4, 540 - 10, { scale: 1, color: '#7df9ff' });
    },
  });
}
requestAnimationFrame(frame);
window.__colbauralux = { bus, screens, input, renderer, audio, settings, get game() { return game; }, get demo() { return demo; } };
