// Foundation v1 spacing reference. Aligned with Tailwind v4 / preset-wind4:
// every UnoCSS step = N × 4px (single `--spacing` base of 0.25rem).
// MUI is independent: `theme.spacing(N) = N × 8px` (set via SPACING_BASE_PX
// below). MUI sx step numbers and UnoCSS class step numbers therefore differ
// for the same pixel target — pick the right one per syntax.
//
// This object is a docs-only reference (used by the Storybook gallery). It
// does NOT drive UnoCSS — preset-wind4 derives every step from `--spacing`.

export const spacing = {
  0: "0",
  px: "1px",
  "0.5": "2px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  24: "96px",
  32: "128px",
} as const;

// MUI base unit. `theme.spacing(N) === N * SPACING_BASE_PX` (so sx={{ p: 4 }} = 32px).
export const SPACING_BASE_PX = 8;

export type SpacingToken = keyof typeof spacing;
export type SpacingTokens = typeof spacing;
