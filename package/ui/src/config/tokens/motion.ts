// Foundation v1 motion tokens. Source: brief §6.

export const duration = {
  fast: "120ms",
  base: "200ms",
  slow: "350ms",
  page: "500ms",
} as const;

export const durationMs = {
  fast: 120,
  base: 200,
  slow: 350,
  page: 500,
} as const;

export const easing = {
  out: "cubic-bezier(0.0, 0.0, 0.2, 1)",
  inOut: "cubic-bezier(0.4, 0.0, 0.2, 1)",
  spring: "cubic-bezier(0.4, 1.4, 0.5, 1)",
} as const;

export const pressScale = {
  resting: "scale(1)",
  active: "scale(0.98)",
} as const;

export const motion = {
  duration,
  durationMs,
  easing,
  pressScale,
} as const;

export type DurationToken = keyof typeof duration;
export type EasingToken = keyof typeof easing;
export type MotionTokens = typeof motion;
