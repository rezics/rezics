/**
 * uno-config.ts — single consumption surface for rezics design tokens.
 *
 * `theme.colors` is set from `tokens/colors.ts` (`lightColors`). UnoCSS
 * preset-wind4 emits the matching `--colors-*` CSS custom properties under
 * `:root, :host` on demand. A preflight emits the `.dark { --colors-* }`
 * override from `darkColors`, plus the static auxiliary tokens (`--font-*`,
 * `--radius-*`, `--shadow-*`, `--duration-*`, `--easing-*`, state opacities)
 * that consumers reference directly.
 *
 * Authors SHALL consume tokens via the curated short names exposed by
 * `theme.colors` (`text-primary`, `bg-surface-elevated`, …). R9 in
 * `tool/scripts/check-convention.ts` bans any `var(--rezics-*)` reference in
 * source files; the namespace was retired by openspec change
 * `unify-tokens-single-source`.
 *
 * Spec: `openspec/specs/design-system-foundation/spec.md` and
 *       `openspec/specs/ui-component-foundation/spec.md`. Adding or removing
 *       a short name (or any auxiliary token) requires an OpenSpec change.
 */
import presetWind4 from "@unocss/preset-wind4";
import { container as defaultContainer } from "@unocss/preset-wind4/theme";
import transformerDirectives from "@unocss/transformer-directives";
import { defineConfig, presetAttributify, presetIcons } from "unocss";
import presetAnimations from "unocss-preset-animations";
import { presetScrollbarHide } from "unocss-preset-scrollbar-hide";
import { presetTailwind4Compat } from "./preset-tailwind4-compat";
import { darkColors, lightColors } from "./tokens/colors";

const FONT_SANS =
  "'Inter', 'rezics-sans', var(--font-sans-cjk, 'Source Han Sans TC'), system-ui, -apple-system, 'Segoe UI', sans-serif";
const FONT_SERIF =
  "'Source Serif 4', 'rezics-serif', var(--font-serif-cjk, 'Source Han Serif TC'), Georgia, serif";
const FONT_MONO =
  "'CaskaydiaMono Nerd Font', 'Cascadia Code', 'rezics-mono', 'Sarasa Mono TC', ui-monospace, 'SF Mono', Menlo, monospace";
const FONT_SANS_CJK = "'Source Han Sans TC', 'Noto Sans TC'";
const FONT_SERIF_CJK = "'Source Han Serif TC', 'Noto Serif TC'";

const RADIUS = {
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "24px",
  "4xl": "32px",
  pill: "9999px",
  full: "50%",
} as const;

// MD3 16-step duration ladder (50ms–1000ms).
const DURATION = {
  short1: "50ms",
  short2: "100ms",
  short3: "150ms",
  short4: "200ms",
  medium1: "250ms",
  medium2: "300ms",
  medium3: "350ms",
  medium4: "400ms",
  long1: "450ms",
  long2: "500ms",
  long3: "550ms",
  long4: "600ms",
  "extra-long1": "700ms",
  "extra-long2": "800ms",
  "extra-long3": "900ms",
  "extra-long4": "1000ms",
  // legacy rezics aliases mapped into the ladder.
  fast: "150ms",
  base: "250ms",
  slow: "400ms",
  page: "500ms",
} as const;

// MD3 easing set + rezics spring.
const EASING = {
  linear: "cubic-bezier(0, 0, 1, 1)",
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  "standard-decelerate": "cubic-bezier(0, 0, 0, 1)",
  "standard-accelerate": "cubic-bezier(0.3, 0, 1, 1)",
  emphasized: "cubic-bezier(0.2, 0, 0, 1)",
  "emphasized-decelerate": "cubic-bezier(0.05, 0.7, 0.1, 1)",
  "emphasized-accelerate": "cubic-bezier(0.3, 0, 0.8, 0.15)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  // legacy rezics aliases.
  out: "cubic-bezier(0, 0, 0, 1)",
  "in-out": "cubic-bezier(0.2, 0, 0, 1)",
} as const;

const SHADOW_LIGHT = {
  "1": "0 1px 2px rgba(0, 0, 0, 0.04)",
  "2": "0 2px 4px rgba(0, 0, 0, 0.04), 0 4px 8px rgba(0, 0, 0, 0.04)",
  "3": "0 4px 8px rgba(0, 0, 0, 0.04), 0 8px 16px rgba(0, 0, 0, 0.04), 0 16px 32px rgba(0, 0, 0, 0.06)",
  modal:
    "0 1px 2px rgba(0, 0, 0, 0.03), 0 4px 8px rgba(0, 0, 0, 0.04), 0 8px 16px rgba(0, 0, 0, 0.04), 0 16px 32px rgba(0, 0, 0, 0.06)",
} as const;

