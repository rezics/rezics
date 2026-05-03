import presetWind4 from "@unocss/preset-wind4";
import { container as defaultContainer } from "@unocss/preset-wind4/theme";
import transformerDirectives from "@unocss/transformer-directives";
import { defineConfig, presetAttributify, presetIcons } from "unocss";
import presetAnimations from "unocss-preset-animations";
import { presetScrollbarHide } from "unocss-preset-scrollbar-hide";
import { builtinColors, presetShadcn } from "unocss-preset-shadcn";

export function createUnoConfig() {
  return defineConfig({
    presets: [
      presetWind4({ preflights: { reset: true } }),
      presetShadcn(builtinColors.map((c) => ({ color: c }))),
      presetAnimations(),
      presetIcons(),
      presetAttributify({
        prefix: "un-",
        prefixedOnly: true,
      }), // support <div un-text="red-500">
      // * small presets below
      presetScrollbarHide(),
    ],
    transformers: [transformerDirectives()],
    shortcuts: {},
    theme: {
      breakpoint: {
        xs: "0px",
        xsm: "450px", // 基础移动端
        sm: "640px", // 大屏手机 / 小型平板
        md: "768px", // 平板电脑 (iPad 纵向)
        lg: "1024px", // 笔记本电脑 (iPad 横向 / 小屏 PC)
        xl: "1280px", // 标准桌面显示器
        "2xl": "1536px", // 大屏显示器 / 高分屏
      },
      container: {
        // container 只能定义 defaultContainer 中有的key，否则会导致奇怪的覆盖
        ...defaultContainer,
        xs: "450px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
        "8xl": "1440px",
      },
      // rezics design tokens — resolve to CSS variables defined in shared/styles/layers.css
      // so utilities auto-switch with [data-theme="dark"]. See foundation v1 brief.
      //
      // NOTE: spacing intentionally omitted. preset-wind4 follows Tailwind v4's
      // single-`--spacing` model (every step = N × 4px via calc). Overriding
      // `theme.spacing` here breaks shadcn (which assumes native step values)
      // and conflicts with preset-wind4's preflight emission. Mental model:
      // step number × 4 = pixels (so 8 → 32px, 12 → 48px, 24 → 96px).
      borderRadius: {
        none: "0",
        xs: "var(--rezics-radius-xs)",
        sm: "var(--rezics-radius-sm)",
        md: "var(--rezics-radius-md)",
        DEFAULT: "var(--rezics-radius-md)",
        lg: "var(--rezics-radius-lg)",
        xl: "var(--rezics-radius-xl)",
        "2xl": "var(--rezics-radius-2xl)",
        pill: "var(--rezics-radius-pill)",
        full: "var(--rezics-radius-full)",
      },
      fontFamily: {
        sans: "var(--rezics-font-sans)",
        serif: "var(--rezics-font-serif)",
        mono: "var(--rezics-font-mono)",
      },
      transitionDuration: {
        fast: "var(--rezics-motion-fast)",
        base: "var(--rezics-motion-base)",
        slow: "var(--rezics-motion-slow)",
        page: "var(--rezics-motion-page)",
      },
      transitionTimingFunction: {
        out: "var(--rezics-ease-out)",
        "in-out": "var(--rezics-ease-in-out)",
        spring: "var(--rezics-ease-spring)",
      },
      boxShadow: {
        none: "none",
        sm: "var(--rezics-shadow-1)",
        md: "var(--rezics-shadow-2)",
        lg: "var(--rezics-shadow-3)",
        modal: "var(--rezics-shadow-modal)",
      },
      colors: {
        // shadcn/ui tokens — overrides unocss-preset-shadcn's `oklch(var(--foo))`
        // wrapper so utilities consume the variables (which now hold full
        // `oklch(...)` values) directly. Matches the latest shadcn CLI output.
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        // primary/secondary merge shadcn's DEFAULT/foreground with the
        // legacy MUI palette references kept for backward compatibility.
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          main: "var(--rezics-color-brand-fill)",
          light: "var(--rezics-color-brand-fill-hover)",
          dark: "var(--rezics-color-brand-fill-active)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
          main: "var(--rezics-color-info-fill)",
          light: "var(--rezics-color-info-text)",
          dark: "var(--rezics-color-info-text)",
        },
        // Foundation v1 tokens — bg-brand, text-text, border-whisper, etc.
        brand: {
          DEFAULT: "var(--rezics-color-brand-fill)",
          fill: "var(--rezics-color-brand-fill)",
          hover: "var(--rezics-color-brand-fill-hover)",
          active: "var(--rezics-color-brand-fill-active)",
          text: "var(--rezics-color-text-brand)",
        },
        surface: {
          DEFAULT: "var(--rezics-color-surface-canvas)",
          canvas: "var(--rezics-color-surface-canvas)",
          base: "var(--rezics-color-surface-base)",
          elevated: "var(--rezics-color-surface-elevated)",
          subtle: "var(--rezics-color-surface-subtle)",
          sunken: "var(--rezics-color-surface-sunken)",
        },
        text: {
          DEFAULT: "var(--rezics-color-text-primary)",
          primary: "var(--rezics-color-text-primary)",
          secondary: "var(--rezics-color-text-secondary)",
          tertiary: "var(--rezics-color-text-tertiary)",
          disabled: "var(--rezics-color-text-disabled)",
          "on-brand": "var(--rezics-color-text-on-brand)",
          brand: "var(--rezics-color-text-brand)",
        },
        success: {
          DEFAULT: "var(--rezics-color-success-fill)",
          fill: "var(--rezics-color-success-fill)",
          text: "var(--rezics-color-success-text)",
        },
        warning: {
          DEFAULT: "var(--rezics-color-warning-fill)",
          fill: "var(--rezics-color-warning-fill)",
          text: "var(--rezics-color-warning-text)",
        },
        error: {
          DEFAULT: "var(--rezics-color-error-fill)",
          fill: "var(--rezics-color-error-fill)",
          text: "var(--rezics-color-error-text)",
        },
        info: {
          DEFAULT: "var(--rezics-color-info-fill)",
          fill: "var(--rezics-color-info-fill)",
          text: "var(--rezics-color-info-text)",
        },
        border: {
          DEFAULT: "var(--rezics-color-border-whisper)",
          whisper: "var(--rezics-color-border-whisper)",
          defined: "var(--rezics-color-border-defined)",
          strong: "var(--rezics-color-border-strong)",
          focus: "var(--rezics-color-border-focus)",
          error: "var(--rezics-color-border-error)",
        },
      },
    },
  });
}
