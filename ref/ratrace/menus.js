// Tiny vertical menu model + renderer. Items: { label, value?:()=>string, act?:()=>void, adjust?:(dir)=>void }.
import { PALETTE } from '../core/defs.js';
import { drawText } from './font.js';

export function createMenu(items) {
  return {
    items, sel: 0,
    move(d) { this.sel = (this.sel + d + this.items.length) % this.items.length; },
    select() { const it = this.items[this.sel]; if (it?.act) it.act(); else if (it?.adjust) it.adjust(1); },
    adjust(d) { const it = this.items[this.sel]; if (it?.adjust) it.adjust(d); },
  };
}

/** Handle a discrete action; returns true if consumed. */
export function menuAction(menu, a) {
  if (a === 'up') { menu.move(-1); return 'move'; }
  if (a === 'down') { menu.move(1); return 'move'; }
  if (a === 'left') { menu.adjust(-1); return menu.items[menu.sel]?.adjust ? 'move' : false; }
  if (a === 'right') { menu.adjust(1); return menu.items[menu.sel]?.adjust ? 'move' : false; }
  if (a === 'select') { menu.select(); return 'select'; }
  return false;
}

export function drawMenu(ctx, menu, cx, y, t = 0, opts = {}) {
  const gap = opts.gap ?? 22, scale = opts.scale ?? 2;
  menu.items.forEach((it, i) => {
    const on = i === menu.sel, yy = y + i * gap;
    const label = it.label + (it.value ? ': ' + it.value() : '');
    const col = on ? PALETTE.cheese : PALETTE.dim;
    drawText(ctx, (on ? '> ' + label + ' <' : label), cx, yy, { scale, color: col, align: 'center' });
  });
}
