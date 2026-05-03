import {
  argbFromHex,
  hexFromArgb,
  type Scheme,
  themeFromSourceColor,
} from "@material/material-color-utilities";
import type { PaletteOptions } from "@mui/material/styles";

export interface DynamicColorScheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  shadow: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
}

export function generateDynamicColors(
  sourceColor: string,
  isDark: boolean = false,
): DynamicColorScheme {
  const argb = argbFromHex(sourceColor);
  const theme = themeFromSourceColor(argb);
  const scheme: Scheme = isDark ? theme.schemes.dark : theme.schemes.light;

  return {
    primary: hexFromArgb(scheme.primary),
    onPrimary: hexFromArgb(scheme.onPrimary),
    primaryContainer: hexFromArgb(scheme.primaryContainer),
    onPrimaryContainer: hexFromArgb(scheme.onPrimaryContainer),
    secondary: hexFromArgb(scheme.secondary),
    onSecondary: hexFromArgb(scheme.onSecondary),
    secondaryContainer: hexFromArgb(scheme.secondaryContainer),
    onSecondaryContainer: hexFromArgb(scheme.onSecondaryContainer),
    tertiary: hexFromArgb(scheme.tertiary),
    onTertiary: hexFromArgb(scheme.onTertiary),
    tertiaryContainer: hexFromArgb(scheme.tertiaryContainer),
    onTertiaryContainer: hexFromArgb(scheme.onTertiaryContainer),
    error: hexFromArgb(scheme.error),
    onError: hexFromArgb(scheme.onError),
    errorContainer: hexFromArgb(scheme.errorContainer),
    onErrorContainer: hexFromArgb(scheme.onErrorContainer),
    background: hexFromArgb(scheme.background),
    onBackground: hexFromArgb(scheme.onBackground),
    surface: hexFromArgb(scheme.surface),
    onSurface: hexFromArgb(scheme.onSurface),
    surfaceVariant: hexFromArgb(scheme.surfaceVariant),
    onSurfaceVariant: hexFromArgb(scheme.onSurfaceVariant),
    outline: hexFromArgb(scheme.outline),
    outlineVariant: hexFromArgb(scheme.outlineVariant),
    shadow: hexFromArgb(scheme.shadow),
    scrim: hexFromArgb(scheme.scrim),
    inverseSurface: hexFromArgb(scheme.inverseSurface),
    inverseOnSurface: hexFromArgb(scheme.inverseOnSurface),
    inversePrimary: hexFromArgb(scheme.inversePrimary),
  };
}

export function dynamicColorsToPalette(
  colors: DynamicColorScheme,
  mode: "light" | "dark",
): PaletteOptions {
  return {
    mode,
    primary: {
      main: colors.primary,
      light: colors.primaryContainer,
      dark: colors.primary,
      contrastText: colors.onPrimary,
    },
    secondary: {
      main: colors.secondary,
      light: colors.secondaryContainer,
      dark: colors.secondary,
      contrastText: colors.onSecondary,
    },
    error: {
      main: colors.error,
      light: colors.errorContainer,
      dark: colors.error,
      contrastText: colors.onError,
    },
    warning: {
      main: colors.tertiary,
      light: colors.tertiaryContainer,
      dark: colors.tertiary,
      contrastText: colors.onTertiary,
    },
    info: {
      main: colors.tertiary,
      light: colors.tertiaryContainer,
      dark: colors.tertiary,
      contrastText: colors.onTertiary,
    },
    success: {
      main: colors.tertiary,
      light: colors.tertiaryContainer,
      dark: colors.tertiary,
      contrastText: colors.onTertiary,
    },
    // Background, text, and divider intentionally omitted — those stay on the
    // rezics surface tokens regardless of dynamic accent. Only brand-derived
    // hues (primary/secondary/etc.) follow the user's chosen color.
    ...(mode === "light"
      ? {
          surface: {
            main: colors.surface,
            variant: colors.surfaceVariant,
            container: colors.primaryContainer,
            onContainer: colors.onPrimaryContainer,
          },
        }
      : {
          surface: {
            main: colors.surface,
            variant: colors.surfaceVariant,
            container: colors.primaryContainer,
            onContainer: colors.onPrimaryContainer,
          },
        }),
  };
}

