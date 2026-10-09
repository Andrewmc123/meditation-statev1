// The Hibernation room: listens to your surroundings (and, with the phone lying down, feels
// physical vibration), analyses what's there with standard acoustics measures, tells you whether
// it's restful or disruptive, and paints a sky from it.
//
// Sources for the measures and thresholds: WHO Community Noise (1999) and Night Noise (2009)
// guidelines, IEC 61672-1 A/C weighting, ISO 1996-2 tonal test, intermittency ratio (Wunderli
// 2016), irrelevant-speech research (Salamé & Baddeley 1982). See HIBERNATION.md.
//
// Honesty rules baked in: phone levels are estimates (±5-10 dB without calibration); phones
// can't hear infrasound (<20 Hz) or true ultrasound (>24 kHz); chakra readings are symbolic.

import { CHAKRAS, chakraOf, hexRgb, noteName } from './listen.js';
import { motion } from './view.js';

// ---------- weighting curves (IEC 61672-1) ----------
function aWeight(f) {
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2)
    / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return 20 * Math.log10(ra) + 2.0;
}
function cWeight(f) {
  const f2 = f * f;
  const rc = (12194 ** 2 * f2) / ((f2 + 20.6 ** 2) * (f2 + 12194 ** 2));
  return 20 * Math.log10(rc) + 0.06;
}
const db = (p) => 10 * Math.log10(Math.max(p, 1e-20));
const pw = (d) => 10 ** (d / 10);
function percentile(arr, p) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
}
function median(arr) { return percentile(arr, 50); }
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Converts the analyser's per-bin dB (Blackman window, magnitude / N) into the level of the
// whole signal in dB relative to a full-scale sine: measured once with a test tone.
const ANALYSER_TO_DBFS = 8.3;
// Rough default for phone mics (sensitivity about -26 to -38 dBFS at 94 dB SPL). ±10 dB.
const DEFAULT_SPL_OFFSET = 124;
const PHONE_FLOOR_DBA = 35; // below this a phone mic mostly hears itself

const STORE = 'dimensions.hibernation.v1';
function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
function save(state) { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ } }

// ---------- the sky shader ----------
export const SKY_SHADER = `precision highp float;
uniform vec2 R;uniform mat3 M;uniform float T,bass,mid,high,beat,flash;uniform vec3 glow;
uniform float lvl,tonal,hum,ev,speech,vib,warmth,ultra,cn,cm;
float h31(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*R)/min(R.x,R.y);
  vec3 d=M*normalize(vec3(uv,1.));
  d=normalize(d+vib*.012*vec3(sin(T*71.),cos(T*83.),sin(T*97.)));   // physical vibration: the sky trembles
  float t=T*(.02+lvl*.05);
  vec3 p=d*2.2;
  vec3 q=vec3(fbm(p+vec3(0,0,t)),fbm(p+vec3(5.2,1.3,-t)),fbm(p+vec3(1.7,9.2,t*.7)));
  float f=fbm(p+q*(1.4+bass*2.2)+vec3(t*.5));
  vec3 cool=vec3(.16,.36,.95),warm=vec3(.95,.42,.16);          // noise colour: white is cool, brown is warm
  vec3 base=mix(cool,warm,warmth);
  vec3 col=mix(vec3(.015,.008,.04),base,smoothstep(.25,.95,f))*(.28+lvl*.9);
  col=mix(col,glow,smoothstep(.55,1.05,f)*.55);                  // tinted by the chakra the room hits
  float el=asin(clamp(d.y,-1.,1.));
  col+=glow*hum*.55*pow(abs(sin(el*36.-T*1.5)),24.);              // electrical hum: thin standing waves
  vec2 c2=d.xz/(1.+abs(d.y));                                     // a steady tone draws a Chladni figure
  float ch=cos(cn*3.14159*c2.x)*cos(cm*3.14159*c2.y)-cos(cm*3.14159*c2.x)*cos(cn*3.14159*c2.y);
  col+=mix(glow,vec3(1.),.45)*smoothstep(.14,0.,abs(ch))*tonal*smoothstep(.15,.7,abs(d.y))*.9;
  float ang=acos(clamp(d.z,-1.,1.));                              // sudden noises: a ring rushes past you
  col+=vec3(1.,.9,.82)*ev*smoothstep(.07,0.,abs(ang-(1.-ev)*2.6))*.9;
  col+=vec3(.95,.85,1.)*speech*.18*smoothstep(.25,0.,abs(el))*(.6+.4*sin(T*25.));   // voices: a murmur on the horizon
  vec3 sp=floor(d*170.);float h=fract(sin(dot(sp,vec3(12.9898,78.233,37.719)))*43758.5453);
  col+=vec3(.9,.95,1.)*step(.9975-high*.004-ultra*.008,h)*(.5+.5*sin(T*5.+h*40.))*(.5+ultra*1.5); // highs sparkle
  col=1.-exp(-col*1.5);
  gl_FragColor=vec4(col,1.);
}`;

