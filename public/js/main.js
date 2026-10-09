// Dimensions: wiring for the start screen, the music world and the Hibernation room.
import { CHAKRAS, Ear, hexRgb, noteName, solfeggio } from './listen.js';
import { createRenderer } from './scene.js';
import { attachDrag, cameraMatrix, recenter, requestMotion, view } from './view.js';
import { HibernationRoom, SKY_SHADER } from './hibernation.js';

const $ = (id) => document.getElementById(id);

// ---------- Dimensions: symmetry + palette (a,b,d of a cosine palette) ----------
const DIMS = [
  { name: 'Indigo Hex', n: 6, a: [.45, .12, .80], b: [.40, .12, .20], d: [0, 0, .5], k: .05 },
  { name: 'Ember Tetra', n: 3, a: [.80, .35, .15], b: [.20, .25, .15], d: [0, .1, .2], k: .00 },
  { name: 'Jade Cube', n: 4, a: [.10, .60, .50], b: [.10, .30, .30], d: [.5, 0, .3], k: .10 },
  { name: 'Ultraviolet Octa', n: 8, a: [.30, .50, .90], b: [.30, .40, .10], d: [.5, 0, 0], k: .08 },
  { name: 'Solar Dodeca', n: 12, a: [.60, .40, .60], b: [.40, .30, .30], d: [0, .15, .5], k: .12 },
];

const canvas = $('c');
const renderer = createRenderer(canvas, { sky: SKY_SHADER });
const ear = new Ear();
const room = new HibernationRoom(ear, $('panels'), $('verdict'));
const player = $('player');
let mode = 'idle'; // idle | music (mic) | file | silent | room
let playlist = [], ti = 0;

// ---------- Start ----------
function start(newMode) {
  // Motion sensors first: on iPhone the permission prompt only works straight from a tap.
  requestMotion(() => flashText('Move your phone to look around'));
  ear.ensure();
  mode = newMode;
  $('start').hidden = true;
  document.body.dataset.mode = mode === 'room' ? 'room' : 'music';
  $('vibe').hidden = mode === 'room';
  $('roomui').hidden = mode !== 'room';
  showHud();
  keepAwake();
}

$('mic').onclick = async () => {
  start('music');
  try {
    await ear.listen();
    setTrack('Listening to your music', 'Play Apple Music out loud, or any music or sound nearby');
  } catch {
    backToStart('Microphone access was blocked. Allow it in Settings (Safari › Microphone), or choose songs instead.');
  }
};
$('files').addEventListener('change', (e) => {
  if (!e.target.files.length) return;
  start('file');
  playlist = [...e.target.files];
  ear.playFrom(player);
  $('next').hidden = playlist.length < 2;
  playTrack(0);
});
$('silent').onclick = () => { start('silent'); setTrack('Drifting in silence', 'Add music to make the worlds move with it'); };
$('roomBtn').onclick = async () => {
  start('room');
  try {
    await ear.listen();
    room.start();
    setTrack('Hibernation room', 'Listening to your surroundings. Put the phone down nearby.');
  } catch {
    backToStart('The Hibernation room needs the microphone. Allow it in Settings (Safari › Microphone).');
  }
};
function backToStart(msg) {
  mode = 'idle';
  $('start').hidden = false;
  $('err').textContent = msg;
}

function playTrack(i) {
  ti = (i + playlist.length) % playlist.length;
  if (player.src) URL.revokeObjectURL(player.src);
  player.src = URL.createObjectURL(playlist[ti]);
  player.play();
  setTrack(playlist[ti].name.replace(/\.[^.]+$/, ''), `Song ${ti + 1} of ${playlist.length}`);
}
player.addEventListener('ended', () => playTrack(ti + 1));
$('next').onclick = () => playTrack(ti + 1);
$('warp').onclick = () => warp();
$('look').onclick = () => {
  if (view.gyro) { recenter(); flashText('Centred'); return; }
  requestMotion(() => flashText('Move your phone to look around')).then((ok) => {
    if (!ok) flashText('Drag to look around');
  });
};
$('home').onclick = () => location.reload();

