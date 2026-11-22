// Colbauralux levels: hand-authored campaign, seeded generator, validator. Pure (no DOM, no Math.random).
import { W, H, TUNING, PERSONALITIES } from '../core/defs.js';
import { createRng } from '../core/rng.js';

const MARGIN = 40, GAP = 14, MIN_PLANETS = 5, MAX_PLANETS = 18;
const NEUTRAL_UNITS = [0, 4, 8, 12];

const P = (x, y, size, owner = 0, units) => ({
  x, y, size, owner, units: units ?? (owner ? [0, 8, 12, 16][size] : NEUTRAL_UNITS[size]), level: 0,
});
const A = (owner, personality, difficulty) => (difficulty ? { owner, personality, difficulty } : { owner, personality });

// par = seconds a decent player needs to win (used for star ratings).
export const LEVELS = [
  { id: 1, name: 'First Nibble', blurb: 'Cheese is lying about. Tap, drag, claim. Nobody is looking.', par: 60,
    planets: [P(160, 270, 2, 1, 14), P(400, 150, 1), P(400, 390, 1), P(620, 270, 2), P(820, 150, 1), P(820, 390, 1)],
    ai: [], taunt: 'Purr-fect start.' },
  { id: 2, name: 'Gouda Morning', blurb: 'A lone mouse wakes up hungry. Be quicker to the cheese.', par: 90,
    planets: [P(120, 270, 2, 1, 18), P(300, 130, 1), P(300, 410, 1), P(480, 270, 3), P(660, 130, 1), P(660, 410, 1), P(840, 270, 2, 2, 8)],
    ai: [A(2, 'expander', 'kitten')], taunt: 'Squeak! My cheese!' },
  { id: 3, name: 'Brie Careful', blurb: 'Soft cheese, sharp teeth. The mouse rushes early.', par: 100,
    planets: [P(110, 140, 2, 1, 18), P(110, 400, 1, 1, 8), P(310, 270, 2), P(480, 100, 1), P(480, 440, 1), P(650, 270, 2), P(850, 140, 1, 2, 4), P(850, 400, 2, 2, 10)],
    ai: [A(2, 'rusher', 'kitten')], taunt: 'Brie careful!' },
  { id: 4, name: 'Swiss Army', blurb: 'Full of holes, full of mice. Hold the middle wheel.', par: 120,
    planets: [P(100, 270, 2, 1, 16), P(280, 130, 1), P(280, 410, 1), P(480, 270, 3), P(480, 90, 1), P(480, 450, 1), P(680, 130, 1), P(680, 410, 1), P(860, 270, 2, 2, 14)],
    ai: [A(2, 'balanced')], taunt: 'Holey moley.' },
  { id: 5, name: 'Cheddar Chase', blurb: 'Two rodent clans, one wedge. Let them gnaw each other.', par: 150,
    planets: [P(110, 270, 2, 1, 14), P(300, 270, 1), P(300, 120, 2), P(300, 420, 2), P(520, 270, 3), P(740, 120, 1), P(740, 420, 1), P(860, 130, 2, 2, 14), P(860, 410, 2, 3, 14)],
    ai: [A(2, 'turtle'), A(3, 'expander')], taunt: 'Sharp, aged, and angry.' },
  { id: 6, name: 'Mouse Trap Door', blurb: 'Their wheels sit in a tidy line. Pick them off one by one.', par: 150,
    planets: [P(100, 140, 2, 1, 16), P(100, 400, 1, 1, 6), P(280, 270, 2), P(450, 110, 1), P(450, 430, 1), P(620, 270, 3), P(800, 100, 1, 2, 4), P(800, 270, 2, 2, 14), P(800, 440, 1, 2, 4)],
    ai: [A(2, 'balanced')], taunt: 'Snap!' },
  { id: 7, name: 'Feta Accompli', blurb: 'The map is a done deal. Prove it wrong.', par: 170,
    planets: [P(100, 270, 3, 1, 16), P(260, 110, 1), P(260, 430, 1), P(420, 270, 2), P(540, 120, 1), P(540, 420, 1), P(700, 270, 2), P(860, 130, 2, 2, 14), P(860, 410, 2, 3, 14)],
    ai: [A(2, 'rusher'), A(3, 'balanced')], taunt: 'Feta accompli!' },
  { id: 8, name: 'Parmesan Pursuit', blurb: 'Shaved thin and spread wide. Many wheels, many mice.', par: 180,
    planets: [P(100, 140, 2, 1, 14), P(100, 400, 2, 1, 14), P(280, 270, 2), P(280, 90, 1), P(280, 450, 1), P(480, 270, 3), P(480, 100, 1), P(480, 440, 1),
      P(680, 270, 2), P(860, 140, 2, 2, 14), P(860, 400, 2, 2, 14)],
    ai: [A(2, 'expander')], taunt: 'Grate expectations.' },
  { id: 9, name: 'Muenster Mash', blurb: 'Three factions, one pot. Strike when they are busy.', par: 200,
    planets: [P(110, 270, 2, 1, 14), P(280, 130, 1), P(280, 410, 1), P(480, 270, 3), P(480, 90, 2), P(480, 450, 2), P(680, 130, 1), P(680, 410, 1),
      P(850, 110, 2, 2, 12), P(850, 270, 1, 4, 4), P(850, 430, 2, 3, 12)],
    ai: [A(2, 'balanced'), A(3, 'sniper'), A(4, 'rusher', 'hard')], taunt: 'Mash them!' },
  { id: 10, name: 'Havarti Party', blurb: 'Everyone is invited and nobody is leaving. A cramped dance floor.', par: 210,
    planets: [P(100, 140, 2, 1, 14), P(100, 400, 1, 1, 6), P(250, 270, 2), P(400, 110, 1), P(400, 430, 1), P(560, 270, 2), P(700, 110, 2), P(700, 430, 2),
      P(850, 200, 2, 2, 14), P(850, 340, 1, 3, 6), P(560, 110, 1)],
    ai: [A(2, 'rusher'), A(3, 'turtle')], taunt: 'Party animals!' },
  { id: 11, name: 'Roquefort Rumble', blurb: 'Smells awful, fights dirty. The blue mice tunnel in from the sides.', par: 230,
    planets: [P(100, 270, 3, 1, 18), P(240, 110, 1), P(240, 430, 1), P(400, 270, 2), P(560, 130, 2), P(560, 410, 2), P(720, 270, 2),
      P(850, 110, 2, 2, 14), P(850, 270, 1, 4, 6), P(850, 430, 2, 3, 14), P(330, 80, 1), P(330, 460, 1)],
    ai: [A(2, 'sniper', 'hard'), A(3, 'expander'), A(4, 'turtle')], taunt: 'Rumble in the rind.' },
  { id: 12, name: 'Gruyere Gauntlet', blurb: 'A long run through enemy cheese. Hard mice, harder choices.', par: 240,
    planets: [P(100, 270, 2, 1, 14), P(240, 120, 2, 1, 14), P(240, 420, 2), P(400, 270, 1), P(400, 100, 1), P(400, 440, 1), P(560, 270, 3), P(700, 130, 1), P(700, 410, 1),
      P(850, 130, 2, 2, 8), P(850, 270, 2, 2, 8), P(850, 410, 2, 2, 6)],
    ai: [A(2, 'turtle', 'hard')], taunt: 'Try me, whiskers.' },
  { id: 13, name: 'Mozzarella Meltdown', blurb: 'Stretchy lines, thin margins. They all have a head start.', par: 260,
    planets: [P(100, 140, 2, 1, 14), P(100, 400, 2, 1, 14), P(250, 270, 1), P(380, 100, 2), P(380, 440, 2), P(520, 270, 3), P(660, 100, 1), P(660, 440, 1),
      P(780, 270, 1), P(860, 120, 2, 2, 14), P(860, 420, 2, 3, 14), P(700, 270, 1, 4, 6)],
    ai: [A(2, 'rusher', 'hard'), A(3, 'balanced', 'hard'), A(4, 'sniper')], taunt: 'Melt, melt, melt.' },
  { id: 14, name: 'Stilton Showdown', blurb: 'The vintage vault. Four starts, three rats at the door, one cat.', par: 300,
    planets: [P(100, 270, 3, 1, 18), P(230, 110, 1), P(230, 430, 1), P(380, 270, 2), P(380, 100, 2), P(380, 440, 2), P(540, 270, 3), P(540, 100, 1), P(540, 440, 1),
      P(690, 270, 2), P(700, 110, 1, 4, 6), P(850, 270, 2, 2, 14), P(850, 440, 2, 3, 14), P(850, 100, 2, 3, 14)],
    ai: [A(2, 'turtle', 'normal'), A(3, 'sniper', 'normal'), A(4, 'rusher', 'hard')], taunt: 'Smells like victory. And feet.' },
  { id: 15, name: 'The Big Cheese', blurb: 'Final wheel. Nine lives, nine wheels, one winner. Colby Jack attack!', par: 360,
    planets: [P(100, 270, 3, 1, 20), P(100, 120, 1, 1, 6), P(100, 420, 1, 1, 6), P(260, 270, 2), P(260, 100, 2), P(260, 440, 2), P(430, 180, 1), P(430, 360, 1),
      P(560, 270, 3), P(700, 100, 1), P(700, 440, 1), P(700, 270, 2), P(860, 130, 2, 2, 16), P(860, 270, 2, 3, 16), P(860, 410, 2, 4, 16)],
    ai: [A(2, 'sniper', 'nine'), A(3, 'rusher', 'nine'), A(4, 'turtle', 'nine')], taunt: 'Bow before the Big Cheese.' },
];

