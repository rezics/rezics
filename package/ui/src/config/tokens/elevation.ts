// Foundation v1 elevation tokens. Source: brief §7.
// Default policy is borderless with whisper borders. Shadows reserved for modal-tier surfaces only.

export const lightShadows = {
  none: "none",
  1: "0 1px 2px rgba(0, 0, 0, 0.04)",
  2: "0 2px 4px rgba(0, 0, 0, 0.04), 0 4px 8px rgba(0, 0, 0, 0.04)",
  3: "0 4px 8px rgba(0, 0, 0, 0.04), 0 8px 16px rgba(0, 0, 0, 0.04), 0 16px 32px rgba(0, 0, 0, 0.06)",
  modal:
    "0 1px 2px rgba(0, 0, 0, 0.03), 0 4px 8px rgba(0, 0, 0, 0.04), 0 8px 16px rgba(0, 0, 0, 0.04), 0 16px 32px rgba(0, 0, 0, 0.06)",
} as const;

export const darkShadows = {
  none: "none",
  1: "0 1px 2px rgba(0, 0, 0, 0.20)",
  2: "0 2px 4px rgba(0, 0, 0, 0.20), 0 4px 8px rgba(0, 0, 0, 0.24)",
  3: "0 4px 8px rgba(0, 0, 0, 0.24), 0 8px 16px rgba(0, 0, 0, 0.28), 0 16px 32px rgba(0, 0, 0, 0.36)",
  modal:
    "0 1px 2px rgba(0, 0, 0, 0.20), 0 4px 8px rgba(0, 0, 0, 0.28), 0 8px 16px rgba(0, 0, 0, 0.32), 0 16px 32px rgba(0, 0, 0, 0.40)",
} as const;

export const elevation = {
  light: lightShadows,
  dark: darkShadows,
} as const;

export type ElevationToken = keyof typeof lightShadows;
export type ElevationTokens = typeof elevation;
