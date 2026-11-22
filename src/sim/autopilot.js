// Autopilot: wraps createAI to play any owner (default: the player) in bot-vs-AI runs.
import { PLAYER } from '../core/defs.js';
import { createAI } from './ai.js';

export function createAutopilot({ owner = PLAYER, personality = 'balanced', difficulty = 'normal', rng } = {}) {
  const ai = createAI({ owner, personality, difficulty, rng });
  return { owner, personality, act(game, dt = 1 / 60) { ai.act(game, dt); } };
}
