// Foundation v1 spacing tokens. Source: brief §4. 8px base; matches MUI theme.spacing(1).

export const spacing = {
  0: "0",
  px: "1px",
  "0.5": "2px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "24px",
  6: "32px",
  8: "48px",
  10: "64px",
  12: "96px",
  16: "128px",
} as const;

export const SPACING_BASE_PX = 8;

export type SpacingToken = keyof typeof spacing;
export type SpacingTokens = typeof spacing;
