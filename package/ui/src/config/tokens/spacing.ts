// Foundation v1 spacing reference. Aligned with Tailwind v4 / preset-wind4:
// every UnoCSS step = N × 4px (single `--spacing` base of 0.25rem).
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

export type SpacingToken = keyof typeof spacing;
export type SpacingTokens = typeof spacing;
