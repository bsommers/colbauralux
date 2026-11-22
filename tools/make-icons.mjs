#!/usr/bin/env node
// Regenerates the Colbauralux brand kit (code only): SVGs written directly, PNGs rasterised by headless Chrome (fallback: inkscape).
//   node tools/make-icons.mjs [--no-png]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { glyphRows } from '../src/ui/font.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGO = path.join(ROOT, 'docs/site/logo'), IMG = path.join(ROOT, 'docs/site/img');
const C = { orange: '#ff9b2e', cheese: '#ffd24a', purple: '#c27bff', bg: '#05030f', dark: '#2a1500' };
for (const d of [LOGO, IMG]) fs.mkdirSync(d, { recursive: true });

const glow = (id, s = 6) => `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceGraphic" stdDeviation="${s}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

// Cheese wheel with cat ears, centred at (0,0), radius r.
function mark(r = 100, idp = 'm') {
  const ear = s => `<path d="M${s * r * 1.0},${-r * 0.2} L${s * r * 0.88},${-r * 1.4} L${s * r * 0.1},${-r * 0.98} Z" fill="${C.orange}" stroke="${C.cheese}" stroke-width="${r * 0.05}" stroke-linejoin="round"/>
    <path d="M${s * r * 0.86},${-r * 0.5} L${s * r * 0.8},${-r * 1.15} L${s * r * 0.4},${-r * 0.92} Z" fill="${C.purple}" opacity=".85"/>`;
  const holes = [[-0.35, -0.2, 0.2], [0.38, 0.08, 0.15], [-0.1, 0.42, 0.13], [0.12, -0.5, 0.09], [-0.55, 0.3, 0.08]]
    .map(([x, y, k]) => `<circle cx="${x * r}" cy="${y * r}" r="${k * r}" fill="${C.dark}" opacity=".8"/>`).join('');
  return `<g filter="url(#${idp}g)">${ear(-1)}${ear(1)}
    <circle r="${r * 1.04}" fill="none" stroke="${C.purple}" stroke-width="${r * 0.09}"/>
    <circle r="${r}" fill="${C.cheese}" stroke="${C.orange}" stroke-width="${r * 0.07}"/>${holes}
    <path d="M${-r * 0.55},${r * 0.32} q${r * 0.1},${r * 0.2} ${r * 0.28},${r * 0.1} q${r * 0.1},${-r * 0.1} ${r * 0.14},0 m${r * 0.3},0 q${r * 0.1},${r * 0.1} ${r * 0.14},0 q${r * 0.18},${r * 0.1} ${r * 0.28},-${r * 0.1}" fill="none" stroke="${C.dark}" stroke-width="${r * 0.04}" stroke-linecap="round" opacity="0"/></g>`;
}

// Pixel-font wordmark as <rect> paths; returns {svg,w,h}
function word(text, u, fill) {
  let x = 0, d = '';
  for (const ch of text) {
    glyphRows(ch).forEach((row, y) => [...row].forEach((c, i) => { if (c === '#') d += `M${(x + i) * u},${y * u}h${u}v${u}h-${u}z`; }));
    x += 6;
  }
  return { svg: `<path d="${d}" fill="${fill}"/>`, w: (x - 1) * u, h: 7 * u };
}
const wm = (u = 8) => {
  const a = word('COLBAURALUX', u, 'url(#wg)');
  return { ...a, svg: `<g filter="url(#wf)">${a.svg}</g>` };
};
const defs = idp => `<defs>${glow(idp + 'g', 5)}${glow('wf', 0.5).replace('x="-30%" y="-30%" width="160%" height="160%"','x="-10%" y="-60%" width="120%" height="220%"')}<linearGradient id="wg" x1="0" x2="1"><stop offset="0" stop-color="${C.orange}"/><stop offset=".5" stop-color="${C.cheese}"/><stop offset="1" stop-color="${C.purple}"/></linearGradient>
<radialGradient id="bgr" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#1a0b33"/><stop offset="1" stop-color="${C.bg}"/></radialGradient></defs>`;
const svgDoc = (w, h, body, bg = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defs('m')}${bg ? `<rect width="${w}" height="${h}" fill="url(#bgr)"/>` : ''}${body}</svg>\n`;

// Scene: stars + mark + wordmark + tagline, in a w x h canvas.
function scene(w, h, big) {
  let s = '', seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < w * h / 6000; i++) s += `<circle cx="${(rnd() * w).toFixed(1)}" cy="${(rnd() * h).toFixed(1)}" r="${(0.5 + rnd() * 1.4).toFixed(1)}" fill="${i % 3 ? '#fff' : C.purple}" opacity="${(0.25 + rnd() * 0.6).toFixed(2)}"/>`;
  const wmk = wm(1), k = (w * 0.78) / wmk.w, r = h * (big ? 0.2 : 0.17);
  const my = h * 0.38, ty = my + r * 1.45;
  const tag = word('CAPTURE THE CHEESE', 1, C.cheese);
  const tk = (wmk.w * k * 0.5) / tag.w;
  return `${s}<g transform="translate(${w / 2},${my})">${mark(r)}</g>
