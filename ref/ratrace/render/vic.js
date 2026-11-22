// VIC-20 (VIC-I) retro pass: 16-colour palette, nearest-colour LUT, low-res offscreen target. Node-safe (pure helpers).
export const VIC_W = 232, VIC_H = 130;
export const VIC_PALETTE = Object.freeze([
  [0x00, 0x00, 0x00], [0xff, 0xff, 0xff], [0x78, 0x29, 0x22], [0x87, 0xd6, 0xdd],
  [0xaa, 0x5f, 0xb6], [0x55, 0xa0, 0x49], [0x40, 0x31, 0x8d], [0xbf, 0xce, 0x72],
  [0xaa, 0x74, 0x49], [0xea, 0xb4, 0x89], [0xb8, 0x69, 0x62], [0xc7, 0xff, 0xff],
  [0xea, 0x9f, 0xf6], [0x94, 0xe0, 0x89], [0x80, 0x71, 0xcc], [0xff, 0xff, 0xb2],
].map((c) => Object.freeze(c)));
export const VIC_NAMES = Object.freeze(['black', 'white', 'red', 'cyan', 'purple', 'green', 'blue', 'yellow', 'orange',
  'light orange', 'pink', 'light cyan', 'light purple', 'light green', 'light blue', 'light yellow']);

const key = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

/** 32768-entry LUT (5 bits/channel) -> palette index. Palette colours map exactly to themselves. */
export function buildLUT(palette = VIC_PALETTE) {
  const lut = new Uint8Array(32768);
  for (let i = 0; i < 32768; i++) {
    const r = ((i >> 10) << 3) | 4, g = (((i >> 5) & 31) << 3) | 4, b = ((i & 31) << 3) | 4;
    let best = 0, bd = Infinity;
    for (let p = 0; p < palette.length; p++) {
      const dr = r - palette[p][0], dg = g - palette[p][1], db = b - palette[p][2];
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; // weighted RGB distance
      if (d < bd) { bd = d; best = p; }
    }
    lut[i] = best;
  }
  for (let p = 0; p < palette.length; p++) lut[key(palette[p][0], palette[p][1], palette[p][2])] = p;
  return lut;
}
let _lut = null;
export const getLUT = () => (_lut ??= buildLUT());

/** Palette index for an RGB triple (non-finite channels treated as 0). */
export function nearestIndex(r, g, b, lut = getLUT()) {
  const c = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(255, v | 0)) : 0);
  return lut[key(c(r), c(g), c(b))];
}

/** Quantise RGBA bytes in place (alpha forced opaque). */
export function quantize(data, lut = getLUT(), palette = VIC_PALETTE) {
  for (let i = 0; i < data.length; i += 4) {
    const c = palette[lut[((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)]];
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  }
  return data;
}

/** Create the low-res target. makeCanvas(w,h) -> canvas|null. Returns null when unavailable. */
export function createVicTarget(makeCanvas, w = VIC_W, h = VIC_H) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas && canvas.getContext && canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !ctx.getImageData) return null;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx, w, h };
}

/** Quantise the whole target in place. */
export function quantizeTarget(t) {
  const img = t.ctx.getImageData(0, 0, t.w, t.h);
  quantize(img.data);
  t.ctx.putImageData(img, 0, 0);
}

/** Upscale target onto ctx at (x,y,w,h), nearest-neighbour; optional faint scanlines. */
export function blitVic(ctx, t, x, y, w, h, scanlines = false) {
  const was = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(t.canvas, x, y, w, h);
  ctx.imageSmoothingEnabled = was;
  if (scanlines) {
    const step = h / t.h;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < t.h; i++) ctx.fillRect(x, y + i * step + step * 0.6, w, Math.max(1, step * 0.4));
    ctx.restore();
  }
}
