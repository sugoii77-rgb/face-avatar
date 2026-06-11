// lipsync.js - audio analysis + viseme state for the face avatar
// -----------------------------------------------------------------
// Separated per the lip-sync spec:
//  * createAnalyzer   - audio capture -> AnalyserNode
//  * analyzeFrame     - spectrum -> { openness, width, roundness } (not just amplitude)
//  * visemeTargets    - articulation axes -> per-viseme blend targets, with
//                       idle micro-movement during silence and a hard clamp
//  * smoothWeights    - frame-to-frame lerp easing so shapes never snap
// All tunables live in LIPSYNC below.

export const LIPSYNC = {
  fftSize: 256,            // small fft = fast on mobile
  silenceThreshold: 0.045, // level below this counts as silence
  mouthOpenMax: 0.82,      // hard clamp: total viseme blend never exceeds this
  attack: 0.36,            // how fast a shape fades in  (per frame)
  release: 0.15,           // how fast a shape fades out (per frame)
  gain: 3.2,               // level -> openness gain
  idleAfterMs: 2000,       // silence duration before idle mouth life kicks in
  idleAmplitude: 0.05      // strength of the idle micro-movement
};

const clamp01 = v => Math.min(1, Math.max(0, v));

export function createAnalyzer(stream, ctxRef) {
  const track = stream.getAudioTracks()[0];
  if (!track) return null;
  ctxRef.ctx = ctxRef.ctx || new (window.AudioContext || window.webkitAudioContext)();
  const source = ctxRef.ctx.createMediaStreamSource(new MediaStream([track]));
  const analyser = ctxRef.ctx.createAnalyser();
  analyser.fftSize = LIPSYNC.fftSize;
  analyser.smoothingTimeConstant = 0.5;
  source.connect(analyser);
  if (ctxRef.ctx.state === 'suspended') ctxRef.ctx.resume();
  return { analyser, data: new Uint8Array(analyser.frequencyBinCount), track };
}

// openness (how far the jaw drops), width (E/I spread), roundness (O/U purse)
export function analyzeFrame(an) {
  an.analyser.getByteFrequencyData(an.data);
  const lo = 1, hi = Math.min(an.data.length, 64);  // ~90Hz..6kHz @48k
  let sum = 0, wsum = 0;
  for (let i = lo; i < hi; i++) {
    const v = an.data[i];
    sum += v;
    wsum += v * i;
  }
  const level = sum / (hi - lo) / 255;
  const centroid = sum > 0 ? wsum / sum / hi : 0;
  return {
    level,
    openness: clamp01((level - LIPSYNC.silenceThreshold) * LIPSYNC.gain),
    width: clamp01((centroid - 0.34) / 0.22),     // bright spectrum -> wide mouth
    roundness: clamp01((0.30 - centroid) / 0.16)  // dark spectrum  -> rounded mouth
  };
}

// articulation axes -> blend targets for { a, i, u, e, o }
export function visemeTargets(f, now, silentSince) {
  const t = { a: 0, i: 0, u: 0, e: 0, o: 0 };
  if (f.openness > 0.02) {
    const o = clamp01(f.openness);
    const neutral = Math.max(0, 1 - f.width - f.roundness);
    t.a = o * neutral;                                // medium-big neutral open
    t.e = o * f.width * 0.75 + o * neutral * 0.2;     // wide open
    t.i = (1 - o) * f.width * 0.9 + o * f.width * 0.25; // small wide / teeth
    t.o = o * f.roundness;                            // rounded open
    t.u = (1 - o) * f.roundness * 0.9;                // small rounded
  } else if (now - silentSince > LIPSYNC.idleAfterMs) {
    // silence: do not freeze - barely-there slow mouth life,
    // resting on the photo's natural soft smile
    const ph = now / 1000;
    t.e = (Math.sin(ph * 0.7) * 0.5 + 0.5) * LIPSYNC.idleAmplitude;
  }
  // clamp the total so the mouth can never over-open
  const total = t.a + t.i + t.u + t.e + t.o;
  if (total > LIPSYNC.mouthOpenMax) {
    const k = LIPSYNC.mouthOpenMax / total;
    for (const key in t) t[key] *= k;
  }
  return t;
}

// lerp easing: fast attack, slower release. Returns whether a redraw is
// needed and the current total openness (drives the subtle jaw follow).
export function smoothWeights(weights, targets, names) {
  let changed = false;
  let open = 0;
  for (const name of names) {
    if (name === 'rest') continue;
    const goal = targets[name] || 0;
    const w0 = weights[name];
    let w1 = w0 + (goal - w0) * (goal > w0 ? LIPSYNC.attack : LIPSYNC.release);
    if (Math.abs(w1) < 0.004) w1 = 0;
    weights[name] = w1;
    if (Math.abs(w1 - w0) > 0.004) changed = true;
    open += w1;
  }
  return { changed, open };
}