<g transform="translate(${(w - wmk.w * k) / 2},${ty}) scale(${k})">${wmk.svg}</g>
<g transform="translate(${(w - tag.w * tk) / 2},${ty + wmk.h * k + h * 0.05}) scale(${tk})" opacity=".9">${tag.svg}</g>`;
}

const files = {};
{ // logo.svg (wide wordmark lockup)
  const w = 880, h = 300, wmk = wm(1), k = 780 / wmk.w;
  files['logo/logo.svg'] = svgDoc(w, h, `<g transform="translate(${w / 2},105)">${mark(78)}</g><g transform="translate(${(w - wmk.w * k) / 2},200) scale(${k})">${wmk.svg}</g>`, false);
  files['logo/logo-mark.svg'] = svgDoc(256, 256, `<rect width="256" height="256" rx="48" fill="url(#bgr)"/><g transform="translate(128,142)">${mark(78)}</g>`, false);
  files['logo/favicon.svg'] = svgDoc(64, 64, `<rect width="64" height="64" rx="12" fill="${C.bg}"/><g transform="translate(32,36)">${mark(21)}</g>`, false);
  files['logo/og.svg'] = svgDoc(1200, 630, scene(1200, 630, false));
  files['logo/hero.svg'] = svgDoc(1280, 720, scene(1280, 720, true));
}
for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(ROOT, 'docs/site', f), c);
// Root-level copies required by the contract.
fs.copyFileSync(path.join(LOGO, 'favicon.svg'), path.join(ROOT, 'favicon.svg'));
console.log('svg ok');
if (process.argv.includes('--no-png')) process.exit(0);

function raster(svgRel, w, h, out) {
  const src = path.join(ROOT, 'docs/site', svgRel);
  const tmp = fs.mkdtempSync(path.join(process.env.CLAUDE_CODE_TMPDIR || os.tmpdir(), 'icons-'));
  // Chrome with a transparent-less wrapper page so size is exact.
  const html = path.join(tmp, 'p.html');
  fs.writeFileSync(html, `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:${C.bg};overflow:hidden}img{display:block;width:${w}px;height:${h}px}</style><img src="file://${src}">`);
  const r = spawnSync('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${w},${h}`, '--allow-file-access-from-files', `--screenshot=${out}`, 'file://' + html], { encoding: 'utf8', timeout: 60000 });
  if (!fs.existsSync(out)) {
    const i = spawnSync('inkscape', [src, '-w', String(w), '-h', String(h), '-o', out], { encoding: 'utf8' });
    if (i.status !== 0) throw new Error('rasterise failed: ' + r.stderr);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
raster('logo/logo-mark.svg', 192, 192, path.join(ROOT, 'icon-192.png'));
raster('logo/logo-mark.svg', 512, 512, path.join(ROOT, 'icon-512.png'));
raster('logo/og.svg', 1200, 630, path.join(IMG, 'og.png'));
raster('logo/hero.svg', 1280, 720, path.join(IMG, 'hero.png'));
raster('logo/favicon.svg', 64, 64, path.join(IMG, 'favicon.png'));
console.log('png ok');
