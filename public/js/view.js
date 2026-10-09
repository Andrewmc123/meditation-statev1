// Where you're looking. On a phone, the motion sensors turn the phone into a window into the
// world: tilt up to look up, turn around to look behind you. Elsewhere, drag to look around.
//
// Frames: the scene uses x = right, y = up, z = forward (into the tunnel).
// Device orientation (W3C): R = Rz(alpha)·Rx(beta)·Ry(gamma) maps device axes to the earth
// frame; the camera looks out of the back of the phone (device -z).

const D = Math.PI / 180;

const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
function mul(a, b) { // 3x3, row-major
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
    o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}
const T = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const rotX = (t) => { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, s, 0, -s, c]; };
const rotY = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const F = [1, 0, 0, 0, 1, 0, 0, 0, -1]; // flips forward: device -z <-> scene +z

/** W3C DeviceOrientation rotation matrix (degrees in). */
export function deviceMatrix(alpha, beta, gamma) {
  const a = alpha * D, b = beta * D, g = gamma * D;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b);
  const cG = Math.cos(g), sG = Math.sin(g);
  return [
    cA * cG - sA * sB * sG, -cB * sA, cG * sA * sB + cA * sG,
    cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB,
    -cB * sG, sB, cB * cG,
  ];
}

function orthonormalize(m) { // keep a smoothed matrix a pure rotation (Gram-Schmidt on columns)
  let x = [m[0], m[3], m[6]], y = [m[1], m[4], m[7]];
  const n = (v) => { const l = Math.hypot(...v) || 1; return v.map((k) => k / l); };
  x = n(x);
  const d = x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  y = n([y[0] - d * x[0], y[1] - d * x[1], y[2] - d * x[2]]);
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

function screenAngle() {
  const a = screen.orientation && typeof screen.orientation.angle === 'number'
    ? screen.orientation.angle : (window.orientation || 0);
  return a * D;
}

export const view = {
  gyro: false,        // the phone's motion sensors are steering
  available: false,   // permission granted / listener attached
  yaw: 0, pitch: 0,   // drag look (degrees of yaw are added on top of the sensors)
  M: I3(),            // current camera rotation (row-major)
  _target: I3(),
  _A0: null,
  _onFirst: null,
};

function onOrientation(e) {
  if (e.alpha == null || e.beta == null || e.gamma == null) return;
  const A = mul(deviceMatrix(e.alpha, e.beta, e.gamma), rotZ(-screenAngle()));
  if (!view._A0) view._A0 = A; // "straight ahead" is wherever the phone pointed at the start
  view._target = mul(mul(F, mul(T(view._A0), A)), F);
  if (!view.gyro) { view.gyro = true; view._onFirst?.(); }
}

/** Motion (accelerometer) access, used by the Hibernation room to feel vibration. */
export const motion = { granted: null, request: null };

/** Ask for motion sensors. On iPhone this must run inside a tap, before any await: both
 *  permission requests are started here, synchronously. */
export function requestMotion(onFirstReading) {
  view._onFirst = onFirstReading;
  if ('DeviceMotionEvent' in window && motion.granted === null) {
    motion.request = typeof DeviceMotionEvent.requestPermission === 'function'
      ? DeviceMotionEvent.requestPermission().then((s) => s === 'granted').catch(() => false)
      : Promise.resolve(true);
    motion.request.then((ok) => { motion.granted = ok; });
  }
  if (!('DeviceOrientationEvent' in window)) return Promise.resolve(false);
  const attach = () => {
    if (!view.available) {
      addEventListener('deviceorientation', onOrientation);
      view.available = true;
    }
    return true;
  };
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    return DeviceOrientationEvent.requestPermission()
      .then((state) => (state === 'granted' ? attach() : false))
      .catch(() => false);
  }
  return Promise.resolve(attach());
}

/** Make the current direction "straight ahead" again. */
export function recenter() {
  view._A0 = null;
  view.yaw = 0;
  view.pitch = 0;
}

/** Drag to look around (and double-tap callback). */
export function attachDrag(el, { onDoubleTap, onTouch } = {}) {
  let last = null, lastTap = 0, moved = 0;
  el.addEventListener('pointerdown', (e) => { last = [e.clientX, e.clientY]; moved = 0; onTouch?.(); });
  addEventListener('pointerup', () => {
    if (last && moved < 8) {
      const now = performance.now();
      if (now - lastTap < 300) onDoubleTap?.();
      lastTap = now;
    }
    last = null;
  });
  addEventListener('pointermove', (e) => {
    if (!last) return;
    const dx = e.clientX - last[0], dy = e.clientY - last[1];
    last = [e.clientX, e.clientY];
    moved += Math.abs(dx) + Math.abs(dy);
    const scale = 180 / Math.max(innerWidth, innerHeight); // a full drag across ≈ half a turn
    view.yaw -= dx * scale;
    if (!view.gyro) view.pitch = Math.max(-85, Math.min(85, view.pitch + dy * scale));
  });
}

// Rotations are smoothed as quaternions (slerp), which stays correct even for big, fast turns.
function toQuat(m) {
  const [a, b, c, d, e, f, g, h, i] = m, tr = a + e + i;
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(h - f) / s, (c - g) / s, (d - b) / s, s / 4]; }
  else if (a > e && a > i) { const s = Math.sqrt(1 + a - e - i) * 2; q = [s / 4, (b + d) / s, (c + g) / s, (h - f) / s]; }
  else if (e > i) { const s = Math.sqrt(1 + e - a - i) * 2; q = [(b + d) / s, s / 4, (f + h) / s, (c - g) / s]; }
  else { const s = Math.sqrt(1 + i - a - e) * 2; q = [(c + g) / s, (f + h) / s, s / 4, (d - b) / s]; }
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
}
function fromQuat([x, y, z, w]) {
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}
function slerp(a, b, t) {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (dot < 0) { b = b.map((v) => -v); dot = -dot; } // take the short way round
  if (dot > 0.9995) { const q = a.map((v, i) => v + (b[i] - v) * t); const l = Math.hypot(...q); return q.map((v) => v / l); }
  const th = Math.acos(dot), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((v, i) => v * wa + b[i] * wb);
}
let current = [0, 0, 0, 1];

/** Advance smoothing; returns the camera matrix column-major for WebGL. */
export function cameraMatrix() {
  let target = view.gyro ? view._target : rotX(view.pitch * D);
  target = mul(rotY(view.yaw * D), target);
  const k = view.gyro ? 0.35 : 0.12; // sensors are already smooth; drags get eased
  current = slerp(current, toQuat(orthonormalize(target)), k);
  view.M = fromQuat(current);
  return new Float32Array(T(view.M));
}
