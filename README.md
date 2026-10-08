# Dimensions

Fly through geometric worlds shaped by your music. Big drops warp you into the next dimension.

A phone-installable web app (`public/`): a WebGL kaleidoscope tunnel driven by the Web Audio API.
No framework, no build, no server.

## Put it on your phone
Open the site in **Safari** (iPhone) or **Chrome** (Android), then:
- **iPhone:** Share → **Add to Home Screen**.
- **Android:** ⋮ → **Install app**.

It opens full screen like a normal app, keeps the screen awake while it runs, and opens offline
once you've visited it.

## Using it with Apple Music (or Spotify, YouTube…)
1. Start your song in Apple Music.
2. Open Dimensions and tap **Listen to Apple Music** (allow the microphone the first time).
3. Keep the music playing **out loud**. Dimensions hears it through the microphone; it can't
   hear headphones.

Apps can't read Apple Music's audio directly (it's protected), so the microphone is the only way
to sync with it. The levels adjust automatically, so it works at quiet volumes too. If you switch
apps to change the song and the phone stops the mic, tap **Tap to keep listening** when you come
back.

## What reacts to the music
- **Beats** (detected from the low end) kick the tunnel toward you and flash the rings.
- **Bass drops** warp you into the next dimension (at most every 9 seconds).
- **The chakra the music is hitting** colours the light at the centre and the glow around the
  edges of the screen.
- **Vibration side note** (top left, always visible): the vibe ("Flowing · Loving · Heart"), the
  dominant tone in Hz with its musical note, the tempo in BPM, what that chakra stands for, and
  whether the tone is near a Solfeggio frequency (174, 285, 396, 417, 432, 528, 639, 741, 852,
  963 Hz).

The chakra is chosen from the dominant tone: Root 20-120 Hz, Sacral 120-250, Solar plexus
250-500, Heart 500-1000, Throat 1-2.5 kHz, Third eye 2.5-6 kHz, Crown 6-16 kHz. It's a symbolic,
artistic reading of the sound, not a measurement.

## Other ways to play
- **Choose songs:** pick audio files on the device. They play in order; nothing is uploaded.
- **Drift in silence:** a gentle, self-running version that drifts through all seven chakras.
- **Drag** to look around, **double-tap** or press **Warp** to jump to the next dimension.

## Run it locally
Any static file server works. With Python:
```bash
python -m http.server 5173 --directory public
```
Then open http://localhost:5173. (The microphone only works on `localhost` or HTTPS.)

## Put it online (Render)
`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec). In Render choose
**New > Blueprint** and point it at this repository. There's no build: Render publishes the
`public/` folder as a static site (HTTPS, which the microphone and app install need), with
security headers and microphone permission set. Every push to `main` redeploys it.

## Credits
Font: [Syne](https://fonts.google.com/specimen/Syne) (SIL Open Font License), loaded from Google Fonts.