// ---------- the analysis ----------
export class HibernationRoom {
  constructor(ear, panelsEl, verdictEl) {
    this.ear = ear;
    this.panelsEl = panelsEl;
    this.verdictEl = verdictEl;
    this.prefs = Object.assign({ order: null, collapsed: {}, splOffset: null }, load());
    this.running = false;
  }

  start() {
    const ctx = this.ear.ctx;
    this.sr = ctx.sampleRate;
    this.fine = this.ear.fine;
    this.fast = ctx.createAnalyser();
    this.fast.fftSize = 2048;
    this.fast.smoothingTimeConstant = 0;
    this.ear.micNode.connect(this.fast);
    this.ear.extraTaps = [this.fast]; // reconnected if the mic has to be re-opened
    this.fineDb = new Float32Array(this.fine.frequencyBinCount);
    this.fastDb = new Float32Array(this.fast.frequencyBinCount);
    const weights = (n, size) => Float32Array.from({ length: n }, (_, i) => {
      const f = Math.max(1, (i * this.sr) / size);
      return pw(aWeight(f));
    });
    this.aFast = weights(this.fastDb.length, this.fast.fftSize);
    this.aFine = weights(this.fineDb.length, this.fine.fftSize);
    this.cFine = Float32Array.from({ length: this.fineDb.length }, (_, i) => pw(cWeight(Math.max(1, (i * this.sr) / this.fine.fftSize))));
    this.settings = this.ear.micStream?.getAudioTracks()[0]?.getSettings?.() || {};
    Object.assign(this, {
      t0: performance.now(), pFast: 0, lastLaf: 0, laf: [], lafTimes: [], events: [], inEvent: null,
      lastHeavy: 0, lastUi: 0, speechSeries: [], speechFrames: 0, speechYes: 0, humHist: [],
      toneHist: {}, ultraHist: [], vibSamples: [], vibRate: 0, ev: 0,
      m: {}, // latest metrics
    });
    this.running = true;
    this.startVibration();
    this.buildPanels();
  }

  get splOffset() { return this.prefs.splOffset ?? DEFAULT_SPL_OFFSET; }
  get calibrated() { return this.prefs.splOffset != null; }

  // ---- physical vibration (accelerometer) ----
  startVibration() {
    if (!('DeviceMotionEvent' in window) || !motion.request) { this.vibState = 'unsupported'; return; }
    const attach = () => {
      this.vibState = 'waiting';
      addEventListener('devicemotion', (e) => {
        const a = e.acceleration?.x != null ? e.acceleration : e.accelerationIncludingGravity;
        if (!a || a.x == null) return;
        const now = performance.now();
        this.vibSamples.push([now, a.x, a.y, a.z]);
        while (this.vibSamples.length && now - this.vibSamples[0][0] > 4000) this.vibSamples.shift();
        this.vibState = 'on';
      });
    };
    // Permission was asked for in the same tap that opened the room (iPhone requires that).
    this.vibState = 'waiting';
    motion.request.then((ok) => (ok ? attach() : (this.vibState = 'denied')));
  }

  analyseVibration() {
    const s = this.vibSamples;
    if (s.length < 30) return null;
    const dur = (s[s.length - 1][0] - s[0][0]) / 1000;
    const rate = (s.length - 1) / dur;
    // remove gravity / tilt: subtract each axis' mean, then take the vector magnitude
    const mean = [1, 2, 3].map((k) => s.reduce((a, x) => a + x[k], 0) / s.length);
    const mag = s.map((x) => Math.hypot(x[1] - mean[0], x[2] - mean[1], x[3] - mean[2]));
    const rms = Math.sqrt(mag.reduce((a, v) => a + v * v, 0) / mag.length);
    // dominant frequency of the x/y/z deviation (DFT up to the sensor's Nyquist limit)
    const sig = s.map((x) => (x[1] - mean[0]) + (x[2] - mean[1]) + (x[3] - mean[2]));
    let bestF = 0, bestP = 0;
    for (let f = 1; f < rate / 2; f += 0.5) {
      let re = 0, im = 0;
      for (let i = 0; i < s.length; i++) {
        const t = (s[i][0] - s[0][0]) / 1000;
        re += sig[i] * Math.cos(2 * Math.PI * f * t);
        im += sig[i] * Math.sin(2 * Math.PI * f * t);
      }
      const p = re * re + im * im;
      if (p > bestP) { bestP = p; bestF = f; }
    }
    return { rms, rate, peakHz: bestF };
  }