export const PRESET_COLORS = {
  red: "#f44336",
  pink: "#e91e63",
  purple: "#9c27b0",
  deepPurple: "#673ab7",
  indigo: "#3f51b5",
  blue: "#2196f3",
  lightBlue: "#03a9f4",
  cyan: "#00bcd4",
  teal: "#009688",
  green: "#4caf50",
  lightGreen: "#8bc34a",
  lime: "#cddc39",
  yellow: "#ffeb3b",
  amber: "#ffc107",
  orange: "#ff9800",
  deepOrange: "#ff5722",
  brown: "#795548",
  grey: "#9e9e9e",
  blueGrey: "#607d8b",
  coral: "#f4606c",
  mint: "#00d4aa",
  lavender: "#b19cd9",
  peach: "#ffab91",
  sage: "#a5d6a7",
} as const;

export async function extractColorFromImage(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("无法获取 Canvas 上下文"));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const colorCounts: { [key: string]: number } = {};

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const alpha = data[i + 3];

        if (
          alpha === undefined ||
          alpha < 128 ||
          r === undefined ||
          g === undefined ||
          b === undefined
        ) {
          continue;
        }

        const quantizedR = Math.floor(r / 32) * 32;
        const quantizedG = Math.floor(g / 32) * 32;
        const quantizedB = Math.floor(b / 32) * 32;

        const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
        colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
      }

      let maxCount = 0;
      let dominantColor = "128,128,128";

      for (const [color, count] of Object.entries(colorCounts)) {
        if (count > maxCount) {
          maxCount = count;
          dominantColor = color;
        }
      }

      const [r, g, b] = dominantColor.split(",").map(Number);
      if (r !== undefined && g !== undefined && b !== undefined) {
        const hexColor = `#${r.toString(16).padStart(2, "0")}${g
          .toString(16)
          .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
        resolve(hexColor);
      } else {
        resolve("#808080");
      }
    };

    img.onerror = () => {
      reject(new Error("无法加载图片"));
    };

    img.src = imageUrl;
  });
}

export function applyDynamicThemeToDOM(
  colors: DynamicColorScheme,
  _isDark: boolean = false,
) {
  const root = document.documentElement;

  root.style.setProperty("--md-sys-color-primary", colors.primary);
  root.style.setProperty("--md-sys-color-on-primary", colors.onPrimary);
  root.style.setProperty(
    "--md-sys-color-primary-container",
    colors.primaryContainer,
  );
  root.style.setProperty(
    "--md-sys-color-on-primary-container",
    colors.onPrimaryContainer,
  );

  root.style.setProperty("--md-sys-color-secondary", colors.secondary);
  root.style.setProperty("--md-sys-color-on-secondary", colors.onSecondary);
  root.style.setProperty(
    "--md-sys-color-secondary-container",
    colors.secondaryContainer,
  );
  root.style.setProperty(
    "--md-sys-color-on-secondary-container",
    colors.onSecondaryContainer,
  );

  root.style.setProperty("--md-sys-color-surface", colors.surface);
  root.style.setProperty("--md-sys-color-on-surface", colors.onSurface);
  root.style.setProperty(
    "--md-sys-color-surface-variant",
    colors.surfaceVariant,
  );
  root.style.setProperty(
    "--md-sys-color-on-surface-variant",
    colors.onSurfaceVariant,
  );

  root.style.setProperty("--md-sys-color-background", colors.background);
  root.style.setProperty("--md-sys-color-on-background", colors.onBackground);

  root.style.setProperty("--md-sys-color-outline", colors.outline);
  root.style.setProperty(
    "--md-sys-color-outline-variant",
    colors.outlineVariant,
  );
  root.style.setProperty("--md-sys-color-shadow", colors.shadow);
  root.style.setProperty("--md-sys-color-scrim", colors.scrim);
}
