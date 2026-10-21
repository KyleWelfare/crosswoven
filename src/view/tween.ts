/** Easing for animations that run as a pure function of time, so a scene can be drawn at any moment. */

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** How far through `[start, start + duration)` a time is, from 0 before to 1 after. */
export function progress(time: number, start: number, duration: number): number {
  return clamp01((time - start) / duration);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Overshoots a little before settling, for things that pop into place. */
export function easeOutBack(t: number): number {
  const overshoot: number = 1.7;
  return 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

/** From 0 to 1 and back, once every `period` milliseconds. */
export function pulse(time: number, period: number): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * time) / period);
}