  // ---- per frame ----
  update(now, dt) {
    if (!this.running) return;
    this.ear.update(now, dt); // tone, chakra, chakra time (shared with the music world)
    // fast A-weighted level (time weighting F = 125 ms)
    this.fast.getFloatFrequencyData(this.fastDb);
    let pa = 0, speechE = 0, totalE = 0;
    const hzF = this.sr / this.fast.fftSize;
    for (let i = 1; i < this.fastDb.length; i++) {
      const p = pw(this.fastDb[i]);
      pa += p * this.aFast[i];
      totalE += p;
      const f = i * hzF;
      if (f >= 300 && f <= 3400) speechE += p;
    }
    this.pFast += (pa - this.pFast) * (1 - Math.exp(-dt / 0.125));
    if (now - this.lastLaf >= 125) {
      this.lastLaf = now;
      const laf = db(this.pFast) + ANALYSER_TO_DBFS + this.splOffset;
      this.laf.push(laf);
      this.lafTimes.push(now);
      while (this.lafTimes.length && now - this.lafTimes[0] > 300000) { this.lafTimes.shift(); this.laf.shift(); }
      this.detectEvent(now, laf);
    }
    // speech envelope (300-3400 Hz energy) for the syllable-rate test
    this.speechSeries.push([now, speechE, totalE]);
    while (this.speechSeries.length && now - this.speechSeries[0][0] > 3000) this.speechSeries.shift();

    this.ev = Math.max(0, this.ev - dt * 0.5);
    if (now - this.lastHeavy > 500) { this.lastHeavy = now; this.heavy(now); }
    if (now - this.lastUi > 1000) { this.lastUi = now; this.render(); }
  }

  detectEvent(now, laf) {
    if (this.laf.length < 40) return; // need ~5 s of background first
    const la90 = percentile(this.laf, 10);
    if (laf >= la90 + 10) {
      if (!this.inEvent) this.inEvent = { start: now, max: laf };
      this.inEvent.max = Math.max(this.inEvent.max, laf);
    } else if (this.inEvent) {
      const ev = this.inEvent;
      this.inEvent = null;
      const last = this.events[this.events.length - 1];
      if (now - ev.start >= 250 && (!last || ev.start - last.end >= 3000)) {
        this.events.push({ start: ev.start, end: now, max: ev.max, above: ev.max - la90 });
        this.ev = 1;
      }
    }
  }