const SHADOW_DARK = {
  "1": "0 1px 2px rgba(0, 0, 0, 0.20)",
  "2": "0 2px 4px rgba(0, 0, 0, 0.20), 0 4px 8px rgba(0, 0, 0, 0.24)",
  "3": "0 4px 8px rgba(0, 0, 0, 0.24), 0 8px 16px rgba(0, 0, 0, 0.28), 0 16px 32px rgba(0, 0, 0, 0.36)",
  modal:
    "0 1px 2px rgba(0, 0, 0, 0.20), 0 4px 8px rgba(0, 0, 0, 0.28), 0 8px 16px rgba(0, 0, 0, 0.32), 0 16px 32px rgba(0, 0, 0, 0.40)",
} as const;

const STATE_OPACITY = {
  hover: 0.08,
  focus: 0.12,
  pressed: 0.12,
  dragged: 0.16,
} as const;

// Intrinsic density vocabulary. See
// `openspec/specs/design-system-density/spec.md`.
//
// These fixed-value component-tier tokens apply to rezics-authored repeating
// rows and chrome only. Vendored shadcn primitives stay on their own spacing;
// opt-out surfaces (hero, reading view, dialog content, marketing) use local
// spacing utilities.
//
// Luma calibration:
// - breadcrumb-y: keep 4px; Luma breadcrumb has text adjacency, not row padding.
// - menu-item-y: 8px; Luma menu/context/select items use py-2.
// - table-row-y: 12px; Luma table cells use p-3.
// - toolbar-y: keep 8px; rezics-authored chrome, no Luma row equivalent.
// - formfield-y: 4px; Luma Input uses py-1 inside h-9.
// - sidebar-item-y: keep 8px; sidebar.tsx is a Path-P exception.
// - tab-item-y: 4px; Luma horizontal TabsTrigger uses py-1.
// - command-item-y: 8px; Luma CommandItem uses py-2.
// - list-item-y: keep 12px; rezics composite, no Luma equivalent.
const PADDING_BASE = {
  "table-row-y": "12px",
  "list-item-y": "12px",
  "toolbar-y": "8px",
  "formfield-y": "4px",
  "sidebar-item-y": "8px",
  "tab-item-y": "4px",
  "menu-item-y": "8px",
  "breadcrumb-y": "4px",
  "command-item-y": "8px",
} as const;

function flattenColorVars(
  obj: Record<string, unknown>,
  parent = "colors",
  out: [string, string][] = [],
): [string, string][] {
  for (const [key, value] of Object.entries(obj)) {
    const path = key === "DEFAULT" ? parent : `${parent}-${key}`;
    if (typeof value === "string") {
      out.push([`--${path}`, value]);
    } else if (value && typeof value === "object") {
      flattenColorVars(value as Record<string, unknown>, path, out);
    }
  }
  return out;
}

function indentedDeclarations(
  pairs: ReadonlyArray<readonly [string, string | number]>,
): string {
  return pairs.map(([k, v]) => `  ${k}: ${v};`).join("\n");
}

function emitLightColors(): string {
  const lines = indentedDeclarations(
    flattenColorVars(lightColors as unknown as Record<string, unknown>),
  );
  return `:root, :host {\n${lines}\n}`;
}

function emitDarkOverride(): string {
  const lines = indentedDeclarations(
    flattenColorVars(darkColors as unknown as Record<string, unknown>),
  );
  const shadowLines = indentedDeclarations(
    Object.entries(SHADOW_DARK).map(([k, v]) => [`--shadow-${k}`, v] as const),
  );
  return `.dark {\n${lines}\n${shadowLines}\n}`;
}

function emitStaticTokens(): string {
  const fontPairs: Array<[string, string]> = [
    ["--font-sans", FONT_SANS],
    ["--font-serif", FONT_SERIF],
    ["--font-mono", FONT_MONO],
    ["--font-sans-cjk", FONT_SANS_CJK],
    ["--font-serif-cjk", FONT_SERIF_CJK],
  ];
  const radiusPairs = Object.entries(RADIUS).map(
    ([k, v]) => [`--radius-${k}`, v] as [string, string],
  );
  const shadowPairs = Object.entries(SHADOW_LIGHT).map(
    ([k, v]) => [`--shadow-${k}`, v] as [string, string],
  );
  const durationPairs = Object.entries(DURATION).map(
    ([k, v]) => [`--duration-${k}`, v] as [string, string],
  );
  const easingPairs = Object.entries(EASING).map(
    ([k, v]) => [`--easing-${k}`, v] as [string, string],
  );
  const opacityPairs: Array<[string, string]> = Object.entries(
    STATE_OPACITY,
  ).map(([k, v]) => [`--state-${k}-opacity`, String(v)]);
  const paddingPairs: Array<[string, string]> = Object.entries(
    PADDING_BASE,
  ).map(([k, v]) => [`--padding-${k}`, v]);

  const all = [
    ...fontPairs,
    ...radiusPairs,
    ...shadowPairs,
    ...durationPairs,
    ...easingPairs,
    ...opacityPairs,
    ...paddingPairs,
  ];
  return `:root, :host {\n${indentedDeclarations(all)}\n}`;
}