// The room's readout: a drawer on phones (always open on wide screens).
function toggleDrawer(open) {
  const ui = $('roomui');
  const isOpen = open ?? !ui.classList.contains('open');
  ui.classList.toggle('open', isOpen);
  $('verdict').setAttribute('aria-expanded', isOpen);
  $('drawerTab').setAttribute('aria-expanded', isOpen);
}
$('verdict').onclick = () => toggleDrawer();
$('drawerTab').onclick = () => toggleDrawer();

// On iPhone, a web page can't record while Apple Music keeps playing: say so up front.
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (isIOS) {
  $('how').textContent = 'Apple Music: iPhone usually pauses other music when any app or website starts '
    + 'listening. If it pauses, press play again in Control Center; if it keeps stopping, play the music '
    + 'on another speaker, laptop or TV and let Dimensions listen to that. Songs saved in Files work too '
    + '(Choose songs).';
}
$('relisten').onclick = async () => { try { await ear.listen(); $('relisten').hidden = true; } catch { /* still blocked */ } };

function setTrack(t, s) {
  const el = $('track');
  el.textContent = '';
  const d = document.createElement('div');
  d.textContent = t;
  const m = document.createElement('small');
  m.textContent = s;
  el.append(d, m);
}

// ---------- Keep the screen on while it plays ----------
async function keepAwake() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen'); } catch { /* not supported */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || mode === 'idle') return;
  keepAwake();
  if (ear.ctx && ear.ctx.state !== 'running') ear.ctx.resume();
  if (ear.micEnded()) $('relisten').hidden = false; // iOS stops the mic when you switch apps
});

// ---------- HUD ----------
const hud = $('hud');
let hudTimer;
function showHud() {
  hud.classList.add('on');
  clearTimeout(hudTimer);
  hudTimer = setTimeout(() => hud.classList.remove('on'), 4000);
}
const chEls = CHAKRAS.map((c) => {
  const el = document.createElement('div');
  el.className = 'ch';
  el.innerHTML = `<span>${c.name}</span><i style="--c:${c.c}"></i>`;
  $('chakras').append(el);
  return el;
});
const chNote = document.createElement('div');
chNote.id = 'chnote';
chNote.textContent = 'Chakra colors are a symbolic frequency map, not a measurement';
$('chakras').prepend(chNote);

const fm = $('flashmsg');
function flashText(text) {
  fm.textContent = text;
  fm.style.transition = 'none';
  fm.style.opacity = 1;
  requestAnimationFrame(() => { fm.style.transition = 'opacity 1.6s'; fm.style.opacity = 0; });
}

// ---------- Warp between dimensions ----------
let di = 0, flash = 0, lastWarp = 0;
function warp() {
  di = (di + 1) % DIMS.length;
  flash = 1;
  lastWarp = performance.now();
  $('dn').textContent = DIMS[di].name;
  flashText(DIMS[di].name);
}
$('dn').textContent = DIMS[0].name;

attachDrag(canvas, { onDoubleTap: () => mode !== 'room' && warp(), onTouch: showHud });

// ---------- Vibration side note ----------
let lastVibe = 0, glowRgb = hexRgb(CHAKRAS[5].c);
const energyWord = (e) => (e < 0.12 ? 'Calm' : e < 0.22 ? 'Flowing' : e < 0.32 ? 'Charged' : 'Euphoric');
function updateVibe(now, energy) {
  if (now - lastVibe < 600) return;
  lastVibe = now;
  const c = CHAKRAS[ear.chakra < 0 ? 3 : ear.chakra];
  document.documentElement.style.setProperty('--glow', c.c);
  glowRgb = hexRgb(c.c);
  const word = document.createElement('span');
  word.textContent = c.vibe;
  $('vt').textContent = '';
  $('vt').append(`${mode === 'silent' ? 'Calm' : energyWord(energy)} · `, word, ` · ${c.name}`);
  const facts = [];
  if (mode === 'silent') facts.push('Breathing slowly');
  else {
    if (ear.tone > 40 && ear.toneLevel > 0.16) facts.push(`Hearing ${Math.round(ear.tone)} Hz (${noteName(ear.tone)})`);
    if (ear.bpm) facts.push(`${Math.round(ear.bpm)} BPM`);
    if (!facts.length) facts.push('Waiting for sound…');
  }
  $('vm').textContent = facts.join(' · ');
  const sol = mode !== 'silent' && ear.tone > 40 ? solfeggio(ear.tone) : null;
  $('vs').textContent = c.note + (sol ? ` Near ${sol.hz} Hz, the “${sol.meaning}” tone.` : '');
  const most = mode === 'silent' ? [] : ear.mostAccessed().slice(0, 3);
  $('vmost').textContent = most.length
    ? 'Most accessed: ' + most.map((x) => `${CHAKRAS[x.i].name} ${Math.round(x.share * 100)}%`).join(' · ')
    : '';
}