  // ---- the heavier analysis, twice a second ----
  heavy(now) {
    const m = this.m;
    this.fine.getFloatFrequencyData(this.fineDb);
    const N = this.fine.fftSize, hz = this.sr / N, P = this.fineDb;
    const bin = (f) => Math.round(f / hz);
    const P_lin = (i) => pw(P[i]);

    // levels
    let la = 0, lc = 0;
    for (let i = 1; i < P.length; i++) { const p = P_lin(i); la += p * this.aFine[i]; lc += p * this.cFine[i]; }
    m.laNow = db(la) + ANALYSER_TO_DBFS + this.splOffset;
    m.lcMinusLa = db(lc) - db(la);
    const recent = this.laf.filter((_, i) => now - this.lafTimes[i] < 60000);
    m.laeq1 = recent.length ? db(recent.reduce((a, v) => a + pw(v), 0) / recent.length) : m.laNow;
    m.la90 = percentile(this.laf, 10);
    m.lamax = this.laf.length ? Math.max(...this.laf) : m.laNow;
    m.minutes = (now - this.t0) / 60000;

    // strongest frequency and band energy per chakra (20 Hz - 16 kHz)
    let best = -Infinity, bi = 0;
    for (let i = bin(20); i < Math.min(P.length, bin(16000)); i++) if (P[i] > best) { best = P[i]; bi = i; }
    m.peakHz = bi * hz;
    m.peakDb = best;
    const share = CHAKRAS.map((c) => { let s = 0; for (let i = bin(c.lo); i <= Math.min(P.length - 1, bin(c.hi)); i++) s += P_lin(i) * this.aFine[i]; return s; });
    const tot = share.reduce((a, b) => a + b, 0) || 1;
    m.chakraShare = share.map((s) => s / tot);

    // spectral flatness 100 Hz - 8 kHz, and spectral slope over octave bands (noise colour)
    let lnSum = 0, linSum = 0, n = 0;
    for (let i = bin(100); i <= bin(8000); i++) { const p = P_lin(i); lnSum += Math.log(p + 1e-30); linSum += p; n++; }
    m.flatness = Math.exp(lnSum / n) / (linSum / n);
    const centers = [125, 250, 500, 1000, 2000, 4000, 8000];
    const pts = centers.map((fc) => {
      let s = 0, k = 0;
      for (let i = bin(fc / Math.SQRT2); i <= bin(fc * Math.SQRT2); i++) { s += P_lin(i); k++; }
      return [Math.log2(fc), db(s / k)];
    });
    const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    m.slope = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
    m.colour = m.slope > -1.5 ? 'white' : m.slope > -4.5 ? 'pink' : 'brown';

    // mains hum: 50 or 60 Hz family, a narrow peak ≥10 dB above its neighbourhood, persistent
    const humScore = (f0) => Math.max(...[1, 2, 3].map((h) => {
      const c = f0 * h;
      let pk = -Infinity;
      for (let i = bin(c - 2); i <= bin(c + 2); i++) pk = Math.max(pk, P[i]);
      const nb = [];
      for (let i = bin(c - 20); i <= bin(c + 20); i++) if (Math.abs(i * hz - c) >= 5) nb.push(P[i]);
      return { f: c, prom: pk - median(nb) };
    }).map((x) => x.prom));
    const h50 = humScore(50), h60 = humScore(60);
    const humF = h60 >= h50 ? 60 : 50, humProm = Math.max(h50, h60);
    this.humHist.push(humProm >= 10);
    if (this.humHist.length > 20) this.humHist.shift();
    m.hum = { f: humF, prom: humProm, persist: this.humHist.filter(Boolean).length / this.humHist.length };

    // prominent tones: ISO 1996-2 simplified 1/3-octave test, kept if persistent
    const third = [];
    for (let k = -16; k <= 10; k++) { // 25 Hz ... 10 kHz
      const fc = 1000 * 2 ** (k / 3);
      let s = 0, pk = -Infinity, pf = fc;
      for (let i = bin(fc / 2 ** (1 / 6)); i <= Math.min(P.length - 1, bin(fc * 2 ** (1 / 6))); i++) {
        s += P_lin(i);
        if (P[i] > pk) { pk = P[i]; pf = i * hz; }
      }
      third.push({ fc, L: db(s), pf });
    }
    const tonesNow = [];
    for (let k = 1; k < third.length - 1; k++) {
      const b = third[k], need = b.fc < 140 ? 15 : b.fc < 450 ? 8 : 5;
      if (b.L - third[k - 1].L >= need && b.L - third[k + 1].L >= need) tonesNow.push({ ...b, prom: Math.min(b.L - third[k - 1].L, b.L - third[k + 1].L) });
    }
    for (const key of Object.keys(this.toneHist)) this.toneHist[key].hits *= 0.9;
    for (const t of tonesNow) {
      const key = Math.round(t.fc);
      const h = this.toneHist[key] || (this.toneHist[key] = { hits: 0 });
      h.hits = h.hits * 1 + 1;
      Object.assign(h, t);
    }
    m.tones = Object.values(this.toneHist).filter((t) => t.hits > 4).sort((a, b) => b.prom - a.prom).slice(0, 4);

    // near-ultrasound (17 kHz up to what this phone can capture)
    const top = Math.min(22000, this.sr / 2 - 500);
    if (top > 17500) {
      let pk = -Infinity, pf = 0;
      const all = [];
      for (let i = bin(17000); i <= bin(top); i++) { all.push(P[i]); if (P[i] > pk) { pk = P[i]; pf = i * hz; } }
      const local = [];
      for (let i = bin(pf - 500); i <= Math.min(P.length - 1, bin(pf + 500)); i++) if (Math.abs(i * hz - pf) > 60) local.push(P[i]);
      const prom = pk - median(local);
      this.ultraHist.push(prom >= 15 && pk > -120);
      if (this.ultraHist.length > 20) this.ultraHist.shift();
      m.ultra = { available: true, top, f: pf, prom, persist: this.ultraHist.filter(Boolean).length / this.ultraHist.length, band: db(all.reduce((a, d) => a + pw(d), 0) / all.length) };
    } else m.ultra = { available: false, top };

    // voices: speech-band share plus a syllable-rate (3-6 Hz) rhythm in its envelope
    m.speech = this.speechTest();
    this.speechFrames++;
    if (m.speech.likely) this.speechYes++;
    m.speechShare = this.speechYes / this.speechFrames;

    // sudden noises
    const hours = Math.max(m.minutes / 60, 1 / 60);
    m.eventsPerHour = this.events.length / hours;
    const leq = this.laf.length ? this.laf.reduce((a, v) => a + pw(v), 0) / this.laf.length : 0;
    const thr = db(leq) + 3;
    const evE = this.laf.reduce((a, v) => a + (v > thr ? pw(v) : 0), 0);
    m.intermittency = leq ? (100 * evE) / (leq * this.laf.length) : 0;

    m.vibration = this.analyseVibration();
  }

