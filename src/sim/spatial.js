// Uniform grid for neighbour queries. Items need numeric x,y. Deterministic: query order is
// cell order (row-major) then insertion order within a cell.
export function createGrid(cell, w, h) {
  const cols = Math.max(1, Math.ceil(w / cell));
  const rows = Math.max(1, Math.ceil(h / cell));
  const cells = new Array(cols * rows);
  for (let i = 0; i < cells.length; i++) cells[i] = [];
  const touched = [];
  const clampX = (cx) => (cx < 0 ? 0 : cx >= cols ? cols - 1 : cx);
  const clampY = (cy) => (cy < 0 ? 0 : cy >= rows ? rows - 1 : cy);
  return {
    cols, rows, cell,
    clear() {
      for (let i = 0; i < touched.length; i++) cells[touched[i]].length = 0;
      touched.length = 0;
    },
    insert(item) {
      const idx = clampY(Math.floor(item.y / cell)) * cols + clampX(Math.floor(item.x / cell));
      const c = cells[idx];
      if (c.length === 0) touched.push(idx);
      c.push(item);
    },
    // Calls cb(item) for every item within distance r of (x,y). If cb returns true, stops early.
    query(x, y, r, cb) {
      const x0 = clampX(Math.floor((x - r) / cell)), x1 = clampX(Math.floor((x + r) / cell));
      const y0 = clampY(Math.floor((y - r) / cell)), y1 = clampY(Math.floor((y + r) / cell));
      const r2 = r * r;
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const c = cells[cy * cols + cx];
          for (let i = 0; i < c.length; i++) {
            const it = c[i];
            const dx = it.x - x, dy = it.y - y;
            if (dx * dx + dy * dy <= r2 && cb(it) === true) return;
          }
        }
      }
    },
  };
}
