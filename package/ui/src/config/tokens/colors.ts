// Foundation color tokens — single source of truth for the rezics design
// system. UnoCSS preset-wind4 reads this file (via uno-config.ts) and emits
// flat `--colors-*` CSS custom properties on demand. The dark-mode override is
// emitted programmatically from `darkColors` by a uno-config preflight.
//
// Brand red carries identity, primary filled controls, selected indicators, and
// short stable brand chrome. Ordinary textual navigation uses the link group.
// Contrast numbers are diagnostics, not a blanket veto; long-form and frequently
// changing content must stay on neutral text roles.

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
  link: {
    DEFAULT: string;
    hover: string;
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
  fill: "#DB515C",
  "fill-hover": "#C94651",
  "fill-active": "#B83F49",
  "text-light": "#DB515C",
  "text-dark": "#DB515C",
} as const;

export const lightColors: ColorTokens = {
  background: "#ffffff",
  foreground: "#111111",
  card: { DEFAULT: "#ffffff", foreground: "#111111" },
  popover: { DEFAULT: "#ffffff", foreground: "#111111" },
  primary: { DEFAULT: brandShared.fill, foreground: "#ffffff" },
  secondary: { DEFAULT: "#f5f5f5", foreground: "#111111" },
  muted: { DEFAULT: "#f5f5f5", foreground: "#5f6368" },
  accent: { DEFAULT: "#f5f5f5", foreground: "#111111" },
  destructive: { DEFAULT: "#cf2d56", foreground: "#ffffff" },
  input: "#d9d9d9",
  ring: brandShared.fill,

  surface: {
    canvas: "#ffffff",
    base: "#ffffff",
    elevated: "#ffffff",
    subtle: "#f5f5f5",
    sunken: "#eeeeee",
    "container-lowest": "#ffffff",
    "container-low": "#ffffff",
    container: "#ffffff",
    "container-high": "#f5f5f5",
    "container-highest": "#eeeeee",
    tint: brandShared.fill,
  },
  text: {
    primary: "#111111",
    secondary: "#5f6368",
    tertiary: "#7a7a7a",
    disabled: "#b8b8b8",
    "on-brand": "#ffffff",
    brand: brandShared["text-light"],
  },
  link: {
    DEFAULT: "#1a73e8",
    hover: "#1a73e8",
  },
  brand: {
    ...brandShared,
    container: "#f8d7da",
    "on-container": "#541016",
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
      fill: "#1a73e8",
      "text-light": "#1a73e8",
      "text-dark": "#1a73e8",
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
    DEFAULT: "#d9d9d9",
    whisper: "rgba(0, 0, 0, 0.10)",
    defined: "#d9d9d9",
    strong: "#8a8a8a",
    focus: brandShared.fill,
    error: "#cf2d56",
  },
  inverse: {
    surface: "#000000",
    "on-surface": "#ffffff",
    primary: brandShared.fill,
  },
  chart: {
    1: brandShared.fill,
    2: "#1a73e8",
    3: "#157352",
    4: "#9c5e22",
    5: "#8e6fbb",
  },
  sidebar: {
    DEFAULT: "#ffffff",
    background: "#ffffff",
    foreground: "#111111",
    primary: brandShared.fill,
    "primary-foreground": "#ffffff",
    accent: "#f5f5f5",
    "accent-foreground": "#111111",
    border: "rgba(0, 0, 0, 0.10)",
    ring: brandShared.fill,
  },
};

export const darkColors: ColorTokens = {
  background: "#000000",
  foreground: "#f5f5f5",
  card: { DEFAULT: "#161616", foreground: "#f5f5f5" },
  popover: { DEFAULT: "#161616", foreground: "#f5f5f5" },
  primary: { DEFAULT: brandShared.fill, foreground: "#ffffff" },
  secondary: { DEFAULT: "#202020", foreground: "#f5f5f5" },
  muted: { DEFAULT: "#202020", foreground: "#b6b6b6" },
  accent: { DEFAULT: "#202020", foreground: "#f5f5f5" },
  destructive: { DEFAULT: "#e34c75", foreground: "#ffffff" },
  input: "#3a3a3a",
  ring: brandShared.fill,

  surface: {
    canvas: "#000000",
    base: "#0b0b0b",
    elevated: "#161616",
    subtle: "#202020",
    sunken: "#2a2a2a",
    "container-lowest": "#000000",
    "container-low": "#0b0b0b",
    container: "#161616",
    "container-high": "#202020",
    "container-highest": "#2a2a2a",
    tint: brandShared.fill,
  },
  text: {
    primary: "#f5f5f5",
    secondary: "#b6b6b6",
    tertiary: "#8a8a8a",
    disabled: "#5c5c5c",
    "on-brand": "#ffffff",
    brand: brandShared["text-dark"],
  },
  link: {
    DEFAULT: "#1a73e8",
    hover: "#1a73e8",
  },
  brand: {
    ...brandShared,
    container: "#4a171d",
    "on-container": "#f8d7da",
  },
  semantic: {
    success: {
      fill: "#3da884",
      "text-light": "#157352",
      "text-dark": "#3da884",
      container: "#0e3a26",
      "on-container": "#d4edd9",
    },
    warning: {
      fill: "#d8943e",
      "text-light": "#8a5520",
      "text-dark": "#d8943e",
      container: "#42270f",
      "on-container": "#f4e4c8",
    },
    error: {
      fill: "#e34c75",
      "text-light": "#cf2d56",
      "text-dark": "#e34c75",
      container: "#4a0e22",
      "on-container": "#fbe1e8",
    },
    info: {
      fill: "#1a73e8",
      "text-light": "#1a73e8",
      "text-dark": "#1a73e8",
      container: "#09294f",
      "on-container": "#d8e9fb",
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
    DEFAULT: "#2a2a2a",
    whisper: "rgba(255, 255, 255, 0.12)",
    defined: "#3a3a3a",
    strong: "#777777",
    focus: brandShared.fill,
    error: "#e34c75",
  },
  inverse: {
    surface: "#ffffff",
    "on-surface": "#111111",
    primary: brandShared.fill,
  },
  chart: {
    1: brandShared.fill,
    2: "#1a73e8",
    3: "#3da884",
    4: "#d8943e",
    5: "#b49ad8",
  },
  sidebar: {
    DEFAULT: "#000000",
    background: "#000000",
    foreground: "#f5f5f5",
    primary: brandShared.fill,
    "primary-foreground": "#ffffff",
    accent: "#202020",
    "accent-foreground": "#f5f5f5",
    border: "rgba(255, 255, 255, 0.12)",
    ring: brandShared.fill,
  },
};

export const colors: Record<ColorScheme, ColorTokens> = {
  light: lightColors,
  dark: darkColors,
};
