import { applyTheme, argbFromHex, hexFromArgb, Scheme, themeFromSourceColor } from "@material/material-color-utilities";
import { PaletteOptions } from "@mui/material/styles";

/**
 * 从源颜色生成 Material Design 3 动态主题颜色
 */
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

/**
 * 从十六进制颜色字符串生成动态颜色方案
 */
export function generateDynamicColors(
  sourceColor: string,
  isDark: boolean = false,
): DynamicColorScheme {
  // 将十六进制颜色转换为 ARGB
  const argb = argbFromHex(sourceColor);

  // 生成主题
  const theme = themeFromSourceColor(argb);

  // 选择亮色或暗色方案
  const scheme: Scheme = isDark ? theme.schemes.dark : theme.schemes.light;

  // 转换为十六进制颜色
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

/**
 * 将动态颜色方案转换为 Material-UI 调色板选项
 */
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
    background: {
      default: colors.background,
      paper: colors.surface,
    },
    text: {
      primary: colors.onBackground,
      secondary: colors.onSurfaceVariant,
      disabled: colors.outline,
    },
    divider: colors.outlineVariant,
    // 添加自定义颜色到调色板
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

/**
 * 预定义的种子颜色选项
 */
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
  // 自定义颜色
  coral: "#f4606c",
  mint: "#00d4aa",
  lavender: "#b19cd9",
  peach: "#ffab91",
  sage: "#a5d6a7",
} as const;

/**
 * 从图片提取主色调（需要配合 Canvas API 使用）
 */
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

      const imageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const data = imageData.data;

      // 简单的颜色提取算法：找到最常见的颜色
      const colorCounts: { [key: string]: number } = {};

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const alpha = data[i + 3];

        // 跳过透明像素或无效像素
        if (
          alpha === undefined
          || alpha < 128
          || r === undefined
          || g === undefined
          || b === undefined
        ) {
          continue;
        }

        // 将颜色量化以减少变化
        const quantizedR = Math.floor(r / 32) * 32;
        const quantizedG = Math.floor(g / 32) * 32;
        const quantizedB = Math.floor(b / 32) * 32;

        const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
        colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
      }

      // 找到最常见的颜色
      let maxCount = 0;
      let dominantColor = "128,128,128"; // 默认灰色

      for (const [color, count] of Object.entries(colorCounts)) {
        if (count > maxCount) {
          maxCount = count;
          dominantColor = color;
        }
      }

      const [r, g, b] = dominantColor.split(",").map(Number);
      if (r !== undefined && g !== undefined && b !== undefined) {
        const hexColor = `#${r.toString(16).padStart(2, "0")}${
          g
            .toString(16)
            .padStart(2, "0")
        }${b.toString(16).padStart(2, "0")}`;
        resolve(hexColor);
      } else {
        resolve("#808080"); // 默认灰色
      }
    };

    img.onerror = () => {
      reject(new Error("无法加载图片"));
    };

    img.src = imageUrl;
  });
}

/**
 * 应用动态主题到 DOM（用于与其他 UI 库集成）
 */
export function applyDynamicThemeToDOM(
  colors: DynamicColorScheme,
  isDark: boolean = false,
) {
  // 创建 CSS 自定义属性
  const root = document.documentElement;

  // 应用主要颜色
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

  // 应用次要颜色
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

  // 应用表面颜色
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

  // 应用背景颜色
  root.style.setProperty("--md-sys-color-background", colors.background);
  root.style.setProperty("--md-sys-color-on-background", colors.onBackground);

  // 应用其他系统颜色
  root.style.setProperty("--md-sys-color-outline", colors.outline);
  root.style.setProperty(
    "--md-sys-color-outline-variant",
    colors.outlineVariant,
  );
  root.style.setProperty("--md-sys-color-shadow", colors.shadow);
  root.style.setProperty("--md-sys-color-scrim", colors.scrim);
}