  speechTest() {
    const s = this.speechSeries;
    if (s.length < 60) return { likely: false, ratio: 0, modIndex: 0, peak: 0 };
    const ratio = s.reduce((a, x) => a + x[1], 0) / (s.reduce((a, x) => a + x[2], 0) || 1);
    const env = s.map((x) => Math.sqrt(x[1]));
    const mean = env.reduce((a, b) => a + b, 0) / env.length;
    let inBand = 0, all = 0, peak = 0, peakP = 0;
    for (let f = 0.5; f <= 20; f += 0.5) {
      let re = 0, im = 0;
      for (let i = 0; i < s.length; i++) {
        const t = (s[i][0] - s[0][0]) / 1000;
        re += (env[i] - mean) * Math.cos(2 * Math.PI * f * t);
        im += (env[i] - mean) * Math.sin(2 * Math.PI * f * t);
      }
      const p = re * re + im * im;
      all += p;
      if (f >= 2 && f <= 8) inBand += p;
      if (p > peakP) { peakP = p; peak = f; }
    }
    const modIndex = all ? inBand / all : 0;
    return { likely: ratio > 0.5 && modIndex > 0.35 && peak >= 3 && peak <= 6, ratio, modIndex, peak };
  }

  // ---- grading (good / neutral / bad for rest) ----
  grade() {
    const m = this.m, out = [];
    if (m.laeq1 == null) return out;
    const quiet = m.laeq1 < PHONE_FLOOR_DBA;
    const tonal = m.tones?.length ? 3 : 0, humPenalty = m.hum?.persist >= 0.7 ? 3 : 0;
    const impulsive = m.eventsPerHour > 6 && m.minutes > 2 ? 3 : 0;
    const rating = m.laeq1 + Math.max(tonal, humPenalty) + impulsive;
    // WHO: under 30 dB(A) for sleep. An uncalibrated phone can be 10 dB out either way, so
    // without calibration only clearly loud rooms count against you.
    const [good, ok] = this.calibrated ? [30, 40] : [35, 50];
    out.push({ id: 'level', status: quiet || rating <= good ? 'good' : rating <= ok ? 'ok' : 'bad',
      say: quiet ? 'Very quiet' : rating <= good ? 'Quiet enough to sleep' : rating <= ok ? 'Moderate background' : 'Loud for rest' });
    if (m.hum) out.push({ id: 'hum', status: m.hum.persist >= 0.7 ? 'bad' : m.hum.prom >= 6 ? 'ok' : 'good',
      say: m.hum.persist >= 0.7 ? `Electrical hum at ${m.hum.f} Hz` : 'No electrical hum' });
    out.push({ id: 'tones', status: m.tones?.length ? 'bad' : 'good',
      say: m.tones?.length ? `Steady tone at ${Math.round(m.tones[0].pf)} Hz` : 'No whine or drone' });
    out.push({ id: 'events', status: m.minutes < 2 ? 'ok' : m.eventsPerHour <= 2 ? 'good' : m.eventsPerHour <= 6 ? 'ok' : 'bad',
      say: m.minutes < 2 ? 'Counting sudden noises…' : `${Math.round(m.eventsPerHour)} sudden noises an hour` });
    out.push({ id: 'voices', status: m.speechShare < 0.05 ? 'good' : m.speechShare < 0.2 ? 'ok' : 'bad',
      say: m.speechShare < 0.05 ? 'No voices' : 'Voices in the background' });
    out.push({ id: 'low', status: m.lcMinusLa < 10 ? 'good' : m.lcMinusLa < 15 ? 'ok' : 'bad',
      say: m.lcMinusLa < 10 ? 'Little low rumble' : 'Low-frequency rumble' });
    if (m.ultra?.available) out.push({ id: 'ultra', status: m.ultra.persist >= 0.7 ? 'bad' : m.ultra.persist > 0.2 ? 'ok' : 'good',
      say: m.ultra.persist >= 0.7 ? `High whine near ${(m.ultra.f / 1000).toFixed(1)} kHz` : 'No high-pitched whine' });
    if (m.vibration) out.push({ id: 'vibration', status: m.vibration.rms < 0.02 ? 'good' : m.vibration.rms < 0.08 ? 'ok' : 'bad',
      say: m.vibration.rms < 0.02 ? 'Still surface' : `Vibration around ${m.vibration.peakHz} Hz` });
    return out;
  }

  verdict(grades) {
    const bad = grades.filter((g) => g.status === 'bad').length;
    const ok = grades.filter((g) => g.status === 'ok' && g.id !== 'events').length;
    if (this.m.minutes < 0.15) return { word: 'Listening…', tone: 'ok', line: 'Give it a few seconds to learn your surroundings.' };
    if (bad >= 2) return { word: 'Bad waves', tone: 'bad', line: 'Your surroundings are working against rest.' };
    if (bad === 1 || ok >= 2) return { word: 'Mixed waves', tone: 'ok', line: 'Mostly fine, with something worth fixing.' };
    return { word: 'Good waves', tone: 'good', line: 'Calm, steady surroundings. Good for rest and focus.' };
  }

