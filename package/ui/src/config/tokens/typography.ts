// Foundation v1 typography tokens. Source: brief §3.

export const fontFamilies = {
  sans: `'Inter', 'rezics-sans', var(--rezics-font-sans-cjk, 'Source Han Sans TC'), system-ui, -apple-system, 'Segoe UI', sans-serif`,
  serif: `'Source Serif 4', 'rezics-serif', var(--rezics-font-serif-cjk, 'Source Han Serif TC'), Georgia, serif`,
  mono: `'CaskaydiaMono Nerd Font', 'Cascadia Code', 'rezics-mono', 'Sarasa Mono TC', ui-monospace, 'SF Mono', Menlo, monospace`,
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
} as const;

export const fontSizes = {
  xs: "clamp(12px, 0.75rem + 0.05vw, 13px)",
  sm: "clamp(13px, 0.8125rem + 0.1vw, 14px)",
  base: "clamp(14px, 0.875rem + 0.2vw, 16px)",
  md: "clamp(16px, 1rem + 0.3vw, 18px)",
  lg: "clamp(18px, 1.125rem + 0.4vw, 22px)",
  xl: "clamp(22px, 1.375rem + 0.6vw, 28px)",
  "2xl": "clamp(28px, 1.75rem + 0.8vw, 36px)",
  "3xl": "clamp(36px, 2.25rem + 1.2vw, 48px)",
  reader: "clamp(16px, 1rem + 0.4vw, 20px)",
} as const;

export const lineHeights = {
  reader: 1.6,
  body: 1.55,
  ui: 1.4,
  dense: 1.3,
} as const;

export const letterSpacing = {
  tight: "-0.01em",
  normal: "0",
  wide: "0.02em",
} as const;

// Inter's x-height normalized to ~52.2% to match Source Han Sans baseline.
export const fontSizeAdjust = {
  sans: "ex-height 0.522",
} as const;

export const typography = {
  families: fontFamilies,
  weights: fontWeights,
  sizes: fontSizes,
  lineHeights,
  letterSpacing,
  fontSizeAdjust,
} as const;

export type TypographyTokens = typeof typography;
