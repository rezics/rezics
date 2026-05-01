// Foundation v1 radius tokens. Source: brief §5. md (8px) is MUI shape.borderRadius default.

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
