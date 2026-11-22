#!/usr/bin/env node
// Headless autopilot (player side) vs level AI over LEVELS x difficulties.
// node tools/botplay.mjs [--levels 1-9] [--diffs kitten,normal,hard,nine] [--seeds 1-3] [--maxSeconds 300]
//   [--persona balanced] [--apDiff normal] [--json] [--quiet]
import { createGame } from '../src/sim/game.js';
import { createAutopilot } from '../src/sim/autopilot.js';
import { createBus } from '../src/core/events.js';
import { LEVELS } from '../src/sim/levels.js';
import { DIFFICULTY } from '../src/core/defs.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const range = (s, lo, hi) => { const [a, b] = String(s).split('-').map(Number); const o = []; for (let i = a; i <= (b || a); i++) if (i >= lo && i <= hi) o.push(i); return o; };
const levelIdx = args.levels ? range(args.levels, 1, LEVELS.length).map((n) => n - 1) : LEVELS.map((_, i) => i);
const diffs = args.diffs ? String(args.diffs).split(',') : DIFFICULTY.map((d) => d.id);
const seeds = range(args.seeds ?? '1-3', 0, 1e9);
const maxSec = Number(args.maxSeconds ?? 300);
const persona = args.persona || 'balanced', apDiff = args.apDiff || 'normal';
const DT = 1 / 60, TRIVIAL_S = 20;

export function runOne(level, difficulty, seed, { maxSeconds = maxSec } = {}) {
  const bus = createBus();
  const g = createGame({ seed, bus, level, difficulty });
  const ap = createAutopilot({ personality: persona, difficulty: apDiff });
  let steps = 0, bad = false;
  const t0 = process.hrtime.bigint();
  while (g.t < maxSeconds && g.state === 'play') {
    ap.act(g, DT); g.update(DT); steps++;
    if (g.planets.some((p) => !Number.isFinite(p.units))) { bad = true; break; }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { winner: g.state === 'won' ? 'player' : g.state === 'lost' ? 'ai' : 'timeout', time: g.t, peak: g.stats.peakShips, msStep: steps ? ms / steps : 0, bad };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = []; let nan = 0;
  for (const li of levelIdx) for (const d of diffs) {
    const rs = seeds.map((s) => runOne(LEVELS[li], d, s));
    nan += rs.filter((r) => r.bad).length;
    const wins = rs.filter((r) => r.winner === 'player');
    const row = { level: li + 1, id: LEVELS[li].id, diff: d, wins: wins.length, runs: rs.length,
      winner: wins.length * 2 > rs.length ? 'player' : rs.some((r) => r.winner === 'timeout') && !wins.length ? 'timeout' : wins.length ? 'mixed' : 'ai',
      time: rs.reduce((a, r) => a + r.time, 0) / rs.length, minTime: Math.min(...rs.map((r) => r.time)),
      peak: Math.max(...rs.map((r) => r.peak)), msStep: rs.reduce((a, r) => a + r.msStep, 0) / rs.length };
    rows.push(row);
    if (!args.quiet && !args.json) console.log(`L${String(row.level).padEnd(2)} ${String(row.id).padEnd(12)} ${d.padEnd(7)} ${row.winner.padEnd(7)} wins ${row.wins}/${row.runs} t=${row.time.toFixed(1)}s peak=${row.peak} ${row.msStep.toFixed(3)}ms/step`);
  }
  if (args.json) console.log(JSON.stringify(rows));
  else {
    const noWin = rows.filter((r) => r.diff === 'normal' && r.wins === 0).map((r) => `L${r.level}(${r.id})`);
    const shaky = rows.filter((r) => r.diff === 'normal' && r.wins > 0 && r.wins * 2 < r.runs).map((r) => `L${r.level}(${r.wins}/${r.runs})`);
    const trivial = rows.filter((r) => r.wins > 0 && r.time < TRIVIAL_S).map((r) => `L${r.level}/${r.diff}`);
    console.log(`FLAG autopilot cannot win on normal: ${noWin.join(' ') || 'none'}`);
    console.log(`FLAG autopilot wins <50% on normal: ${shaky.join(' ') || 'none'}`);
    console.log(`FLAG trivial (<${TRIVIAL_S}s): ${trivial.join(' ') || 'none'}`);
    console.log(`nan ${nan}`);
  }
  process.exitCode = nan ? 1 : 0;
}