// ---------- Loop ----------
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const aura = $('aura');
let lastSkyDraw = 0;
let t0 = performance.now(), prev = t0, trav = 0, sb = 0, sm = 0, sh = 0, bassAvg = 0.2, energyAvg = 0;
const lv = new Array(7).fill(0);

function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  const T = (now - t0) / 1000;
  const M = cameraMatrix();

  if (mode === 'room') {
    room.update(now, dt);
    // The room is slow and calm: 30 fps is plenty and keeps the phone cool overnight.
    if (now - lastSkyDraw >= 32) {
      lastSkyDraw = now;
      renderer.draw('sky', { M, T, ...room.uniforms(), flash: 0 });
    }
    if (ear.micEnded()) $('relisten').hidden = false;
    requestAnimationFrame(frame);
    return;
  }

  let b, m, h;
  if (mode === 'music' || mode === 'file') {
    ear.update(now, dt);
    ({ bass: b, mid: m, high: h } = ear);
    ear.levels.forEach((v, i) => { lv[i] = v; });
  } else { // gentle synthetic breathing so silence still feels alive
    b = 0.18 + 0.22 * Math.pow(Math.sin(T * 0.9) * 0.5 + 0.5, 3);
    m = 0.15 + 0.1 * Math.sin(T * 0.37);
    h = 0.1 + 0.08 * Math.sin(T * 1.3);
    CHAKRAS.forEach((c, i) => { lv[i] += ((0.3 + 0.3 * Math.sin(T * 0.6 + i)) - lv[i]) * 0.05; });
    if (mode === 'silent') ear.chakra = Math.floor(T / 12) % 7; // drift slowly through all seven
  }
  sb += (b - sb) * 0.35; sm += (m - sm) * 0.2; sh += (h - sh) * 0.3;
  bassAvg += (sb - bassAvg) * 0.01; // auto-warp on a big drop: bass far above its recent average
  if (mode !== 'silent' && mode !== 'idle' && sb > 0.42 && sb > bassAvg * 1.55 && now - lastWarp > 9000) warp();
  if (mode === 'silent' && now - lastWarp > 25000) warp();
  const energy = (sb * 1.2 + sm + sh) / 3;
  energyAvg += (energy - energyAvg) * 0.01;
  trav = (trav + dt * (reduced ? 0.15 : 0.25 + energy * 2.6 + ear.pulse * 0.8)) % 64;
  flash = Math.max(0, flash - dt * 2.2);
  ear.pulse = Math.max(0, ear.pulse - dt * (reduced ? 6 : 3.5));

  let top = 0;
  lv.forEach((v, i) => { if (v > lv[top]) top = i; chEls[i].querySelector('i').style.transform = `scale(${1 + v * 2.2})`; });
  chEls.forEach((e, i) => e.classList.toggle('top', i === (ear.chakra < 0 ? top : ear.chakra)));
  $('mood').textContent = mode === 'silent' ? 'Feels calm' : `Feels ${energyWord(energyAvg).toLowerCase()}`;
  if (mode !== 'idle') {
    updateVibe(now, energyAvg);
    aura.style.opacity = (0.18 + energy * 0.6 + ear.pulse * 0.5).toFixed(3);
  }
  const d = DIMS[di];
  renderer.draw('tunnel', {
    M, T, trav, bass: sb, mid: sm, high: sh, N: d.n, fk: d.k, flash: flash * 0.85,
    beat: reduced ? ear.pulse * 0.3 : ear.pulse, pa: d.a, pb: d.b, pd: d.d, glow: glowRgb,
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- Installable app: opens instantly and works offline once visited ----------
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

window.__dimensions = { ear, room, view }; // for debugging in the console
