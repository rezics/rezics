// Foundation v1 radius tokens. Source: brief §5.
// Foundation v1 圆角 token。来源：brief §5。

export const radius = {
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "24px",
  pill: "9999px",
  full: "50%",
} as const;

export const RADIUS_BASE_PX = 8;

export type RadiusToken = keyof typeof radius;
export type RadiusTokens = typeof radius;
