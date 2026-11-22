// Tiny vertical menu model + renderer. Items: { label, value?:()=>string, act?:()=>void, adjust?:(dir)=>void, disabled?:()=>bool }.
import { PALETTE } from '../core/defs.js';
import { drawText, measureText } from './font.js';

export function createMenu(items) {
  return {
    items, sel: 0, rects: [],
    move(d) { this.sel = (this.sel + d + this.items.length) % this.items.length; },
    select() { const it = this.items[this.sel]; if (it?.disabled?.()) return; if (it?.act) it.act(); else if (it?.adjust) it.adjust(1); },
    adjust(d) { const it = this.items[this.sel]; if (it?.adjust) it.adjust(d); },
  };
}

/** Handle a discrete action; returns 'move' | 'select' | false. */
export function menuAction(menu, a) {
  if (a === 'up') { menu.move(-1); return 'move'; }
  if (a === 'down') { menu.move(1); return 'move'; }
  if (a === 'left') { menu.adjust(-1); return menu.items[menu.sel]?.adjust ? 'move' : false; }
  if (a === 'right') { menu.adjust(1); return menu.items[menu.sel]?.adjust ? 'move' : false; }
  if (a === 'select') { menu.select(); return 'select'; }
  return false;
}

/** Pointer click at logical (x,y): selects (and activates) the row under it. Returns 'select' | false. */
export function menuClick(menu, x, y) {
  for (let i = 0; i < menu.rects.length; i++) {
    const r = menu.rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      menu.sel = i;
      const it = menu.items[i];
      if (it && it.adjust && !it.act) it.adjust(x > r.x + r.w / 2 ? 1 : -1); else menu.select();
      return 'select';
    }
  }
  return false;
}

export function drawMenu(ctx, menu, cx, y, t = 0, opts = {}) {
  const gap = opts.gap ?? 22, scale = opts.scale ?? 2;
  menu.rects = [];
  menu.items.forEach((it, i) => {
    const on = i === menu.sel, yy = y + i * gap;
    const label = it.label + (it.value ? ': ' + it.value() : '');
    const dis = it.disabled?.();
    const col = dis ? '#4a4a66' : on ? PALETTE.cheese : PALETTE.dim;
    const text = on ? '> ' + label + ' <' : label;
    const w = measureText(text, scale);
    drawText(ctx, text, cx, yy, { scale, color: col, align: 'center' });
    menu.rects.push({ x: cx - Math.max(w, 160) / 2 - 8, y: yy - 4, w: Math.max(w, 160) + 16, h: gap });
  });
}
