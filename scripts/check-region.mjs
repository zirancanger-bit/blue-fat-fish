// Verifies that the baked click region covers every pose the pet can draw,
// including the damped transition between two animations. A pose that escapes
// the region would be clipped by the window shape on Linux.
//
// Run with: node scripts/check-region.mjs
import * as THREE from 'three';
import { createFin } from '../src/model.js';
import { Animator, ACTIONS } from '../src/animator.js';
import { maskRectsFor, containsPoint } from '../src/region.js';

const REF_W = 400, CANVAS_H = 458, CELL = 5;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 50);
const aspect = REF_W / CANVAS_H, half = Math.max(2.36, 2.3 / aspect);
camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
camera.position.set(0, 1.95, 7); camera.lookAt(0, 1.95, 0);
camera.updateMatrixWorld(true); camera.updateProjectionMatrix();

const model = createFin();
const animator = new Animator(model);
const v = new THREE.Vector3(), sx = [0, 0, 0], sy = [0, 0, 0];

// Screen-space extent of every triangle, which is what the region has to cover.
function poseExtent() {
  const points = [];
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
        points.push([(v.x * .5 + .5) * REF_W, (.5 - v.y * .5) * CANVAS_H]);
      }
    }
  });
  return points;
}
function violations(points, rects) {
  let worst = 0, count = 0;
  for (const [x, y] of points) {
    if (containsPoint(rects, x, y)) continue;
    count++;
    let distance = 0;
    for (const [l, t, r, b] of rects) {
      const dx = Math.max(l - x, 0, x - r), dy = Math.max(t - y, 0, y - b);
      distance = distance ? Math.min(distance, Math.hypot(dx, dy)) : Math.hypot(dx, dy);
    }
    worst = Math.max(worst, distance);
  }
  return { count, worst };
}
function step(seconds, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) animator.update(dt);
}
function reset(action, { pointer = [0, 0], drag = [0, 0] } = {}) {
  animator.play(action);
  animator.time = 0;
  animator.elapsed = 0;
  animator.setPointer(pointer[0], pointer[1]);
  animator.setDragVelocity(drag[0], drag[1]);
}

const actions = Object.keys(ACTIONS);
const random = (() => {
  let seed = 20240921;
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
})();
const pick = (list) => list[Math.floor(random() * list.length)];
const durations = new Map(actions.map((a) => [a, Number.isFinite(ACTIONS[a]) ? ACTIONS[a] : 3]));
let poses = 0, failures = 0, worstOverall = 0;
const record = (label, rects) => {
  poses++;
  const { count, worst } = violations(poseExtent(), rects);
  if (!count) return;
  failures++;
  worstOverall = Math.max(worstOverall, worst);
  if (failures < 8) console.log(`  miss ${label} points=${count} worst=${worst.toFixed(1)}px`);
};
// Single poses: random action, random time, random cursor and drag motion.
const samples = Number(process.env.SAMPLES || 12);
for (const action of actions) {
  for (let sample = 0; sample < samples; sample++) {
    const t = random() * durations.get(action);
    const pointer = [random() * 2 - 1, random() * 2 - 1];
    const drag = random() < .5 ? [0, 0] : [random() * 1.8 - .9, random() * 1.8 - .9];
    reset(action, { pointer, drag });
    step(t);
    record(`${action} t=${t.toFixed(2)}`, maskRectsFor([action], REF_W, CANVAS_H));
  }
}
// Damped transitions: the app unions both actions' regions while one fades out.
for (let pair = 0; pair < Number(process.env.PAIRS || 24); pair++) {
  const from = pick(actions), to = pick(actions.filter((a) => a !== from));
  reset(from);
  step(1.2);
  animator.play(to);
  const rects = maskRectsFor([to, from], REF_W, CANVAS_H);
  for (let t = 0; t <= 1.4; t += 0.1) {
    animator.update(1 / 60);
    record(`${from}->${to} t=${t.toFixed(1)}`, rects);
  }
}
console.log(`${poses} poses checked, ${failures} outside the region, worst ${worstOverall.toFixed(1)}px`);
process.exit(failures ? 1 : 0);
