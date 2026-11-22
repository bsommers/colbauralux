// Canonical constants for OMEGA RATRACE. FROZEN: owned by the orchestrator. See ARCHITECTURE.md.
export const W = 800, H = 450;                                   // logical playfield size (units = logical px)
export const BOX = Object.freeze({ x0: 190, y0: 130, x1: 610, y1: 320 }); // central "Mouse Hole" box (solid for ship/shots; mice spawn from it)
export const TICK = 1 / 60;

export const PALETTE = Object.freeze({
  bg: '#05030f', wall: '#7df9ff', wallHot: '#ff4fd8', box: '#ffc933', cheese: '#ffc933', orange: '#ff8a1f', cream: '#fff3cf',
  colby: '#ff9b2e', colbyWhite: '#fff6e0', mouse: '#a8b0d8', rat: '#c27bff', cmd: '#ff5470', mine: '#ffe14d', death: '#ff2d55',
  hairball: '#fff6a8', ebullet: '#ff5fa2', text: '#fff3cf', dim: '#7a7aa8',
});

export const TUNING = Object.freeze({
  ship: { r: 11, rotSpeed: 4.6, aimRate: 7, thrust: 260, maxSpeed: 330, drag: 0.12, bounce: 0.88, fireCooldown: 0.16, maxShots: 4,
          invulnAfterDeath: 2.5, dyingTime: 1.4, bombs: 1 },
  shot: { speed: 520, life: 1.5, r: 3, ricochets: 1 },          // player hairballs ricochet off walls once, inherit ship velocity * 0.5
  ebullet: { speed: 210, life: 3.2, r: 4 },
  lives: 3, extraLifeAt: [10000, 30000], extraLifeEvery: 30000,
  waveClearDelay: 2.2, introTime: 2.0, bombRadius: 170,
  deathRatAfter: 42,                                             // seconds into a wave before the Death Rat hunts the player
  restitution: { mouse: 1, rat: 0.9, commander: 0.9, mine: 0.6, deathrat: 1 },
});

// kind -> definition. r = collision radius, hp, score, team ('enemy'), speed = cruise speed (sim-enemies may tune).
export const KINDS = Object.freeze({
  mouse:     { r: 10, hp: 1, score: 100,  speed: 90,  desc: 'Droid mouse: drifts in straight lines, bounces off walls' },
  rat:       { r: 12, hp: 2, score: 250,  speed: 140, desc: 'Chaser rat: homes on Colby with wall-aware steering' },
  commander: { r: 15, hp: 3, score: 500,  speed: 70,  desc: 'Commander rat: slow, fires cheese-pellet bursts, drops tuna' },
  mine:      { r: 9,  hp: 1, score: 150,  speed: 30,  desc: 'Cheese mine (Swiss wheel): drifts, arms, bursts into 6 crumbs when shot' },
  deathrat:  { r: 18, hp: 99, score: 0,   speed: 175, desc: 'Death Rat: unkillable, fast, hunts Colby after TUNING.deathRatAfter seconds' },
  tuna:      { r: 9,  hp: 1, score: 500,  speed: 0,   desc: 'Pickup: +500 and +1 yarn bomb (max 3); expires after 8 s' },
  hairball:  { r: 3,  hp: 1, score: 0,    speed: 520, desc: 'Player shot' },
  ebullet:   { r: 4,  hp: 1, score: 0,    speed: 210, desc: 'Enemy cheese pellet' },
});

// Difficulty levels: hull = damaging hits Colby survives per life.
export const DIFFICULTY = Object.freeze([
  { id: 'hard', label: 'HARD', hull: 3 }, { id: 'normal', label: 'NORMAL', hull: 5 },
  { id: 'easy', label: 'EASY', hull: 8 }, { id: 'kitten', label: 'KITTEN', hull: 13 },
]);
export const DEFAULT_DIFFICULTY = 'normal';
export const hullFor = (id) => (DIFFICULTY.find((d) => d.id === id) ?? DIFFICULTY[1]).hull;
export const HULL_INVULN = 1.2;

export const SPRITES = Object.freeze(['colby', 'colby_icon', 'hairball', 'mouse', 'rat', 'commander', 'mine', 'deathrat', 'ebullet', 'tuna', 'yarn']);

export const SFX = Object.freeze(['thrust', 'fire', 'bounce', 'hit', 'boom_small', 'boom_big', 'mine_burst', 'ebullet', 'pickup', 'bomb', 'death',
  'wave_start', 'wave_clear', 'extralife', 'deathrat_warn', 'menu_move', 'menu_select', 'gameover', 'hiscore', 'launch']);
export const MUSIC = Object.freeze(['title', 'wave_a', 'wave_b', 'gameover', 'hiscore']);

// Event bus types (bus.emit(type, payload)); sim emits, render/audio/ui subscribe.
export const EVENTS = Object.freeze(['sfx', 'music', 'fx', 'shake', 'flash', 'hitstop', 'popup', 'wave', 'banner', 'score', 'life', 'bombs',
  'combo', 'gameover', 'pause', 'taunt', 'hull']);
export const FX_TYPES = Object.freeze(['boom_small', 'boom_big', 'crumbs', 'spark', 'ring', 'thrust', 'trail', 'launch', 'confetti']);

export const TAUNTS = Object.freeze(['SQUEAK!', 'CATCH ME IF YOU CAN', 'CHEESE IS MINE', 'NOT THE LASER POINTER!', 'MEOW MEOW MEOW', 'RATS IN SPACE',
  'COLBY JACK ATTACK', 'FETCH THE CHEESE', 'PURR-FECT SHOT', 'NINE LIVES? THREE.']);
