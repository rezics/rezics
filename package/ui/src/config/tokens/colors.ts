// Foundation v1 color tokens. Source: openspec/plans/design-system-research/briefs/01-foundation-v1.md §2.
//
// These TS exports mirror the runtime CSS variables defined in
// `package/ui/src/config/tokens.css` (the canonical source of truth at runtime).
// Consumer code that needs a color literal at build/SSR time reads from here;
// runtime UnoCSS theme classes and shadcn primitives read the CSS vars directly.

export type ColorMode = "light" | "dark";

export interface ColorTokens {
  surface: {
    canvas: string;
    base: string;
    elevated: string;
    subtle: string;
    sunken: string;
    // surface-container ladder (MD3-style; tonal, not shadow)
    containerLowest: string;
    containerLow: string;
    container: string;
    containerHigh: string;
    containerHighest: string;
    tint: string;
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
    // container variants (quieter brand role for chips, badges, banners)
    container: string;
    onContainer: string;
  };
  semantic: {
    success: {
      fill: string;
      textLight: string;
      textDark: string;
      container: string;
      onContainer: string;
    };
    warning: {
      fill: string;
      textLight: string;
      textDark: string;
      container: string;
      onContainer: string;
    };
    error: {
      fill: string;
      textLight: string;
      textDark: string;
      container: string;
      onContainer: string;
    };
    info: {
      fill: string;
      textLight: string;
      textDark: string;
      container: string;
      onContainer: string;
    };
  };
  sentiment: {
    positive: { fill: string; textLight: string; textDark: string };
    negative: { fill: string; textLight: string; textDark: string };
  };
  border: {
    whisper: string;
    defined: string;
    strong: string;
    focus: string;
    error: string;
  };
  inverse: {
    surface: string;
    onSurface: string;
    primary: string;
  };
  chart: {
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
  };
  sidebar: {
    background: string;
    foreground: string;
    primary: string;
    primaryForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    ring: string;
  };
}

const brandShared = {
  fill: "#f4606c",
  fillHover: "#e85666",
  fillActive: "#d94c5c",
  textLight: "#C4433A",
  textDark: "#fa7882",
} as const;

// Sentiment polarity (vote / rating / poll). Positive reuses brand 輪迴红 so they
// move in lock-step; negative is a muted slate-blue chosen to read as a calm
// counterpoint on parchment without competing with brand red or `info`.
const sentimentShared = {
  positive: {
    fill: brandShared.fill,
    textLight: brandShared.textLight,
    textDark: brandShared.textDark,
  },
  negative: { fill: "#5B7A99", textLight: "#3F5C7A", textDark: "#7B98B5" },
} as const;

export const lightColors: ColorTokens = {
  surface: {
    canvas: "#f5f4ed",
    base: "#faf9f5",
    elevated: "#ffffff",
    subtle: "#ebeae5",
    sunken: "#e6e5e0",
    containerLowest: "#ffffff",
    containerLow: "#faf9f5",
    container: "#f5f4ed",
    containerHigh: "#ebeae5",
    containerHighest: "#e6e5e0",
    tint: brandShared.fill,
  },
  text: {
    primary: "#1d1d1f",
    secondary: "#6e6e73",
    tertiary: "#86868b",
    disabled: "#c7c7cc",
    onBrand: "#ffffff",
    brand: brandShared.textLight,
  },
  brand: {
    ...brandShared,
    container: "#ffc7cc",
    onContainer: "#1d1d1f",
  },
  semantic: {
    success: {
      fill: "#157352",
      textLight: "#157352",
      textDark: "#3da884",
      container: "#d4edd9",
      onContainer: "#0e3a26",
    },
    warning: {
      fill: "#9c5e22",
      textLight: "#8a5520",
      textDark: "#d8943e",
      container: "#f4e4c8",
      onContainer: "#4a2c0a",
    },
    error: {
      fill: "#cf2d56",
      textLight: "#cf2d56",
      textDark: "#e34c75",
      container: "#fbe1e8",
      onContainer: "#4a0e22",
    },
    info: {
      fill: "#1565c0",
      textLight: "#1565c0",
      textDark: "#5aa9f0",
      container: "#d8e9fb",
      onContainer: "#0a2540",
    },
  },
  sentiment: sentimentShared,
  border: {
    whisper: "rgba(0, 0, 0, 0.08)",
    defined: "#d2d2d7",
    strong: "#86868b",
    focus: brandShared.fill,
    error: "#cf2d56",
  },
  inverse: {
    surface: "#1d1d1f",
    onSurface: "#faf9f5",
    primary: brandShared.textDark,
  },
  chart: {
    1: brandShared.fill,
    2: "#3898ec",
    3: "#1f8a65",
    4: "#b8732e",
    5: "#8e6fbb",
  },
  sidebar: {
    background: "#faf9f5",
    foreground: "#1d1d1f",
    primary: brandShared.fill,
    primaryForeground: "#ffffff",
    accent: "#ebeae5",
    accentForeground: "#1d1d1f",
    border: "rgba(0, 0, 0, 0.08)",
    ring: brandShared.fill,
  },
};

export const darkColors: ColorTokens = {
  surface: {
    canvas: "#1a1a18",
    base: "#26251e",
    elevated: "#30302e",
    subtle: "#1f1e1c",
    sunken: "#141413",
    containerLowest: "#141413",
    containerLow: "#1a1a18",
    container: "#26251e",
    containerHigh: "#30302e",
    containerHighest: "#48484a",
    tint: brandShared.textDark,
  },
  text: {
    primary: "#f0eee6",
    secondary: "#a39e98",
    tertiary: "#6e6c66",
    disabled: "#48484a",
    onBrand: "#ffffff",
    brand: brandShared.textDark,
  },
  brand: {
    ...brandShared,
    container: brandShared.textLight,
    onContainer: "#faf9f5",
  },
  semantic: {
    success: {
      fill: "#157352",
      textLight: "#157352",
      textDark: "#3da884",
      container: "#1c3d33",
      onContainer: "#b8e7c4",
    },
    warning: {
      fill: "#9c5e22",
      textLight: "#8a5520",
      textDark: "#d8943e",
      container: "#3d2a14",
      onContainer: "#f0d3a0",
    },
    error: {
      fill: "#cf2d56",
      textLight: "#cf2d56",
      textDark: "#e34c75",
      container: "#401520",
      onContainer: "#f7c7d3",
    },
    info: {
      fill: "#1565c0",
      textLight: "#1565c0",
      textDark: "#5aa9f0",
      container: "#142a40",
      onContainer: "#c4dffb",
    },
  },
  sentiment: sentimentShared,
  border: {
    whisper: "rgba(255, 255, 255, 0.10)",
    defined: "#3a3937",
    strong: "#5a5856",
    focus: brandShared.textDark,
    error: "#e34c75",
  },
  inverse: {
    surface: "#f0eee6",
    onSurface: "#1d1d1f",
    primary: brandShared.textLight,
  },
  chart: {
    1: brandShared.textDark,
    2: "#5aa9f0",
    3: "#3da884",
    4: "#d8943e",
    5: "#ad8fd6",
  },
  sidebar: {
    background: "#26251e",
    foreground: "#f0eee6",
    primary: brandShared.fill,
    primaryForeground: "#ffffff",
    accent: "#1f1e1c",
    accentForeground: "#f0eee6",
    border: "rgba(255, 255, 255, 0.10)",
    ring: brandShared.textDark,
  },
};

export const colors: Record<ColorMode, ColorTokens> = {
  light: lightColors,
  dark: darkColors,
};
