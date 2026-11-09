import { Easing, interpolate } from "remotion";

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const prog = (f: number, start: number, dur: number) => clamp((f - start) / dur);

export const E = {
  linear: (t: number) => t,
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  /** Damped spring-like settle (overshoot then settle). */
  settle: (t: number, freq = 3.2, damp = 5.5) => (t <= 0 ? 0 : 1 - Math.exp(-damp * t) * Math.cos(freq * Math.PI * t)),
};

/** Clamped keyframe interpolation with a single easing. */
export const kf = (
  f: number,
  input: number[],
  output: number[],
  easing: (t: number) => number = Easing.inOut(Easing.cubic),
) =>
  interpolate(f, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

export type V3 = [number, number, number];

/** Keyframed vec3 with per-segment smooth easing. */
export const kv = (f: number, frames: number[], values: V3[], easing: (t: number) => number = E.inOutCubic): V3 => {
  if (f <= frames[0]) return values[0];
  if (f >= frames[frames.length - 1]) return values[values.length - 1];
  for (let i = 0; i < frames.length - 1; i++) {
    if (f >= frames[i] && f <= frames[i + 1]) {
      const t = easing((f - frames[i]) / (frames[i + 1] - frames[i]));
      return [
        lerp(values[i][0], values[i + 1][0], t),
        lerp(values[i][1], values[i + 1][1], t),
        lerp(values[i][2], values[i + 1][2], t),
      ];
    }
  }
  return values[values.length - 1];
};

/** Deterministic blink: returns eye openness (0 closed .. 1 open). */
export const blink = (f: number, blinkFrames: number[], len = 6) => {
  let v = 1;
  for (const b of blinkFrames) {
    const d = f - b;
    if (d >= 0 && d <= len) {
      const t = d / len;
      v = Math.min(v, Math.abs(1 - 2 * t));
    }
  }
  return v;
};

/** Hash-based deterministic pseudo-random in [0,1). */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Small deterministic camera shake. */
export const shake = (f: number, start: number, dur: number, amp: number) => {
  const t = (f - start) / dur;
  if (t < 0 || t > 1) return [0, 0] as const;
  const a = amp * Math.pow(1 - t, 2);
  return [Math.sin(f * 2.7) * a, Math.cos(f * 3.3) * a] as const;
};