export function planetR(size) { return TUNING.planetR[size] ?? TUNING.planetR[2]; }

export function validateLevel(level) {
  const errors = [];
  const ps = level && level.planets;
  if (!Array.isArray(ps)) return { ok: false, errors: ['planets missing'] };
  if (ps.length < MIN_PLANETS) errors.push(`planets ${ps.length} < ${MIN_PLANETS}`);
  if (ps.length > MAX_PLANETS) errors.push(`planets ${ps.length} > ${MAX_PLANETS}`);
  ps.forEach((p, i) => {
    if (![1, 2, 3].includes(p.size)) { errors.push(`planet ${i}: bad size ${p.size}`); return; }
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { errors.push(`planet ${i}: non-finite position`); return; }
    const r = planetR(p.size);
    if (p.x - r < MARGIN || p.x + r > W - MARGIN || p.y - r < MARGIN || p.y + r > H - MARGIN) errors.push(`planet ${i}: out of bounds (margin ${MARGIN})`);
    if (!Number.isInteger(p.units) || p.units < 0) errors.push(`planet ${i}: bad units`);
    if (![0, 1, 2].includes(p.level)) errors.push(`planet ${i}: bad level`);
    if (![0, 1, 2, 3, 4].includes(p.owner)) errors.push(`planet ${i}: bad owner`);
  });
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], b = ps[j];
    if (![1, 2, 3].includes(a.size) || ![1, 2, 3].includes(b.size)) continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y), need = planetR(a.size) + planetR(b.size) + GAP;
    if (d < need) errors.push(`planets ${i},${j}: overlap (dist ${d.toFixed(1)} < ${need})`);
  }
  const owns = (o) => ps.filter((p) => p.owner === o);
  if (!owns(1).length) errors.push('player owns no planet');
  const ais = Array.isArray(level.ai) ? level.ai : [];
  for (const a of ais) {
    if (!(a.owner >= 2 && a.owner <= 4)) errors.push(`ai owner ${a.owner} invalid`);
    if (!owns(a.owner).length) errors.push(`ai owner ${a.owner} owns no planet`);
    if (!PERSONALITIES.includes(a.personality)) errors.push(`ai owner ${a.owner}: bad personality ${a.personality}`);
  }
  if (ps.some((p) => p.owner >= 2 && !ais.some((a) => a.owner === p.owner))) errors.push('planet owned by owner without AI');
  if (level.symmetric) {
    const sides = [1, ...ais.map((a) => a.owner)];
    const sig = (o) => { const s = owns(o); return `${s.length}:${s.reduce((t, p) => t + p.units, 0)}:${s.map((p) => p.size).sort().join('')}`; };
    const first = sig(sides[0]);
    for (const o of sides) if (sig(o) !== first) errors.push(`unequal start strength for owner ${o}`);
  }
  return { ok: errors.length === 0, errors };
}

