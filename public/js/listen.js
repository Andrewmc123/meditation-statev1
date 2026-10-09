// Listening: microphone or song files in, musical features out (bands, dominant tone, chakra,
// beats, tempo, and which chakra the sound has hit most over the session).

export const CHAKRAS = [ // symbolic frequency mapping (artistic, not measured)
  { name: 'Root', lo: 20, hi: 120, c: '#ff3b3b', vibe: 'Grounding', note: 'Stability and safety. Feels steady, heavy and present in the body.' },
  { name: 'Sacral', lo: 120, hi: 250, c: '#ff8a2b', vibe: 'Sensual', note: 'Creativity and pleasure. Warm, flowing, wants to move.' },
  { name: 'Solar plexus', lo: 250, hi: 500, c: '#ffd43b', vibe: 'Empowering', note: 'Confidence and drive. Bold, motivated, sure of itself.' },
  { name: 'Heart', lo: 500, hi: 1000, c: '#3bdc7a', vibe: 'Loving', note: 'Love and connection. Open, tender, uplifting.' },
  { name: 'Throat', lo: 1000, hi: 2500, c: '#3bb6ff', vibe: 'Expressive', note: 'Voice and truth. Clear, honest, saying what it means.' },
  { name: 'Third eye', lo: 2500, hi: 6000, c: '#5b5bff', vibe: 'Intuitive', note: 'Insight and imagination. Dreamy, reflective, inward.' },
  { name: 'Crown', lo: 6000, hi: 16000, c: '#c65bff', vibe: 'Transcendent', note: 'Spirit and expansion. Airy, weightless, bigger than you.' },
];
const SOLFEGGIO = [[174, 'pain relief'], [285, 'healing'], [396, 'liberation'], [417, 'change'],
  [432, 'natural tuning'], [528, 'love and repair'], [639, 'connection'], [741, 'expression'],
  [852, 'intuition'], [963, 'oneness']];
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const chakraOf = (f) => CHAKRAS.findIndex((c) => f >= c.lo && f < c.hi);
export function noteName(f) {
  const m = Math.round(12 * Math.log2(f / 440)) + 69;
  return NOTES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}
export function solfeggio(f) {
  for (const [s, meaning] of SOLFEGGIO) if (Math.abs(f - s) / s < 0.02) return { hz: s, meaning };
  return null;
}
export const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

export class Ear {
  constructor() {
    this.ctx = null;
    this.analyser = null;   // music analysis (2048-point FFT, smoothed)
    this.fine = null;       // detailed analysis for the Hibernation room (16384-point FFT)
    this.freq = null;
    this.source = 'none';   // none | mic | file
    this.micStream = null;
    this.micNode = null;
    this.mediaNode = null;
    this.reset();
  }

  reset() {
    Object.assign(this, {
      peak: 0.25, prevLow: 0, fluxAvg: 0.01, lastBeat: 0, beats: [], bpm: 0, tone: 0, toneLevel: 0,
      chakra: -1, votes: new Array(7).fill(0), chakraTime: new Array(7).fill(0), pulse: 0,
      bass: 0, mid: 0, high: 0, levels: new Array(7).fill(0),
    });
  }

  /** Must be called from a tap (browsers only start audio after a user gesture). */
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.75;
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.fine = this.ctx.createAnalyser();
      this.fine.fftSize = 16384; // ~2.9 Hz bins at 48 kHz: enough to separate 50 Hz from 60 Hz hum
      this.fine.smoothingTimeConstant = 0.6;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  get hz() { return this.ctx.sampleRate / this.analyser.fftSize; }

  async listen() {
    this.ensure();
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const old = this.micNode;
    this.micNode = this.ctx.createMediaStreamSource(this.micStream);
    this.micNode.connect(this.analyser); // never to the speakers: no feedback
    this.micNode.connect(this.fine);
    if (old) { // re-listening: move any other listeners (the room's fast analyser) across
      this.extraTaps?.forEach((n) => this.micNode.connect(n));
      old.disconnect();
    }
    this.source = 'mic';
    return this.micStream;
  }

  /** iOS mutes or ends the mic when you switch apps, lock the screen or take a call. */
  micEnded() {
    return this.source === 'mic' && this.micStream
      && this.micStream.getAudioTracks().every((t) => t.readyState === 'ended' || t.muted);
  }

  playFrom(player) {
    this.ensure();
    if (!this.mediaNode) {
      this.mediaNode = this.ctx.createMediaElementSource(player);
      this.mediaNode.connect(this.analyser);
      this.mediaNode.connect(this.fine);
      this.analyser.connect(this.ctx.destination);
    }
    this.source = 'file';
  }

