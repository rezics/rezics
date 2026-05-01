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
    shortcuts: {
      "horizontal-book-carousel":
        "pl-4 !basis-1/3 xsm:!basis-1/4 sm:!basis-1/5 md:!basis-1/6 lg:!basis-1/7 xl:!basis-1/8",
    },
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
      },
      // rezics design tokens — resolve to CSS variables defined in shared/styles/layers.css
      // so utilities auto-switch with [data-theme="dark"]. See foundation v1 brief.
      spacing: {
        "0": "0",
        px: "1px",
        "0.5": "var(--rzc-space-0_5)",
        "1": "var(--rzc-space-1)",
        "2": "var(--rzc-space-2)",
        "3": "var(--rzc-space-3)",
        "4": "var(--rzc-space-4)",
        "5": "var(--rzc-space-5)",
        "6": "var(--rzc-space-6)",
        "8": "var(--rzc-space-8)",
        "10": "var(--rzc-space-10)",
        "12": "var(--rzc-space-12)",
        "16": "var(--rzc-space-16)",
      },
      borderRadius: {
        none: "0",
        xs: "var(--rzc-radius-xs)",
        sm: "var(--rzc-radius-sm)",
        md: "var(--rzc-radius-md)",
        DEFAULT: "var(--rzc-radius-md)",
        lg: "var(--rzc-radius-lg)",
        xl: "var(--rzc-radius-xl)",
        "2xl": "var(--rzc-radius-2xl)",
        pill: "var(--rzc-radius-pill)",
        full: "var(--rzc-radius-full)",
      },
      fontFamily: {
        sans: "var(--rzc-font-sans)",
        serif: "var(--rzc-font-serif)",
        mono: "var(--rzc-font-mono)",
      },
      transitionDuration: {
        fast: "var(--rzc-motion-fast)",
        base: "var(--rzc-motion-base)",
        slow: "var(--rzc-motion-slow)",
        page: "var(--rzc-motion-page)",
      },
      transitionTimingFunction: {
        out: "var(--rzc-ease-out)",
        "in-out": "var(--rzc-ease-in-out)",
        spring: "var(--rzc-ease-spring)",
      },
      boxShadow: {
        none: "none",
        sm: "var(--rzc-shadow-1)",
        md: "var(--rzc-shadow-2)",
        lg: "var(--rzc-shadow-3)",
        modal: "var(--rzc-shadow-modal)",
      },
      colors: {
        // Legacy MUI palette references — kept for backward compatibility.
        primary: {
          main: "var(--mui-palette-primary-main)",
          light: "var(--mui-palette-primary-light)",
          dark: "var(--mui-palette-primary-dark)",
        },
        secondary: {
          main: "var(--mui-palette-secondary-main)",
          light: "var(--mui-palette-secondary-light)",
          dark: "var(--mui-palette-secondary-dark)",
        },
        // Foundation v1 tokens — bg-brand, text-text, border-whisper, etc.
        brand: {
          DEFAULT: "var(--rzc-color-brand-fill)",
          fill: "var(--rzc-color-brand-fill)",
          hover: "var(--rzc-color-brand-fill-hover)",
          active: "var(--rzc-color-brand-fill-active)",
          text: "var(--rzc-color-text-brand)",
        },
        surface: {
          DEFAULT: "var(--rzc-color-surface-canvas)",
          canvas: "var(--rzc-color-surface-canvas)",
          base: "var(--rzc-color-surface-base)",
          elevated: "var(--rzc-color-surface-elevated)",
          subtle: "var(--rzc-color-surface-subtle)",
          sunken: "var(--rzc-color-surface-sunken)",
        },
        text: {
          DEFAULT: "var(--rzc-color-text-primary)",
          primary: "var(--rzc-color-text-primary)",
          secondary: "var(--rzc-color-text-secondary)",
          tertiary: "var(--rzc-color-text-tertiary)",
          disabled: "var(--rzc-color-text-disabled)",
          "on-brand": "var(--rzc-color-text-on-brand)",
          brand: "var(--rzc-color-text-brand)",
        },
        success: {
          DEFAULT: "var(--rzc-color-success-fill)",
          fill: "var(--rzc-color-success-fill)",
          text: "var(--rzc-color-success-text)",
        },
        warning: {
          DEFAULT: "var(--rzc-color-warning-fill)",
          fill: "var(--rzc-color-warning-fill)",
          text: "var(--rzc-color-warning-text)",
        },
        error: {
          DEFAULT: "var(--rzc-color-error-fill)",
          fill: "var(--rzc-color-error-fill)",
          text: "var(--rzc-color-error-text)",
        },
        info: {
          DEFAULT: "var(--rzc-color-info-fill)",
          fill: "var(--rzc-color-info-fill)",
          text: "var(--rzc-color-info-text)",
        },
        border: {
          DEFAULT: "var(--rzc-color-border-whisper)",
          whisper: "var(--rzc-color-border-whisper)",
          defined: "var(--rzc-color-border-defined)",
          strong: "var(--rzc-color-border-strong)",
          focus: "var(--rzc-color-border-focus)",
          error: "var(--rzc-color-border-error)",
        },
      },
    },
  });
}
