#!/usr/bin/env node
// Contact sheet of every sprite + hole/walls/portrait/logo -> out/previews/art-sheet.png (via tools/shot.mjs).
// node tools/art-sheet.mjs [--no-shot]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SPRITES } from '../src/core/defs.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(ROOT, 'out/previews'), { recursive: true });
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#05030f}canvas{display:block}</style>
<canvas id="c" width="1280" height="860"></canvas>
<script type="module">
import { drawSprite, drawShip, drawPlanet, drawColbyPortrait, drawLogo, drawFactionBadge, drawSendArrow, spriteRadius } from '/src/art/vector.js';
const names = ${JSON.stringify(SPRITES)};
const c = document.getElementById('c'), ctx = c.getContext('2d');
ctx.fillStyle = '#05030f'; ctx.fillRect(0, 0, 1280, 860);
ctx.font = '11px monospace'; ctx.textAlign = 'center';
const label = (s, x, y) => { ctx.save(); ctx.shadowBlur = 0; ctx.fillStyle = '#7a7aa8'; ctx.fillText(s, x, y); ctx.restore(); };
// row 1: sprites at x4
names.forEach((n, i) => { const x = 70 + i * 124; drawSprite(ctx, n, x, 60, -Math.PI / 6, 4, { t: 0.4 }); label(n + ' r' + spriteRadius(n), x, 110); });
// row 2: ships per owner at x4 and x1
[1, 2, 3, 4].forEach((o, i) => { const x = 70 + i * 124; drawShip(ctx, o, x, 160, -0.4, 0.5); ctx.save(); ctx.translate(x + 50, 160); ctx.scale(4, 4); drawShip(ctx, o, 0, 0, -0.4, 0.5); ctx.restore(); drawFactionBadge(ctx, o, x + 90, 160, 1.4); label('ship ' + o, x, 195); });
drawSendArrow(ctx, [[560, 170], [650, 130], [740, 160]], 0.3);
// planets: 5 owners x 3 levels (size 2) ; plus sizes
for (let o = 0; o < 5; o++) for (let l = 0; l < 3; l++) {
  drawPlanet(ctx, { id: o * 3 + l + 1, x: 80 + l * 110 + (o > 2 ? 400 : 0) + (o % 3 === 0 && o ? 0 : 0), y: 270 + (o % 3) * 120, r: 32, size: 2, owner: o, level: l, units: [0, 5, 24, 60, 99][(o + l) % 5] || 7 }, 1.0, { });
}
drawPlanet(ctx, { id: 40, x: 880, y: 280, r: 22, size: 1, owner: 1, level: 0, units: 12 }, 1, { selected: true });
drawPlanet(ctx, { id: 41, x: 990, y: 300, r: 44, size: 3, owner: 2, level: 2, units: 88 }, 1, { targeted: true });
drawPlanet(ctx, { id: 42, x: 1130, y: 290, r: 32, size: 2, owner: 0, level: 0, units: 0 }, 1, { hover: true });
drawColbyPortrait(ctx, 1100, 520, 1.3, 1.0);
drawLogo(ctx, 640, 650, 1.0);
drawColbyPortrait(ctx, 120, 780, 0.8, 0);
document.title = 'ready'; window.__done = true;
</script>`;
const htmlPath = path.join(ROOT, 'out/art-sheet.html');
fs.writeFileSync(htmlPath, html);
if (process.argv.includes('--no-shot')) process.exit(0);
const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/shot.mjs'), '--url', '/out/art-sheet.html', '--out', path.join(ROOT, 'out/previews/art-sheet.png'),
  '--size', '1280x860', '--wait-for', 'window.__done===true', '--strict'], { stdio: 'inherit', env: { ...process.env, SCRATCH: process.env.SCRATCH || '/datanapps/claude-tmp/game-shot' } });
process.exit(r.status ?? 1);
