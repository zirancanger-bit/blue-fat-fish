// Bakes the pet's screen-space click region into world-space rectangles.
//
// On X11 the window's input region is the X11 shape, and that shape also clips
// drawing, so the shape has to cover every pixel the pet can ever paint while
// still leaving the transparent area around it click-through. Pose-by-pose
// silhouettes are therefore rasterised here, offline, and stored as world-space
// rectangles (src/region-data.js). At runtime the rectangles are only projected
// to the current window size, which keeps startup free of extra renders.
//
// Run with: node scripts/bake-region.mjs
import * as THREE from 'three';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createFin} from '../src/model.js';
import {Animator, ACTIONS} from '../src/animator.js';

const REF_W = 400, REF_H = 490, CANVAS_H = REF_H - 32, CELL = 5, PAD_PX = 5, BLOCK = 10;
const COLS = Math.ceil(REF_W / CELL), ROWS = Math.ceil(CANVAS_H / CELL);
const BCOLS = Math.ceil(REF_W / BLOCK), BROWS = Math.ceil(CANVAS_H / BLOCK);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 50);
const aspect = REF_W / CANVAS_H, half = Math.max(2.36, 2.30 / aspect);
camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
camera.position.set(0, 1.95, 7); camera.lookAt(0, 1.95, 0);
camera.updateMatrixWorld(true); camera.updateProjectionMatrix();

const model = createFin();
const animator = new Animator(model);
const v = new THREE.Vector3(), sx = [0, 0, 0], sy = [0, 0, 0];