  // ---- uniforms for the sky ----
  uniforms() {
    const m = this.m, e = this.ear;
    const c = CHAKRAS[e.chakra < 0 ? 5 : e.chakra];
    const tone = m.tones?.[0]?.pf || (e.toneLevel > 0.2 ? e.tone : 0);
    const n = tone ? 2 + (Math.round(Math.log2(tone / 40) * 2) % 7) : 3;
    return {
      bass: e.bass, mid: e.mid, high: e.high, beat: 0,
      glow: hexRgb(c.c),
      lvl: clamp01(((m.laeq1 ?? 40) - 25) / 45),
      tonal: clamp01(((m.tones?.[0]?.prom ?? 0) - 3) / 15 + (e.toneLevel - 0.2)),
      hum: clamp01(m.hum ? m.hum.persist * (m.hum.prom / 15) : 0),
      ev: this.ev,
      speech: clamp01(m.speechShare ? m.speechShare * 3 : 0),
      vib: clamp01(m.vibration ? m.vibration.rms / 0.1 : 0),
      warmth: clamp01(m.slope != null ? (-m.slope) / 6 : 0.5),
      ultra: clamp01(m.ultra?.persist ?? 0),
      cn: n, cm: n + 1 + (tone ? Math.round(tone) % 3 : 0),
    };
  }