const ACCORDION_COLLAPSIBLE_KEYFRAMES = `
@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}
@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}
@keyframes collapsible-down {
  from { height: 0; }
  to { height: var(--radix-collapsible-content-height); }
}
@keyframes collapsible-up {
  from { height: var(--radix-collapsible-content-height); }
  to { height: 0; }
}
`.trim();

export function createUnoConfig() {
  return defineConfig({
    presets: [
      presetWind4({ preflights: { reset: true } }),
      presetTailwind4Compat(),
      presetAnimations(),
      presetIcons(),
      presetAttributify({
        prefix: "un-",
        prefixedOnly: true,
      }), // support <div un-text="red-500">
      presetScrollbarHide(),
    ],
    transformers: [transformerDirectives()],
    preflights: [
      {
        layer: "theme",
        getCSS: () => emitStaticTokens(),
      },
      {
        layer: "theme",
        getCSS: () => emitLightColors(),
      },
      {
        layer: "theme",
        getCSS: () => emitDarkOverride(),
      },
      {
        layer: "theme",
        getCSS: () => ACCORDION_COLLAPSIBLE_KEYFRAMES,
      },
    ],
    shortcuts: {
      // State-layer overlays — quiet rectangular tint per the rezics borderless
      // aesthetic (no MD3 ripple). Apply to elements that own `relative` and an
      // `on-*` foreground; the overlay uses `currentColor` so contrast tracks
      // the element's text color in either mode.
      "state-hover":
        "before:content-[''] before:absolute before:inset-0 before:bg-current before:opacity-0 before:pointer-events-none hover:before:opacity-[var(--state-hover-opacity)] before:transition-opacity",
      "state-focus":
        "before:content-[''] before:absolute before:inset-0 before:bg-current before:opacity-0 before:pointer-events-none focus-visible:before:opacity-[var(--state-focus-opacity)] before:transition-opacity",
      "state-pressed":
        "before:content-[''] before:absolute before:inset-0 before:bg-current before:opacity-0 before:pointer-events-none active:before:opacity-[var(--state-pressed-opacity)] before:transition-opacity",
    },
    theme: {
      breakpoint: {
        xs: "0px",
        xsm: "450px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
      container: {
        ...defaultContainer,
        xs: "450px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
        "8xl": "1440px",
      },
      borderRadius: {
        none: "0",
        xs: RADIUS.xs,
        sm: RADIUS.sm,
        md: RADIUS.md,
        DEFAULT: RADIUS.md,
        lg: RADIUS.lg,
        xl: RADIUS.xl,
        "2xl": RADIUS["2xl"],
        "4xl": RADIUS["4xl"],
        pill: RADIUS.pill,
        full: RADIUS.full,
      },
      fontFamily: {
        sans: FONT_SANS,
        serif: FONT_SERIF,
        mono: FONT_MONO,
      },
      transitionDuration: {
        ...DURATION,
      },
      transitionTimingFunction: {
        ...EASING,
      },
      boxShadow: {
        none: "none",
        sm: SHADOW_LIGHT["1"],
        md: SHADOW_LIGHT["2"],
        lg: SHADOW_LIGHT["3"],
        modal: SHADOW_LIGHT.modal,
      },
      animation: {
        keyframes: {
          "accordion-down":
            "{ from { height: 0; } to { height: var(--radix-accordion-content-height); } }",
          "accordion-up":
            "{ from { height: var(--radix-accordion-content-height); } to { height: 0; } }",
          "collapsible-down":
            "{ from { height: 0; } to { height: var(--radix-collapsible-content-height); } }",
          "collapsible-up":
            "{ from { height: var(--radix-collapsible-content-height); } to { height: 0; } }",
        },
        durations: {
          "accordion-down": "200ms",
          "accordion-up": "200ms",
          "collapsible-down": "200ms",
          "collapsible-up": "200ms",
        },
        timingFns: {
          "accordion-down": EASING["standard-decelerate"],
          "accordion-up": EASING["standard-decelerate"],
          "collapsible-down": EASING["standard-decelerate"],
          "collapsible-up": EASING["standard-decelerate"],
        },
      },
      // The shadcn 32 + rezics extensions live here as a single, unified shape.
      // wind4 emits each leaf as a flat `--colors-<path>` custom property under
      // `:root, :host`; the dark override is emitted by the preflight above.
      colors: lightColors as unknown as Record<string, unknown>,
    },
  });
}
