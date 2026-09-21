import { REGION_MASKS } from './region-data.js';

// The pet window is frameless and transparent. On X11 the only way to let
// clicks fall through the transparent area is the X11 window shape, and that
// shape also clips drawing: it has to cover every pixel the pet can paint, in
// every pose it can hold, plus the HTML overlays and the falling rice/cake.
// The pose coverage is baked offline (scripts/bake-region.mjs) as world-space
// rectangles; this module projects them onto the current window size and unions
// them with the live extras. Nothing here depends on the renderer's frame rate,
// so the region is already correct when a pointer event arrives.
// The region of the action that just ended overlaps the new one for this long,
// so the damped pose transition never leaves the region.
export const TRANSITION_MS = 1400;

function cameraFor(width, canvasHeight) {
  const aspect = width / canvasHeight;
  const half = Math.max(2.36, 2.3 / aspect);
  return { left: -half * aspect, right: half * aspect, top: half, bottom: -half };
}

function cleanRect(rect, width = Infinity, height = Infinity) {
  if (!rect || rect.length < 4) return null;
  const values = [rect[0], rect[1], rect[2], rect[3]].map(Number);
  if (!values.every(Number.isFinite)) return null;
  const left = Math.max(0, Math.floor(Math.min(values[0], values[2])));
  const top = Math.max(0, Math.floor(Math.min(values[1], values[3])));
  const right = Math.min(width, Math.ceil(Math.max(values[0], values[2])));
  const bottom = Math.min(height, Math.ceil(Math.max(values[1], values[3])));
  if (!(right > left) || !(bottom > top)) return null;
  return [left, top, right, bottom];
}

// World-space mask rectangles -> canvas pixels. `width` and `canvasHeight` are
// the live canvas size: everything the pet paints lives on that canvas.
export function projectMaskRects(maskRects, width, canvasHeight) {
  const height = canvasHeight;
  const { left, right, top, bottom } = cameraFor(width, canvasHeight);
  const scaleX = width / (right - left),
    scaleY = canvasHeight / (top - bottom);
  const out = [];
  for (const [x0, y0, x1, y1] of maskRects) {
    const rect = cleanRect(
      [(x0 - left) * scaleX, (top - y1) * scaleY, (x1 - left) * scaleX, (top - y0) * scaleY],
      width,
      height,
    );
    if (rect) out.push(rect);
  }
  return out;
}

function mergePairs(rects, horizontal) {
  const first = horizontal ? 0 : 1,
    second = horizontal ? 1 : 0;
  const sorted = [...rects].sort(
    (a, b) =>
      a[second] - b[second] ||
      a[second + 2] - b[second + 2] ||
      a[first] - b[first],
  );
  const out = [];
  for (const rect of sorted) {
    const last = out[out.length - 1];
    if (
      last &&
      last[second] === rect[second] &&
      last[second + 2] === rect[second + 2] &&
      rect[first] <= last[first + 2]
    ) {
      last[first + 2] = Math.max(last[first + 2], rect[first + 2]);
    } else out.push([...rect]);
  }
  return out;
}

// Union of touching or overlapping rectangles; merging never grows or shrinks
// the covered area, it only keeps window shape requests small.
export function mergeRects(rects, width = Infinity, height = Infinity) {
  let work = [];
  for (const rect of rects) {
    const clean = cleanRect(rect, width, height);
    if (clean) work.push(clean);
  }
  for (let pass = 0; pass < 3; pass++) {
    const before = work.length;
    work = mergePairs(work, true);
    work = mergePairs(work, false);
    if (work.length === before) break;
  }
  return work;
}

// Region of a set of animation actions, in window pixels. Unknown actions pull
// in the all-pose fallback so no drawn pixel can escape the region.
export function maskRectsFor(actions, width, height) {
  const masks = [];
  let unknown = false;
  for (const action of actions) {
    const mask = REGION_MASKS[action];
    if (mask) masks.push(projectMaskRects(mask, width, height));
    else unknown = true;
  }
  if (unknown || !masks.length) masks.push(projectMaskRects(REGION_MASKS.default, width, height));
  return mergeRects(masks.flat(), width, height);
}

export function containsPoint(rects, x, y) {
  for (const rect of rects) {
    if (x >= rect[0] && x < rect[2] && y >= rect[1] && y < rect[3]) return true;
  }
  return false;
}

export function sameRects(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1] || a[i][2] !== b[i][2] || a[i][3] !== b[i][3])
      return false;
  }
  return true;
}

// The main process only needs the rectangles as plain Electron rectangles.
export function toShapeRects(rects) {
  return rects.map(([left, top, right, bottom]) => ({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }));
}