function rasterize(grid, pad) {
  model.root.updateMatrixWorld(true);
  model.root.traverse((object) => {
    if (!object.isMesh || !object.visible) return;
    const geometry = object.geometry;
    if (!geometry || !geometry.attributes || !geometry.attributes.position) return;
    const position = geometry.attributes.position, index = geometry.index;
    const count = index ? index.count : position.count, matrix = object.matrixWorld;
    for (let t = 0; t < count; t += 3) {
      for (let k = 0; k < 3; k++) {
        const i = index ? index.getX(t + k) : t + k;
        v.fromBufferAttribute(position, i).applyMatrix4(matrix).project(camera);
        sx[k] = (v.x * .5 + .5) * REF_W;
        sy[k] = (.5 - v.y * .5) * CANVAS_H;
      }
      const minX = Math.min(sx[0], sx[1], sx[2]) - pad, maxX = Math.max(sx[0], sx[1], sx[2]) + pad;
      const minY = Math.min(sy[0], sy[1], sy[2]) - pad, maxY = Math.max(sy[0], sy[1], sy[2]) + pad;
      if (maxX < 0 || maxY < 0 || minX > REF_W || minY > CANVAS_H) continue;
      const x0 = Math.max(0, Math.floor(minX / CELL)), x1 = Math.min(COLS - 1, Math.floor(maxX / CELL));
      const y0 = Math.max(0, Math.floor(minY / CELL)), y1 = Math.min(ROWS - 1, Math.floor(maxY / CELL));
      for (let y = y0; y <= y1; y++) {
        const row = y * COLS;
        for (let x = x0; x <= x1; x++) grid[row + x] = 1;
      }
    }
  });
}
function posePlan() {
  const plan = [];
  for (const [action, duration] of Object.entries(ACTIONS)) {
    const finite = Number.isFinite(duration), end = finite ? duration : 2.4;
    const step = finite ? Math.max(0.08, duration / 12) : 0.2;
    for (let t = 0; t <= end + 1e-9; t += step) plan.push({action, t: Math.min(t, end)});
  }
  for (const [dx, dy] of [[.9, 0], [-.9, 0], [0, .9], [0, -.9]])
    for (const t of [0.4, 1.2, 2.4]) plan.push({action: 'drag', t, dx, dy});
  for (const [px, py] of [[1, 1], [-1, 1], [1, -1], [-1, -1]])
    for (const action of ['idle', 'sleep', 'walk']) plan.push({action, t: 0.8, px, py});
  return plan;
}
// Screen grid -> world rectangles, snapped to BLOCK cells and merged into runs.
function toWorldRects(grid) {
  const blocks = new Uint8Array(BCOLS * BROWS);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (grid[y * COLS + x]) blocks[Math.floor(y / (BLOCK / CELL)) * BCOLS + Math.floor(x / (BLOCK / CELL))] = 1;
  const rects = [];
  for (let x = 0; x < BCOLS; x++) {
    let y = 0;
    while (y < BROWS) {
      if (!blocks[y * BCOLS + x]) { y++; continue; }
      let end = y;
      while (end + 1 < BROWS && blocks[(end + 1) * BCOLS + x]) end++;
      rects.push([x, y, x, end]);
      y = end + 1;
    }
  }
  // merge horizontally adjacent runs of identical vertical extent
  rects.sort((a, b) => a[1] - b[1] || a[3] - b[3] || a[0] - b[0]);
  const merged = [];
  for (const r of rects) {
    const last = merged[merged.length - 1];
    if (last && last[1] === r[1] && last[3] === r[3] && last[2] + 1 === r[0]) last[2] = r[2];
    else merged.push([...r]);
  }
  const left = camera.left, right = camera.right, top = camera.top, bottom = camera.bottom;
  const toWorldX = (px) => +(left + px * (right - left) / REF_W).toFixed(4);
  const toWorldY = (py) => +(top - py * (top - bottom) / CANVAS_H).toFixed(4);
  return merged.map(([x0, y0, x1, y1]) => [
    toWorldX(x0 * BLOCK), toWorldY((y1 + 1) * BLOCK), toWorldX((x1 + 1) * BLOCK), toWorldY(y0 * BLOCK),
  ]);
}
const masks = new Map();
const plan = posePlan();
console.log(`baking ${plan.length} poses...`);
const started = Date.now();
for (const pose of plan) {
  animator.play(pose.action);
  animator.time = 0; animator.elapsed = 0;
  animator.setPointer(pose.px ?? 0, pose.py ?? 0);
  animator.setDragVelocity(pose.dx ?? 0, pose.dy ?? 0);
  const steps = Math.max(1, Math.round(pose.t * 30));
  for (let i = 0; i < steps; i++) animator.update(1 / 30);
  let grid = masks.get(pose.action);
  if (!grid) { grid = new Uint8Array(COLS * ROWS); masks.set(pose.action, grid); }
  rasterize(grid, PAD_PX);
}
const global = new Uint8Array(COLS * ROWS);
for (const grid of masks.values()) for (let i = 0; i < grid.length; i++) if (grid[i]) global[i] = 1;
let total = 0, cells = 0;
const out = [];
for (const [action, grid] of [...masks].sort((a, b) => a[0].localeCompare(b[0]))) {
  const rects = toWorldRects(grid);
  let n = 0; for (let i = 0; i < grid.length; i++) if (grid[i]) n++;
  cells = Math.max(cells, n);
  total += rects.length;
  console.log(`  ${action.padEnd(8)} ${rects.length.toString().padStart(4)} rects  ${(n / (COLS * ROWS) * 100).toFixed(1)}% of canvas`);
  out.push([action, rects]);
}
const fallback = toWorldRects(global);
let gn = 0; for (let i = 0; i < global.length; i++) if (global[i]) gn++;
console.log(`  ${'default'.padEnd(8)} ${fallback.length.toString().padStart(4)} rects  ${(gn / (COLS * ROWS) * 100).toFixed(1)}% of canvas`);
out.push(['default', fallback]);
console.log(`baked in ${((Date.now() - started) / 1000).toFixed(1)}s, ${total + fallback.length} rectangles total`);
const body = out.map(([action, rects]) => `  ${JSON.stringify(action)}: [\n${rects.map((r) => `    [${r.join(', ')}],`).join('\n')}\n  ],`).join('\n');
const file = resolve(fileURLToPath(new URL('../', import.meta.url)), 'src/region-data.js');
await writeFile(file, `// Generated by scripts/bake-region.mjs - do not edit by hand.
// World-space rectangles (left, bottom, right, top in the pet's camera space)
// covering every pixel the pet can paint per animation, so the X11 window
// shape never clips a drawn pose while transparent areas stay click-through.
export const REGION_REFERENCE = Object.freeze({
  width: ${REF_W},
  canvasHeight: ${CANVAS_H},
  cell: ${CELL},
  margin: ${PAD_PX},
  block: ${BLOCK},
  camera: Object.freeze({y: 1.95, half: ${half.toFixed(6)}, aspect: ${aspect.toFixed(6)}}),
});
export const REGION_MASKS = Object.freeze({
${body}
});
`);
console.log('wrote', file);