// Seeded, fair map generator. Homes are spread on an ellipse (player left); neutrals are point-mirrored about the centre.
export function generateLevel(seed, opts = {}) {
  const enemies = Math.max(0, Math.min(3, opts.enemies ?? 1));
  const total = Math.max(MIN_PLANETS, Math.min(MAX_PLANETS, opts.planets ?? 9));
  const symmetric = opts.symmetric !== false;
  const rng = createRng((seed >>> 0) * 2654435761 + 12345);
  const sides = enemies + 1;
  for (let attempt = 0; attempt < 200; attempt++) {
    const lvl = tryGenerate(rng, seed, sides, enemies, total, symmetric, attempt);
    if (lvl && validateLevel(lvl).ok) return lvl;
  }
  return fallback(seed, enemies, symmetric);
}

function tryGenerate(rng, seed, sides, enemies, total, symmetric, attempt) {
  const planets = [];
  const homeSize = 2, homeUnits = 14;
  // homes on ellipse, side 0 = player at the left
  const rot = enemies === 1 ? 0 : rng.range(-0.15, 0.15);
  for (let s = 0; s < sides; s++) {
    const ang = Math.PI + (s * 2 * Math.PI) / sides + rot;
    const x = W / 2 + Math.cos(ang) * 380, y = H / 2 + Math.sin(ang) * 175;
    planets.push({ x: Math.round(x), y: Math.round(y), size: homeSize, owner: s === 0 ? 1 : s + 1, units: homeUnits, level: 0 });
  }
  let remaining = total - sides;
  if (remaining < 0) return null;
  const neutralTarget = remaining;
  const pairs = Math.floor(neutralTarget / 2);
  const centre = neutralTarget % 2 === 1;
  if (centre) planets.push({ x: W / 2, y: H / 2, size: rng.pick([2, 3]), owner: 0, units: 0, level: 0 });
  if (centre) planets[planets.length - 1].units = NEUTRAL_UNITS[planets[planets.length - 1].size];
  const clear = (x, y, size) => planets.every((p) => Math.hypot(p.x - x, p.y - y) >= planetR(p.size) + planetR(size) + GAP + 6);
  for (let k = 0; k < pairs; k++) {
    let placed = false;
    for (let t = 0; t < 60 && !placed; t++) {
      const size = rng.pick([1, 1, 2, 2, 3]);
      const r = planetR(size);
      const x = rng.range(MARGIN + r, W - MARGIN - r), y = rng.range(MARGIN + r, H - MARGIN - r);
      const mx = W - x, my = H - y, units = NEUTRAL_UNITS[size];
      if (!clear(x, y, size)) continue;
      if (Math.hypot(x - mx, y - my) < 2 * r + GAP + 6) continue;
      planets.push({ x: Math.round(x), y: Math.round(y), size, owner: 0, units, level: 0 });
      if (!clear(mx, my, size) || Math.hypot(mx - Math.round(x), my - Math.round(y)) < 2 * r + GAP) { planets.pop(); continue; }
      planets.push({ x: Math.round(mx), y: Math.round(my), size, owner: 0, units, level: 0 });
      placed = true;
    }
    if (!placed) return null;
  }
  const ai = [];
  for (let e = 0; e < enemies; e++) ai.push({ owner: e + 2, personality: rng.pick(PERSONALITIES), difficulty: 'normal' });
  return {
    id: `gen-${seed}`, name: 'Random Rind', blurb: `A freshly cut wheel of seed ${seed}.`, par: 60 + total * 12 + enemies * 40,
    planets, ai, symmetric: symmetric && true, taunt: 'Cut the cheese!', seed,
  };
}

function fallback(seed, enemies, symmetric) {
  const planets = [
    { x: 120, y: 270, size: 2, owner: 1, units: 14, level: 0 }, { x: 840, y: 270, size: 2, owner: 2, units: 14, level: 0 },
    { x: 480, y: 270, size: 3, owner: 0, units: 12, level: 0 }, { x: 480, y: 120, size: 1, owner: 0, units: 4, level: 0 }, { x: 480, y: 420, size: 1, owner: 0, units: 4, level: 0 },
  ];
  return { id: `gen-${seed}`, name: 'Random Rind', blurb: 'A safe wheel.', par: 120, planets, ai: [{ owner: 2, personality: 'balanced', difficulty: 'normal' }], symmetric, taunt: 'Cut the cheese!', seed };
}
