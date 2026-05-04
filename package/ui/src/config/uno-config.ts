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
      // State-layer overlays — quiet rectangular tint per the rezics borderless
      // aesthetic (no MD3 ripple). Apply to elements that own `relative` and an
      // `on-*` foreground; the overlay uses `currentColor` so contrast tracks
      // the element's text color in either mode.
      "state-hover":
        "before:content-[''] before:absolute before:inset-0 before:bg-current before:opacity-0 before:pointer-events-none hover:before:opacity-[var(--rezics-sys-state-hover-opacity)] before:transition-opacity",
      "state-focus":
        "before:content-[''] before:absolute before:inset-0 before:bg-current before:opacity-0 before:pointer-events-none focus-visible:before:opacity-[var(--rezics-sys-state-focus-opacity)] before:transition-opacity",
      "state-pressed":
        "before:content-[''] before:absolute before:inset-0 before:bg-current before:opacity-0 before:pointer-events-none active:before:opacity-[var(--rezics-sys-state-pressed-opacity)] before:transition-opacity",
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
        "8xl": "1440px",
      },
      // rezics design tokens — resolve to CSS variables defined in
      // `package/ui/src/config/tokens.css`. Utilities auto-switch with
      // [data-theme="dark"] under `.theme-rezics`. See foundation v1 brief.
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
        // Legacy rezics names — alias into the MD3 ladder via the CSS var chain.
        fast: "var(--rezics-motion-fast)",
        base: "var(--rezics-motion-base)",
        slow: "var(--rezics-motion-slow)",
        page: "var(--rezics-motion-page)",
        // MD3 16-step ladder (50ms–1000ms) — short / medium / long / extra-long.
        short1: "var(--rezics-sys-motion-duration-short1)",
        short2: "var(--rezics-sys-motion-duration-short2)",
        short3: "var(--rezics-sys-motion-duration-short3)",
        short4: "var(--rezics-sys-motion-duration-short4)",
        medium1: "var(--rezics-sys-motion-duration-medium1)",
        medium2: "var(--rezics-sys-motion-duration-medium2)",
        medium3: "var(--rezics-sys-motion-duration-medium3)",
        medium4: "var(--rezics-sys-motion-duration-medium4)",
        long1: "var(--rezics-sys-motion-duration-long1)",
        long2: "var(--rezics-sys-motion-duration-long2)",
        long3: "var(--rezics-sys-motion-duration-long3)",
        long4: "var(--rezics-sys-motion-duration-long4)",
        "extra-long1": "var(--rezics-sys-motion-duration-extra-long1)",
        "extra-long2": "var(--rezics-sys-motion-duration-extra-long2)",
        "extra-long3": "var(--rezics-sys-motion-duration-extra-long3)",
        "extra-long4": "var(--rezics-sys-motion-duration-extra-long4)",
      },
      transitionTimingFunction: {
        // Legacy rezics names — aliased into the MD3 set via the CSS var chain.
        out: "var(--rezics-ease-out)",
        "in-out": "var(--rezics-ease-in-out)",
        spring: "var(--rezics-ease-spring)",
        // MD3 easing set + rezics spring.
        linear: "var(--rezics-sys-motion-easing-linear)",
        standard: "var(--rezics-sys-motion-easing-standard)",
        "standard-decelerate": "var(--rezics-sys-motion-easing-standard-decelerate)",
        "standard-accelerate": "var(--rezics-sys-motion-easing-standard-accelerate)",
        emphasized: "var(--rezics-sys-motion-easing-emphasized)",
        "emphasized-decelerate": "var(--rezics-sys-motion-easing-emphasized-decelerate)",
        "emphasized-accelerate": "var(--rezics-sys-motion-easing-emphasized-accelerate)",
      },
      boxShadow: {
        none: "none",
        sm: "var(--rezics-shadow-1)",
        md: "var(--rezics-shadow-2)",
        lg: "var(--rezics-shadow-3)",
        modal: "var(--rezics-shadow-modal)",
      },
      // Theme.colors taxonomy mirrors the role taxonomy in tokens.css:
      //   shadcn-superset slots → surface family → text family → brand family
      //   → secondary / tertiary → semantic states → sentiment → lines →
      //   inverse → chart → sidebar.
      colors: {
        // ============================================================
        // shadcn-superset slots — overrides unocss-preset-shadcn's
        // `oklch(var(--foo))` wrapper so utilities consume the variables
        // (which now hold full `oklch(...)` or hex values) directly.
        // ============================================================
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
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },

        // ============================================================
        // surface family — parchment ladder + MD3 surface-container ladder
        // ============================================================
        surface: {
          DEFAULT: "var(--rezics-sys-color-surface-canvas)",
          canvas: "var(--rezics-sys-color-surface-canvas)",
          base: "var(--rezics-sys-color-surface-base)",
          elevated: "var(--rezics-sys-color-surface-elevated)",
          subtle: "var(--rezics-sys-color-surface-subtle)",
          sunken: "var(--rezics-sys-color-surface-sunken)",
          variant: "var(--rezics-sys-color-surface-variant)",
          "container-lowest": "var(--rezics-sys-color-surface-container-lowest)",
          "container-low": "var(--rezics-sys-color-surface-container-low)",
          container: "var(--rezics-sys-color-surface-container)",
          "container-high": "var(--rezics-sys-color-surface-container-high)",
          "container-highest": "var(--rezics-sys-color-surface-container-highest)",
          tint: "var(--rezics-sys-color-surface-tint)",
        },
        "on-background": "var(--rezics-sys-color-on-background)",
        "on-surface": "var(--rezics-sys-color-on-surface)",
        "on-surface-variant": "var(--rezics-sys-color-on-surface-variant)",

        // ============================================================
        // text family
        // ============================================================
        text: {
          DEFAULT: "var(--rezics-sys-color-text-primary)",
          primary: "var(--rezics-sys-color-text-primary)",
          secondary: "var(--rezics-sys-color-text-secondary)",
          tertiary: "var(--rezics-sys-color-text-tertiary)",
          disabled: "var(--rezics-sys-color-text-disabled)",
          "on-brand": "var(--rezics-sys-color-text-on-brand)",
          brand: "var(--rezics-sys-color-text-brand)",
        },

        // ============================================================
        // brand family — fill / hover / active + container variant
        // ============================================================
        brand: {
          DEFAULT: "var(--rezics-sys-color-brand-fill)",
          fill: "var(--rezics-sys-color-brand-fill)",
          hover: "var(--rezics-sys-color-brand-fill-hover)",
          active: "var(--rezics-sys-color-brand-fill-active)",
          text: "var(--rezics-sys-color-text-brand)",
          container: "var(--rezics-sys-color-primary-container)",
          "on-container": "var(--rezics-sys-color-on-primary-container)",
        },
        "primary-container": "var(--rezics-sys-color-primary-container)",
        "on-primary": "var(--rezics-sys-color-on-primary)",
        "on-primary-container": "var(--rezics-sys-color-on-primary-container)",

        // ============================================================
        // secondary / tertiary container variants
        // ============================================================
        "secondary-container": "var(--rezics-sys-color-secondary-container)",
        "on-secondary": "var(--rezics-sys-color-on-secondary)",
        "on-secondary-container": "var(--rezics-sys-color-on-secondary-container)",
        tertiary: {
          DEFAULT: "var(--rezics-sys-color-tertiary)",
          container: "var(--rezics-sys-color-tertiary-container)",
        },
        "on-tertiary": "var(--rezics-sys-color-on-tertiary)",
        "on-tertiary-container": "var(--rezics-sys-color-on-tertiary-container)",

        // ============================================================
        // semantic states (success / warning / error / info) + containers
        // ============================================================
        success: {
          DEFAULT: "var(--rezics-sys-color-success-fill)",
          fill: "var(--rezics-sys-color-success-fill)",
          text: "var(--rezics-sys-color-success-text)",
          container: "var(--rezics-sys-color-success-container)",
          "on-container": "var(--rezics-sys-color-on-success-container)",
        },
        warning: {
          DEFAULT: "var(--rezics-sys-color-warning-fill)",
          fill: "var(--rezics-sys-color-warning-fill)",
          text: "var(--rezics-sys-color-warning-text)",
          container: "var(--rezics-sys-color-warning-container)",
          "on-container": "var(--rezics-sys-color-on-warning-container)",
        },
        error: {
          DEFAULT: "var(--rezics-sys-color-error-fill)",
          fill: "var(--rezics-sys-color-error-fill)",
          text: "var(--rezics-sys-color-error-text)",
          container: "var(--rezics-sys-color-error-container)",
          "on-container": "var(--rezics-sys-color-on-error-container)",
        },
        info: {
          DEFAULT: "var(--rezics-sys-color-info-fill)",
          fill: "var(--rezics-sys-color-info-fill)",
          text: "var(--rezics-sys-color-info-text)",
          container: "var(--rezics-sys-color-info-container)",
          "on-container": "var(--rezics-sys-color-on-info-container)",
        },

        // ============================================================
        // sentiment polarity (vote / rating / poll)
        // ============================================================
        sentiment: {
          "positive-fill": "var(--rezics-sys-color-sentiment-positive-fill)",
          "positive-text": "var(--rezics-sys-color-sentiment-positive-text)",
          "negative-fill": "var(--rezics-sys-color-sentiment-negative-fill)",
          "negative-text": "var(--rezics-sys-color-sentiment-negative-text)",
        },

        // ============================================================
        // lines — outline / outline-variant / border family
        // ============================================================
        outline: {
          DEFAULT: "var(--rezics-sys-color-outline)",
          variant: "var(--rezics-sys-color-outline-variant)",
        },
        border: {
          DEFAULT: "var(--rezics-sys-color-border-whisper)",
          whisper: "var(--rezics-sys-color-border-whisper)",
          defined: "var(--rezics-sys-color-border-defined)",
          strong: "var(--rezics-sys-color-border-strong)",
          focus: "var(--rezics-sys-color-border-focus)",
          error: "var(--rezics-sys-color-border-error)",
        },

        // ============================================================
        // inverse family — snackbars, pull-quotes, dark-on-light tiles
        // ============================================================
        inverse: {
          surface: "var(--rezics-sys-color-inverse-surface)",
          "on-surface": "var(--rezics-sys-color-inverse-on-surface)",
          primary: "var(--rezics-sys-color-inverse-primary)",
        },

        // ============================================================
        // charts — curated 5-step palette (shadcn slots alias to these)
        // ============================================================
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },

        // ============================================================
        // sidebar chrome — long-running navigation surfaces
        // ============================================================
        sidebar: {
          DEFAULT: "var(--sidebar)",
          background: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
    },
  });
}