  band(lo, hi) {
    const hz = this.hz;
    const a = Math.max(1, Math.floor(lo / hz)), b = Math.min(this.freq.length - 1, Math.ceil(hi / hz));
    let s = 0;
    for (let i = a; i <= b; i++) s += this.freq[i];
    return s / ((b - a + 1) * 255);
  }

  /** Run once per frame while listening. dt in seconds, now in ms. */
  update(now, dt) {
    if (this.source === 'none' || !this.analyser) return;
    this.analyser.getByteFrequencyData(this.freq);
    let b = this.band(20, 150), m = this.band(250, 2000), h = this.band(4000, 12000) * 1.6;
    let gain = 1;
    if (this.source === 'mic') { // a phone mic hears music quietly and unevenly: follow its loudest recent level
      this.peak = Math.max(b, m, h, this.peak * 0.997, 0.06);
      gain = Math.min(4, 0.5 / this.peak);
      b = Math.min(1, b * gain); m = Math.min(1, m * gain); h = Math.min(1, h * gain);
    }
    this.bass = b; this.mid = m; this.high = h;
    CHAKRAS.forEach((c, i) => { this.levels[i] += (this.band(c.lo, c.hi) * (1 + i * 0.25) * gain - this.levels[i]) * 0.2; });

    // Dominant tone: the strongest bin between 40 Hz and 4 kHz, refined between its neighbours.
    const hz = this.hz, f = this.freq;
    let best = 0, bi = 0;
    for (let i = Math.ceil(40 / hz); i < Math.min(f.length - 1, 4000 / hz); i++) if (f[i] > best) { best = f[i]; bi = i; }
    this.toneLevel = best / 255;
    if (best > 40 && bi > 0) {
      const a = f[bi - 1], c = f[bi + 1], off = 0.5 * (a - c) / ((a - 2 * best + c) || 1);
      const tone = (bi + off) * hz;
      this.tone = Math.abs(tone - this.tone) / (this.tone || 1) > 0.25 ? tone : this.tone + (tone - this.tone) * 0.15;
    }
    // Chakra: the band of the dominant tone (or, with no clear tone, the loudest band),
    // held until another one clearly takes over.
    let top = chakraOf(this.tone);
    if (best <= 40 || top < 0) {
      const scores = CHAKRAS.map((c, i) => this.band(c.lo, c.hi) * (1 + i * 0.18));
      top = scores.indexOf(Math.max(...scores));
    }
    this.votes = this.votes.map((v, i) => v * 0.97 + (i === top ? 0.03 : 0));
    const lead = this.votes.indexOf(Math.max(...this.votes));
    if (lead !== this.chakra && (this.chakra < 0 || this.votes[lead] > this.votes[this.chakra] * 1.15)) this.chakra = lead;
    if (best > 40 && this.chakra >= 0) this.chakraTime[this.chakra] += dt; // only while there's real sound

    // Beats: a jump in low-end energy well above its recent average (spectral flux).
    const low = this.band(30, 180), rise = Math.max(0, low - this.prevLow);
    this.prevLow = low;
    this.fluxAvg += (rise - this.fluxAvg) * 0.05;
    if (rise > this.fluxAvg * 2.6 && rise > 0.015 && now - this.lastBeat > 280) {
      if (this.lastBeat) {
        const ibi = now - this.lastBeat;
        if (ibi < 1500) { this.beats.push(ibi); if (this.beats.length > 24) this.beats.shift(); }
      }
      this.lastBeat = now;
      this.pulse = 1;
      if (this.beats.length >= 6) {
        const s = [...this.beats].sort((x, y) => x - y);
        let bpm = 60000 / s[s.length >> 1];
        while (bpm < 75) bpm *= 2;
        while (bpm > 170) bpm /= 2;
        this.bpm += (bpm - this.bpm) * (this.bpm ? 0.2 : 1);
      }
    }
    if (now - this.lastBeat > 4000) { this.beats = []; this.bpm = 0; }
  }

  /** Chakras ranked by how long the sound has spent in each, with shares (0-1). */
  mostAccessed() {
    const total = this.chakraTime.reduce((a, b) => a + b, 0);
    if (total < 1) return [];
    return this.chakraTime.map((t, i) => ({ i, share: t / total }))
      .filter((x) => x.share > 0).sort((a, b) => b.share - a.share);
  }
}
