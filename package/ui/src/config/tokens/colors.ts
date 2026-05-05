// Foundation v1 color tokens — single source of truth for the rezics design
// system. UnoCSS preset-wind4 reads this file (via uno-config.ts) and emits
// flat `--colors-*` CSS custom properties on demand. The dark-mode override is
// emitted programmatically from `darkColors` by a uno-config preflight.
//
// Shape: 32 shadcn theme slots at top level (background, foreground, primary,
// secondary, muted, accent, destructive, card, popover, border, input, ring,
// chart-1..5, sidebar.*) plus rezics extension groups (surface, text, brand,
// semantic, sentiment, inverse). The rezics groups source their values into
// the shadcn slots — the rezics identity lives in the values, not in a prefix.

export type ColorScheme = "light" | "dark";

export interface ColorTokens {
  // ──── shadcn slots ────────────────────────────────────────────────────────
  background: string;
  foreground: string;
  card: { DEFAULT: string; foreground: string };
  popover: { DEFAULT: string; foreground: string };
  primary: { DEFAULT: string; foreground: string };
  secondary: { DEFAULT: string; foreground: string };
  muted: { DEFAULT: string; foreground: string };
  accent: { DEFAULT: string; foreground: string };
  destructive: { DEFAULT: string; foreground: string };
  input: string;
  ring: string;

  // ──── rezics extensions ───────────────────────────────────────────────────
  surface: {
    canvas: string;
    base: string;
    elevated: string;
    subtle: string;
    sunken: string;
    "container-lowest": string;
    "container-low": string;
    container: string;
    "container-high": string;
    "container-highest": string;
    tint: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    "on-brand": string;
    brand: string;
  };
  brand: {
    fill: string;
    "fill-hover": string;
    "fill-active": string;
    "text-light": string;
    "text-dark": string;
    container: string;
    "on-container": string;
  };
  semantic: {
    success: SemanticColor;
    warning: SemanticColor;
    error: SemanticColor;
    info: SemanticColor;
  };
  sentiment: {
    positive: {
      fill: string;
      text: string;
      "text-light": string;
      "text-dark": string;
    };
    negative: {
      fill: string;
      text: string;
      "text-light": string;
      "text-dark": string;
    };
  };
  border: {
    DEFAULT: string;
    whisper: string;
    defined: string;
    strong: string;
    focus: string;
    error: string;
  };
  inverse: {
    surface: string;
    "on-surface": string;
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
    DEFAULT: string;
    background: string;
    foreground: string;
    primary: string;
    "primary-foreground": string;
    accent: string;
    "accent-foreground": string;
    border: string;
    ring: string;
  };
}

export interface SemanticColor {
  fill: string;
  "text-light": string;
  "text-dark": string;
  container: string;
  "on-container": string;
}

const brandShared = {
  fill: "#f4606c",
  "fill-hover": "#e85666",
  "fill-active": "#d94c5c",
  "text-light": "#C4433A",
  "text-dark": "#fa7882",
} as const;

export const lightColors: ColorTokens = {
  background: "#f5f4ed",
  foreground: "#1d1d1f",
  card: { DEFAULT: "#ffffff", foreground: "#1d1d1f" },
  popover: { DEFAULT: "#f5f4ed", foreground: "#1d1d1f" },
  primary: { DEFAULT: brandShared.fill, foreground: "#ffffff" },
  secondary: { DEFAULT: "#ebeae5", foreground: "#1d1d1f" },
  muted: { DEFAULT: "#e6e5e0", foreground: "#6e6e73" },
  accent: { DEFAULT: "#ebeae5", foreground: "#1d1d1f" },
  destructive: { DEFAULT: "#cf2d56", foreground: "#ffffff" },
  input: "#d2d2d7",
  ring: brandShared.fill,

  surface: {
    canvas: "#f5f4ed",
    base: "#faf9f5",
    elevated: "#ffffff",
    subtle: "#ebeae5",
    sunken: "#e6e5e0",
    "container-lowest": "#ffffff",
    "container-low": "#faf9f5",
    container: "#f5f4ed",
    "container-high": "#ebeae5",
    "container-highest": "#e6e5e0",
    tint: brandShared.fill,
  },
  text: {
    primary: "#1d1d1f",
    secondary: "#6e6e73",
    tertiary: "#86868b",
    disabled: "#c7c7cc",
    "on-brand": "#ffffff",
    brand: brandShared["text-light"],
  },
  brand: {
    ...brandShared,
    container: "#ffc7cc",
    "on-container": "#1d1d1f",
  },
  semantic: {
    success: {
      fill: "#157352",
      "text-light": "#157352",
      "text-dark": "#3da884",
      container: "#d4edd9",
      "on-container": "#0e3a26",
    },
    warning: {
      fill: "#9c5e22",
      "text-light": "#8a5520",
      "text-dark": "#d8943e",
      container: "#f4e4c8",
      "on-container": "#4a2c0a",
    },
    error: {
      fill: "#cf2d56",
      "text-light": "#cf2d56",
      "text-dark": "#e34c75",
      container: "#fbe1e8",
      "on-container": "#4a0e22",
    },
    info: {
      fill: "#1565c0",
      "text-light": "#1565c0",
      "text-dark": "#5aa9f0",
      container: "#d8e9fb",
      "on-container": "#0a2540",
    },
  },
  sentiment: {
    positive: {
      fill: brandShared.fill,
      text: brandShared["text-light"],
      "text-light": brandShared["text-light"],
      "text-dark": brandShared["text-dark"],
    },
    negative: {
      fill: "#5b7a99",
      text: "#3f5c7a",
      "text-light": "#3f5c7a",
      "text-dark": "#7b98b5",
    },
  },
  border: {
    DEFAULT: "#d2d2d7",
    whisper: "rgba(0, 0, 0, 0.08)",
    defined: "#d2d2d7",
    strong: "#86868b",
    focus: brandShared.fill,
    error: "#cf2d56",
  },
  inverse: {
    surface: "#1d1d1f",
    "on-surface": "#faf9f5",
    primary: brandShared["text-dark"],
  },
  chart: {
    1: brandShared.fill,
    2: "#3898ec",
    3: "#1f8a65",
    4: "#b8732e",
    5: "#8e6fbb",
  },
  sidebar: {
    DEFAULT: "#faf9f5",
    background: "#faf9f5",
    foreground: "#1d1d1f",
    primary: brandShared.fill,
    "primary-foreground": "#ffffff",
    accent: "#ebeae5",
    "accent-foreground": "#1d1d1f",
    border: "rgba(0, 0, 0, 0.08)",
    ring: brandShared.fill,
  },
};