  // ---------- the side panel ----------
  cards() {
    const m = this.m, e = this.ear, fmt = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '–');
    const lvl = (x) => (x < PHONE_FLOOR_DBA ? `under ${PHONE_FLOOR_DBA}` : fmt(x));
    const vib = m.vibration;
    const tones = m.tones || [];
    const most = e.mostAccessed().slice(0, 3);
    return [
      { id: 'level', title: 'Sound level', value: m.laeq1 != null ? `${lvl(m.laeq1)} dB(A)` : '…',
        rows: [['Right now', `${lvl(m.laNow)} dB(A)`], ['Last minute (average)', `${lvl(m.laeq1)} dB(A)`],
          ['Background (LA90)', `${lvl(m.la90)} dB(A)`], ['Loudest', `${lvl(m.lamax)} dB(A)`]],
        note: `${this.calibrated ? 'Calibrated' : 'Estimated (uncalibrated phone, ±5-10 dB)'}. For sleep the WHO suggests a bedroom under 30 dB(A) on average and peaks under 45.`
          + (this.settings.noiseSuppression || this.settings.autoGainControl ? ' This browser kept its own noise suppression or auto-gain on, so quiet sounds may read lower than they are.' : ''),
        action: { label: this.calibrated ? 'Recalibrate' : 'Calibrate', run: () => this.calibrate() } },
      { id: 'freq', title: 'Frequencies', value: m.peakHz ? `${Math.round(m.peakHz)} Hz` : '…', spectrum: true,
        rows: [['Strongest frequency', m.peakHz ? `${Math.round(m.peakHz)} Hz (${noteName(m.peakHz)}) → ${CHAKRAS[Math.max(0, chakraOf(m.peakHz))].name}` : '–'],
          ...tones.map((t) => [`Steady tone`, `${Math.round(t.pf)} Hz (${noteName(t.pf)}), ${fmt(t.prom)} dB above nearby`])],
        note: 'The spectrum below goes from deep (left) to high (right), coloured by the chakra each range maps to.' },
      { id: 'hum', title: 'Electrical hum', value: m.hum ? (m.hum.persist >= 0.7 ? `${m.hum.f} Hz` : 'None') : '…',
        rows: m.hum ? [['Mains family', `${m.hum.f} Hz (and ${m.hum.f * 2} Hz)`], ['Stands out by', `${fmt(m.hum.prom)} dB`], ['Present', `${Math.round(m.hum.persist * 100)}% of the time`]] : [],
        note: 'Hum from transformers, fridges, chargers and lights. Tones like this are harder to tune out than steady noise, so they count extra (ISO 1996-2).' },
      { id: 'low', title: 'Low rumble', value: Number.isFinite(m.lcMinusLa) ? `${fmt(m.lcMinusLa)} dB` : '…',
        rows: [['Low-frequency excess (C−A)', `${fmt(m.lcMinusLa)} dB`]],
        note: 'Traffic, ventilation and machinery. Over 15 dB means rumble dominates; it disturbs sleep more than its loudness suggests. Phone mics under-read the deepest bass.' },
      { id: 'events', title: 'Sudden noises', value: m.minutes != null ? `${this.events.length}` : '…',
        rows: [['Count', `${this.events.length} in ${fmt(m.minutes, 1)} min`], ['Per hour', fmt(m.eventsPerHour)],
          ['Intermittency', `${fmt(m.intermittency)}%`],
          ...this.events.slice(-3).reverse().map((ev) => [new Date(Date.now() - (performance.now() - ev.start)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), `+${fmt(ev.above)} dB over background`])],
        note: 'Doors, cars, voices: jumps of 10 dB or more over the background. They wake people more than steady sound does (WHO).' },
      { id: 'voices', title: 'Voices', value: m.speech ? (m.speech.likely ? 'Now' : `${Math.round((m.speechShare || 0) * 100)}%`) : '…',
        rows: m.speech ? [['Speech-range energy', `${Math.round(m.speech.ratio * 100)}%`], ['Rhythm', m.speech.peak ? `${m.speech.peak} Hz (speech is 3-6 Hz)` : '–'], ['Time with voices', `${Math.round((m.speechShare || 0) * 100)}%`]] : [],
        note: 'Background speech hurts focus even when quiet (the irrelevant-speech effect).' },
      { id: 'colour', title: 'Noise colour', value: m.colour || '…',
        rows: [['Slope', `${fmt(m.slope, 1)} dB per octave`], ['Flatness', `${fmt(m.flatness, 2)} (1 = pure noise, 0 = pure tone)`]],
        note: 'White is hissy, pink is like rain, brown is like a deep waterfall. Steady pink or brown sound can mask disruptions; evidence that the colour itself helps sleep is weak.' },
      { id: 'ultra', title: 'High pitch & near-ultrasound', value: m.ultra ? (m.ultra.available ? (m.ultra.persist >= 0.7 ? `${(m.ultra.f / 1000).toFixed(1)} kHz` : 'None') : 'N/A') : '…',
        rows: m.ultra?.available ? [['Watching', `17-${(m.ultra.top / 1000).toFixed(1)} kHz`], ['Strongest', `${(m.ultra.f / 1000).toFixed(1)} kHz, ${fmt(m.ultra.prom)} dB above nearby`], ['Present', `${Math.round(m.ultra.persist * 100)}% of the time`]] : [['Watching', 'This phone records too low a sample rate']],
        note: 'Pest repellers, chargers and electronics can whine up here; young ears hear 17-20 kHz. True ultrasound (above 24 kHz) is beyond any phone mic.' },
      { id: 'vibration', title: 'Physical vibration', value: vib ? `${fmt(vib.rms, 3)} m/s²` : this.vibState === 'denied' ? 'Off' : '…',
        rows: vib ? [['Strength (RMS)', `${fmt(vib.rms, 3)} m/s²`], ['Strongest rhythm', `${vib.peakHz} Hz`], ['Sensor rate', `${Math.round(vib.rate)} Hz (sees up to ${Math.round(vib.rate / 2)} Hz)`]]
          : [['Status', this.vibState === 'denied' ? 'Motion access was declined' : this.vibState === 'unsupported' ? 'No motion sensor' : 'Lay the phone flat on a surface']],
        note: 'Measured by the phone itself, not the mic: footsteps, washing machines, traffic through the floor. Under 0.02 m/s² is essentially still; phone sensors bottom out around there.' },
      { id: 'chakra', title: 'Chakra (symbolic)', value: CHAKRAS[e.chakra < 0 ? 3 : e.chakra].name,
        rows: [['Hitting now', CHAKRAS[e.chakra < 0 ? 3 : e.chakra].name],
          ...most.map((x) => [`Most accessed`, `${CHAKRAS[x.i].name} ${Math.round(x.share * 100)}%`]),
          ...(m.chakraShare ? [['Energy by range', m.chakraShare.map((s, i) => `${CHAKRAS[i].name.split(' ')[0]} ${Math.round(s * 100)}%`).join(' · ')]] : [])],
        note: 'An artistic map of frequency ranges to chakras. It\'s a way to feel the sound, not a measurement of you.' },
      { id: 'infra', title: 'Infrasound', value: 'Not measurable',
        rows: [['Below 20 Hz', 'Phone microphones can\'t hear it']],
        note: 'Controlled studies (e.g. Marshall et al. 2023) found no effects from typical environmental infrasound.' },
    ];
  }

  buildPanels() {
    const el = this.panelsEl;
    el.textContent = '';
    const head = document.createElement('div');
    head.className = 'phead';
    head.innerHTML = '<b>Your surroundings</b>';
    const edit = document.createElement('button');
    edit.className = 'mini';
    edit.textContent = 'Arrange';
    edit.onclick = () => { el.classList.toggle('editing'); edit.textContent = el.classList.contains('editing') ? 'Done' : 'Arrange'; };
    head.append(edit);
    el.append(head);
    const ids = this.cards().map((c) => c.id);
    const order = (this.prefs.order || []).filter((id) => ids.includes(id));
    for (const id of ids) if (!order.includes(id)) order.push(id);
    this.prefs.order = order;
    this.cardEls = {};
    for (const id of order) {
      const card = document.createElement('section');
      card.className = 'card';
      card.dataset.id = id;
      card.innerHTML = '<header><i class="dot"></i><span class="title"></span><span class="val"></span>'
        + '<span class="mv"><button class="mini up" aria-label="Move up">↑</button><button class="mini down" aria-label="Move down">↓</button></span></header>'
        + '<div class="body"><dl></dl><canvas class="spec" hidden></canvas><p class="note"></p><button class="mini act" hidden></button></div>';
      card.classList.toggle('collapsed', !!this.prefs.collapsed[id]);
      card.querySelector('header').onclick = (ev) => {
        if (ev.target.closest('.mv')) return;
        card.classList.toggle('collapsed');
        this.prefs.collapsed[id] = card.classList.contains('collapsed');
        save(this.prefs);
      };
      card.querySelector('.up').onclick = () => this.move(id, -1);
      card.querySelector('.down').onclick = () => this.move(id, 1);
      el.append(card);
      this.cardEls[id] = card;
    }
    this.render();
  }

  move(id, delta) {
    const order = this.prefs.order, i = order.indexOf(id), j = i + delta;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    const card = this.cardEls[id], other = this.cardEls[order[i]];
    if (delta < 0) other.before(card); else other.after(card);
    save(this.prefs);
  }

  calibrate() {
    const now = this.m.laeq1;
    const said = prompt('Calibrate the level: open a sound level meter you trust (for example the free NIOSH SLM app), read it in this room, and enter its dB(A) here.', now ? Math.round(now) : '');
    if (said == null) return;
    const v = parseFloat(said);
    if (!Number.isFinite(v) || !Number.isFinite(now)) return;
    this.prefs.splOffset = this.splOffset + (v - now);
    save(this.prefs);
    this.laf = this.laf.map((x) => x + (v - now));
  }

  render() {
    if (!this.cardEls) return;
    const grades = this.grade(), byId = Object.fromEntries(grades.map((g) => [g.id, g]));
    for (const c of this.cards()) {
      const card = this.cardEls[c.id];
      if (!card) continue;
      card.querySelector('.title').textContent = c.title;
      card.querySelector('.val').textContent = c.value;
      card.querySelector('.dot').className = `dot ${byId[c.id]?.status || 'info'}`;
      const dl = card.querySelector('dl');
      dl.textContent = '';
      for (const [k, v] of c.rows) {
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        dl.append(dt, dd);
      }
      card.querySelector('.note').textContent = c.note;
      const act = card.querySelector('.act');
      act.hidden = !c.action;
      if (c.action) { act.textContent = c.action.label; act.onclick = c.action.run; }
      const spec = card.querySelector('.spec');
      spec.hidden = !c.spectrum;
      if (c.spectrum && !card.classList.contains('collapsed')) this.drawSpectrum(spec);
    }
    // the verdict
    const v = this.verdict(grades);
    const el = this.verdictEl;
    el.dataset.tone = v.tone;
    el.querySelector('.vw').textContent = v.word;
    el.querySelector('.vl').textContent = v.line;
    const why = el.querySelector('.vwhy');
    why.textContent = '';
    const worst = grades.filter((g) => g.status === 'bad').concat(grades.filter((g) => g.status === 'good').slice(0, 2));
    for (const g of worst.slice(0, 4)) {
      const li = document.createElement('li');
      li.className = g.status;
      li.textContent = g.say;
      why.append(li);
    }
  }

  drawSpectrum(cv) {
    const P = this.fineDb, hz = this.sr / this.fine.fftSize;
    const w = (cv.width = cv.clientWidth * (devicePixelRatio || 1));
    const h = (cv.height = 90 * (devicePixelRatio || 1));
    const g = cv.getContext('2d');
    g.clearRect(0, 0, w, h);
    const lo = Math.log10(20), hi = Math.log10(Math.min(20000, this.sr / 2));
    const x = (f) => ((Math.log10(f) - lo) / (hi - lo)) * w;
    let minDb = -130, maxDb = -30;
    for (let px = 0; px < w; px += 2) {
      const f0 = 10 ** (lo + (px / w) * (hi - lo)), f1 = 10 ** (lo + ((px + 2) / w) * (hi - lo));
      let pk = -200;
      for (let i = Math.floor(f0 / hz); i <= Math.ceil(f1 / hz) && i < P.length; i++) pk = Math.max(pk, P[i]);
      const y = h * (1 - clamp01((pk - minDb) / (maxDb - minDb)));
      const ci = chakraOf(f0);
      g.fillStyle = ci >= 0 ? CHAKRAS[ci].c : '#888';
      g.globalAlpha = 0.85;
      g.fillRect(px, y, 2, h - y);
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(239,233,255,.75)';
    g.font = `${10 * (devicePixelRatio || 1)}px Syne, sans-serif`;
    for (const f of [50, 200, 1000, 5000, 15000]) if (f < this.sr / 2) g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x(f) + 2, h - 3);
  }
}
