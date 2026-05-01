// Foundation v1 color tokens. Source: openspec/plans/design-system-research/briefs/01-foundation-v1.md §2.

export type ColorMode = "light" | "dark";

export interface ColorTokens {
  surface: {
    canvas: string;
    base: string;
    elevated: string;
    subtle: string;
    sunken: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    onBrand: string;
    brand: string;
  };
  brand: {
    fill: string;
    fillHover: string;
    fillActive: string;
    textLight: string;
    textDark: string;
  };
  semantic: {
    success: { fill: string; textLight: string; textDark: string };
    warning: { fill: string; textLight: string; textDark: string };
    error: { fill: string; textLight: string; textDark: string };
    info: { fill: string; textLight: string; textDark: string };
  };
  border: {
    whisper: string;
    defined: string;
    strong: string;
    focus: string;
    error: string;
  };
}

const brandShared = {
  fill: "#f4606c",
  fillHover: "#e85666",
  fillActive: "#d94c5c",
  textLight: "#C4433A",
  textDark: "#fa7882",
} as const;

const semanticShared = {
  success: { fill: "#1f8a65", textLight: "#157352", textDark: "#3da884" },
  warning: { fill: "#b8732e", textLight: "#8a5520", textDark: "#d8943e" },
  error: { fill: "#cf2d56", textLight: "#cf2d56", textDark: "#e34c75" },
  info: { fill: "#3898ec", textLight: "#1565c0", textDark: "#5aa9f0" },
} as const;

export const lightColors: ColorTokens = {
  surface: {
    canvas: "#f5f4ed",
    base: "#faf9f5",
    elevated: "#ffffff",
    subtle: "#ebeae5",
    sunken: "#e6e5e0",
  },
  text: {
    primary: "#1d1d1f",
    secondary: "#6e6e73",
    tertiary: "#86868b",
    disabled: "#c7c7cc",
    onBrand: "#ffffff",
    brand: brandShared.textLight,
  },
  brand: brandShared,
  semantic: semanticShared,
  border: {
    whisper: "rgba(0, 0, 0, 0.08)",
    defined: "#d2d2d7",
    strong: "#86868b",
    focus: brandShared.fill,
    error: semanticShared.error.fill,
  },
};

export const darkColors: ColorTokens = {
  surface: {
    canvas: "#1a1a18",
    base: "#26251e",
    elevated: "#30302e",
    subtle: "#1f1e1c",
    sunken: "#141413",
  },
  text: {
    primary: "#f0eee6",
    secondary: "#a39e98",
    tertiary: "#6e6c66",
    disabled: "#48484a",
    onBrand: "#ffffff",
    brand: brandShared.textDark,
  },
  brand: brandShared,
  semantic: semanticShared,
  border: {
    whisper: "rgba(255, 255, 255, 0.10)",
    defined: "#3a3937",
    strong: "#5a5856",
    focus: brandShared.textDark,
    error: semanticShared.error.textDark,
  },
};

export const colors: Record<ColorMode, ColorTokens> = {
  light: lightColors,
  dark: darkColors,
};