export const darkColors: ColorTokens = {
  background: "#1a1a18",
  foreground: "#f0eee6",
  card: { DEFAULT: "#30302e", foreground: "#f0eee6" },
  popover: { DEFAULT: "#1a1a18", foreground: "#f0eee6" },
  primary: { DEFAULT: brandShared.fill, foreground: "#ffffff" },
  secondary: { DEFAULT: "#1f1e1c", foreground: "#f0eee6" },
  muted: { DEFAULT: "#141413", foreground: "#a39e98" },
  accent: { DEFAULT: "#1f1e1c", foreground: "#f0eee6" },
  destructive: { DEFAULT: "#cf2d56", foreground: "#ffffff" },
  input: "#3a3937",
  ring: brandShared["text-dark"],

  surface: {
    canvas: "#1a1a18",
    base: "#26251e",
    elevated: "#30302e",
    subtle: "#1f1e1c",
    sunken: "#141413",
    "container-lowest": "#141413",
    "container-low": "#1a1a18",
    container: "#26251e",
    "container-high": "#30302e",
    "container-highest": "#48484a",
    tint: brandShared["text-dark"],
  },
  text: {
    primary: "#f0eee6",
    secondary: "#a39e98",
    tertiary: "#6e6c66",
    disabled: "#48484a",
    "on-brand": "#ffffff",
    brand: brandShared["text-dark"],
  },
  brand: {
    ...brandShared,
    container: brandShared["text-light"],
    "on-container": "#faf9f5",
  },
  semantic: {
    success: {
      fill: "#157352",
      "text-light": "#157352",
      "text-dark": "#3da884",
      container: "#1c3d33",
      "on-container": "#b8e7c4",
    },
    warning: {
      fill: "#9c5e22",
      "text-light": "#8a5520",
      "text-dark": "#d8943e",
      container: "#3d2a14",
      "on-container": "#f0d3a0",
    },
    error: {
      fill: "#cf2d56",
      "text-light": "#cf2d56",
      "text-dark": "#e34c75",
      container: "#401520",
      "on-container": "#f7c7d3",
    },
    info: {
      fill: "#1565c0",
      "text-light": "#1565c0",
      "text-dark": "#5aa9f0",
      container: "#142a40",
      "on-container": "#c4dffb",
    },
  },
  sentiment: {
    positive: {
      fill: brandShared.fill,
      text: brandShared["text-dark"],
      "text-light": brandShared["text-light"],
      "text-dark": brandShared["text-dark"],
    },
    negative: {
      fill: "#5b7a99",
      text: "#7b98b5",
      "text-light": "#3f5c7a",
      "text-dark": "#7b98b5",
    },
  },
  border: {
    DEFAULT: "#3a3937",
    whisper: "rgba(255, 255, 255, 0.10)",
    defined: "#3a3937",
    strong: "#5a5856",
    focus: brandShared["text-dark"],
    error: "#e34c75",
  },
  inverse: {
    surface: "#f0eee6",
    "on-surface": "#1d1d1f",
    primary: brandShared["text-light"],
  },
  chart: {
    1: brandShared["text-dark"],
    2: "#5aa9f0",
    3: "#3da884",
    4: "#d8943e",
    5: "#ad8fd6",
  },
  sidebar: {
    DEFAULT: "#26251e",
    background: "#26251e",
    foreground: "#f0eee6",
    primary: brandShared.fill,
    "primary-foreground": "#ffffff",
    accent: "#1f1e1c",
    "accent-foreground": "#f0eee6",
    border: "rgba(255, 255, 255, 0.10)",
    ring: brandShared["text-dark"],
  },
};

export const colors: Record<ColorScheme, ColorTokens> = {
  light: lightColors,
  dark: darkColors,
};

// Backwards-compatible alias for callsites that imported the older name.
export type ColorMode = ColorScheme;
