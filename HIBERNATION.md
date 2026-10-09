# The Hibernation room: what it measures, and how

The room listens to your surroundings through the microphone (and, with the phone lying flat,
feels physical vibration through its motion sensor), analyses what's there, and grades it for
**rest and focus**. "Good waves" and "bad waves" mean exactly that: good or bad for resting.
The grades come from noise research and standards, listed below. The chakra panel is a
separate, symbolic layer and never affects the verdict.

Everything runs on the phone. Nothing is recorded, stored or uploaded.

## The panels

| Panel | What it shows | How it's measured | Counts against rest when… |
|---|---|---|---|
| Sound level | Now, 1-minute average, background (LA90), loudest | A-weighted level (IEC 61672-1) from a 16k-point FFT; fast time weighting (125 ms) | average over 30 dB(A) (WHO bedroom guidance), with +3 dB for tones/hum and +3 dB for frequent sudden noises. Uncalibrated phones get a 35/50 dB(A) margin |
| Frequencies | Strongest frequency (Hz, musical note, chakra range), steady tones, live spectrum | Peak bin 20 Hz–16 kHz; tones by the ISO 1996-2 one-third-octave test (a band 15/8/5 dB above both neighbours, depending on range), kept only if persistent | a prominent steady tone persists (tones are harder to tune out than broadband noise) |
| Electrical hum | 50 or 60 Hz mains family | Peak within ±2 Hz of 50/100/150 or 60/120/180 Hz vs the median 5–20 Hz away, at ~2.9 Hz resolution | it stands out by 10 dB or more in at least 70% of checks |
| Low rumble | C-weighted minus A-weighted level | LC − LA | over 15 dB (rumble-dominated; worse for sleep than its loudness suggests) |
| Sudden noises | Count, rate per hour, intermittency, recent events | An event is a rise of 10 dB or more over the rolling background (LA90) lasting 0.25 s or more, 3 s apart; intermittency ratio (Wunderli et al. 2016) | more than 6 an hour (about 2 or fewer is good) |
| Voices | Speech-range share, envelope rhythm, time with voices | 300–3400 Hz energy share over 50%, plus a 3–6 Hz syllable rhythm in its envelope | voices in more than 20% of the time (the irrelevant-speech effect hurts focus) |
| Noise colour | White / pink / brown, slope, flatness | Regression slope of octave-band power density 125 Hz–8 kHz (white ≈ 0, pink ≈ −3, brown ≈ −6 dB/octave); spectral flatness 100 Hz–8 kHz | never on its own (the evidence that colour helps sleep is weak; steady sound can mask disruptions) |
| High pitch & near-ultrasound | Strongest narrow peak from 17 kHz to the phone's limit | Peak 15 dB or more above the median within ±500 Hz, persistent | a persistent whine (pest repellers, chargers, electronics) |
| Physical vibration | RMS acceleration, strongest rhythm, sensor rate | DeviceMotion at about 60 Hz with gravity removed; DFT up to the sensor's Nyquist limit (about 30 Hz) | over 0.08 m/s² (under 0.02 is essentially still) |
| Chakra (symbolic) | Chakra hit now, most accessed this session, energy by range | Dominant-tone band, the same mapping as the music world | never: it's art, not a measurement |
| Infrasound | Not measurable | Phone microphones roll off below 20–100 Hz | never: phones can't detect it, and controlled studies found no effects at typical levels |

**Verdict:** two or more "bad" panels = *Bad waves*; one "bad", or two or more "watch" panels = *Mixed waves*; otherwise *Good waves*.

## Limits, stated plainly
- **Levels are estimates.** Phone mics are uncalibrated (±5–10 dB). Use **Calibrate** with a
  meter you trust, such as the free NIOSH SLM app, for real numbers. Below about 35 dB(A) a
  phone mostly hears its own noise, so it says "under 35".
- **Infrasound (below 20 Hz) can't be heard** by any phone microphone.
- **True ultrasound (above 24 kHz) can't be captured** at the 48 kHz rate phones record at, and
  phones are already weak above about 19–20 kHz.
- **Vibration** is measured up to about 30 Hz (the sensor runs at about 60 Hz), and phone
  sensors bottom out around 0.01–0.02 m/s².
- **iPhone:** starting the microphone usually pauses Apple Music, and the mic stops when you
  switch apps or lock the screen (the app offers to resume).

## Sources
- WHO Guidelines for Community Noise (1999); WHO Night Noise Guidelines for Europe (2009); WHO Environmental Noise Guidelines (2018)
- IEC 61672-1 (A and C weighting); ISO 1996-2:2017 (tonal audibility, penalties); BS 4142:2014
- Wunderli et al. 2016, *J Expo Sci Environ Epidemiol* 26:575 (intermittency ratio)
- Kardous & Shaw 2014, *JASA* 135(4):EL186 (phone sound-level accuracy)
- Leventhall 2004, *Noise & Health* 6(23); Persson Waye et al. 2003 (low-frequency noise and sleep)
- Riedy et al. 2021, *Sleep Med Rev* (continuous noise and sleep, very low certainty)
- Salamé & Baddeley 1982; Hongisto 2005 (irrelevant speech)
- Marshall et al. 2023, *Environ Health Perspect* 131(3) (infrasound, no effects); Crichton et al. 2014 (nocebo)
- Leighton 2016, *Proc R Soc A*; Fletcher et al. 2018, *JASA* (very-high-frequency and ultrasound exposure)
- WebKit source and W3C specs for the microphone, motion sensors and audio sessions
