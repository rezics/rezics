# Token Reference — Foundation v1

**Single source of truth**: `package/ui/src/config/tokens/*.ts`. UnoCSS (`theme.spacing` / `theme.fontFamily` / etc.) consumes the TS objects directly via its native API.

**Two surfaces** depending on whether the token needs to switch with theme:

| Category | Where it lives | How to consume |
| --- | --- | --- |
| **Colors** (surface, text, brand, semantic, sentiment, border) | TS source + flat `--colors-*` CSS var emitted by `uno-config.ts` preflights | UnoCSS utility (`bg-brand-fill`, `text-text-primary`) |
| **Shadows** | TS source + `--rezics-shadow-*` CSS var (light/dark variants in `layers.css`) | UnoCSS utility (`shadow-md`) |
| **Spacing / radius / motion / font** | TS source ONLY — UnoCSS auto-emits `--spacing-*`/`--radius-*` etc. through preset-wind4's theme system | UnoCSS utility (`p-4`, `rounded-md`, `duration-fast`, `font-sans`) |

**Hard rule — never hand-write `var(--rezics-space-*)`, `var(--rezics-radius-*)`, `var(--rezics-motion-*)`, `var(--rezics-ease-*)`, `var(--rezics-font-sans/serif/mono)` — they don't exist.** Use the utility class or import the token from `@rezics/ui/config/tokens/*` directly. The only `--rezics-*` vars that exist are colors, shadows, and the per-`:lang()` CJK font fallback (`--rezics-font-sans-cjk`, `--rezics-font-serif-cjk`).

---

## Color — surfaces

| Token              | Light      | Dark       | UnoCSS         | CSS var                          | When                                  |
| ------------------ | ---------- | ---------- | -------------- | -------------------------------- | ------------------------------------- |
| `surface-canvas`   | `#f5f4ed`  | `#1a1a18`  | `bg-surface-canvas`   | `--colors-surface-canvas`     | Page background. Default body.        |
| `surface-base`     | `#faf9f5`  | `#26251e`  | `bg-surface-base` | `--colors-surface-base`    | Default raised surface (cards).       |
| `surface-elevated` | `#ffffff`  | `#30302e`  | `bg-surface-elevated` | `--colors-surface-elevated` | Modals, popovers, command palette. |
| `surface-subtle`   | `#ebeae5`  | `#1f1e1c`  | `bg-surface-subtle` | `--colors-surface-subtle`  | Code blocks, table zebra, chip bg.    |
| `surface-sunken`   | `#e6e5e0`  | `#141413`  | `bg-surface-sunken` | `--colors-surface-sunken`  | Inset panels (rare).                  |

## Color — text

| Token            | Light       | Dark      | UnoCSS              | CSS var                     | When                                |
| ---------------- | ----------- | --------- | ------------------- | --------------------------- | ----------------------------------- |
| `text-primary`   | `#1d1d1f`   | `#f0eee6` | `text-text-primary` | `--colors-text-primary`  | Body, headings. AAA on canvas.      |
| `text-secondary` | `#6e6e73`   | `#a39e98` | `text-text-secondary` | `--colors-text-secondary` | Secondary copy, captions.        |
| `text-tertiary`  | `#86868b`   | `#6e6c66` | `text-text-tertiary` | `--colors-text-tertiary` | Metadata, ≥18px only (AA-large). |
| `text-disabled`  | `#c7c7cc`   | `#48484a` | `text-text-disabled` | `--colors-text-disabled` | Decorative disabled labels only. |
| `text-on-brand`  | `#ffffff`   | `#ffffff` | `text-text-on-brand` | `--colors-text-on-brand` | White on `brand-fill` button (AA-large only — use ≥14px medium / ≥16px regular). |
| `text-brand`     | `#C4433A`   | `#fa7882` | `text-text-brand`   | `--colors-text-brand`    | Brand-color text. **Use this, never `brand-fill` as text.** |

## Color — brand

Brand fill is **mode-invariant**: `#f4606c` in both light and dark.

| Token               | Value      | UnoCSS         | CSS var                          | When                                              |
| ------------------- | ---------- | -------------- | -------------------------------- | ------------------------------------------------- |
| `brand-fill`        | `#f4606c`  | `bg-brand-fill`     | `--colors-brand-fill`         | Button bg, badge fill, focus ring, icon fill.    |
| `brand-fill-hover`  | `#e85666`  | `bg-brand-fill-hover` | `--colors-brand-fill-hover` | Button `:hover`.                                  |
| `brand-fill-active` | `#d94c5c`  | `bg-brand-fill-active` | `--colors-brand-fill-active` | Button `:active` / pressed.                  |
| `text-brand`        | (see text) | `text-text-brand` | `--colors-text-brand`     | The ONLY brand-text token (above).               |

**Hard rule**: `#f4606c` on parchment is 2.83:1 — fails AA-body (4.5:1), fails AA-large (3:1). Never use `brand-fill` (or its hex) as a text color.

## Color — semantic

Each semantic has `*-fill` (UI element, 3:1) and `*-text` (AA-body, mode-aware).

| Semantic   | `*-fill`  | `*-text` light | `*-text` dark | UnoCSS class       | When                              |
| ---------- | --------- | -------------- | ------------- | ------------------ | --------------------------------- |
| `success`  | `#1f8a65` | `#157352`      | `#3da884`     | `bg-success` / `text-success-text` | Confirmations, completed status. |
| `warning`  | `#b8732e` | `#8a5520`      | `#d8943e`     | `bg-warning` / `text-warning-text` | Cautions, soft warnings.         |
| `error`    | `#cf2d56` | `#cf2d56`      | `#e34c75`     | `bg-error` / `text-error-text`     | Form errors, destructive states. |
| `info`     | `#3898ec` | `#1565c0`      | `#5aa9f0`     | `bg-info` / `text-info-text`       | Informational notices.           |

**Rule**: `*-fill` for icon-only or filled badges; `*-text` for any colored text. Mixing is a contrast bug.

## Color — borders

| Token            | Light                    | Dark                       | UnoCSS         | When                                |
| ---------------- | ------------------------ | -------------------------- | -------------- | ----------------------------------- |
| `border-whisper` | `rgba(0,0,0,0.08)`       | `rgba(255,255,255,0.10)`   | `border-border-whisper` | Default surface containment.       |
| `border-defined` | `#d2d2d7`                | `#3a3937`                  | `border-border-defined` | Stronger boundary (admin tables). |
| `border-strong`  | `#86868b`                | `#5a5856`                  | `border-border-strong`  | Maximum visibility (rare).         |
| `border-focus`   | `#f4606c`                | `#fa7882`                  | `border-border-focus`   | `:focus-visible` ring (brand).    |
| `border-error`   | `#cf2d56`                | `#e34c75`                  | `border-border-error`   | Form validation error.            |

**Focus ring spec**: `outline: 2px solid var(--colors-border-focus); outline-offset: 2px;`

---

## Spacing

UnoCSS / preset-wind4 follows Tailwind v4's `N × 4px` model (`p-2 = 8px`, `p-4 = 16px`, `p-12 = 48px`). The full step list:

| Pixels | UnoCSS class | When                                |
| ------ | ------------ | ----------------------------------- |
| 0      | `p-0`        | —                                   |
| 1px    | `p-px`       | Hairline borders.                   |
| 2px    | `p-0.5`      | Micro-gaps.                         |
| 4px    | `p-1`        | Compact icon margin.                |
| 8px    | `p-2`        | **Base padding.** Default gap.      |
| 12px   | `p-3`        | Input vertical padding.             |
| 16px   | `p-4`        | Card padding, default content gap.  |
| 24px   | `p-6`        | Section internal padding.           |
| 32px   | `p-8`        | Section divider rhythm.             |
| 48px   | `p-12`       | **Between sections (app default).** |
| 64px   | `p-16`       | Page-level vertical rhythm.         |
| 96px   | `p-24`       | Chapter-level breathing.            |
| 128px  | `p-32`       | Hero / landing extra.               |

**Section rhythm**: app uses `p-12`–`p-24` (48–96px); admin/editor use `p-4`–`p-6` (16–24px).

---

## Radius

| Token         | Value  | UnoCSS class   | When                                          |
| ------------- | ------ | -------------- | --------------------------------------------- |
| `radius-xs`   | 4px    | `rounded-xs`   | Inline tags, code chips.                      |
| `radius-sm`   | 6px    | `rounded-sm`   | Inputs, dense buttons.                        |
| `radius-md`   | 8px    | `rounded-md` / `rounded` | **Default.** Buttons, chips, small cards. |
| `radius-lg`   | 12px   | `rounded-lg`   | Cards, surfaces.                              |
| `radius-xl`   | 16px   | `rounded-xl`   | Modals, large cards.                          |
| `radius-2xl`  | 24px   | `rounded-2xl`  | Hero blocks, feature cards.                   |
| `radius-pill` | 9999px | `rounded-pill` | Tags, status pills, hero CTAs.                |
| `radius-full` | 50%    | `rounded-full` | Avatars, circular icon buttons.               |

`radius-md` (8px) is the system default. Override per component slot when needed, don't change the default.

---

## Motion

| Token         | Value  | UnoCSS                | When                            |
| ------------- | ------ | --------------------- | ------------------------------- |
| `motion-fast` | 120ms  | `duration-fast`       | Press feedback, scale on tap.   |
| `motion-base` | 200ms  | `duration-base`       | Hover transitions, color shifts. |
| `motion-slow` | 350ms  | `duration-slow`       | Layout shifts, panel open/close. |
| `motion-page` | 500ms  | `duration-page`       | Route transitions.              |

| Easing token  | Value                              | UnoCSS class        | When                            |
| ------------- | ---------------------------------- | ------------------- | ------------------------------- |
| `ease-out`    | `cubic-bezier(0, 0, 0.2, 1)`       | `ease-out`          | Default for entries.            |
| `ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)`     | `ease-in-out`       | State changes.                  |
| `ease-spring` | `cubic-bezier(0.4, 1.4, 0.5, 1)`   | `ease-spring`       | Reserved for delight (rare).    |

**Press feedback** (notion pattern): buttons get `transform: scale(0.98)` on `:active` with `duration-fast`. Reset to `scale(1)` resting.

**Reduced motion**: `prefers-reduced-motion: reduce` already collapses all durations to 0ms globally (in `layers.css`). Don't add per-component overrides for this.

---

## Elevation (shadows) — borderless default

| Token                  | UnoCSS         | When                                   |
| ---------------------- | -------------- | -------------------------------------- |
| (no shadow)            | `shadow-none`  | **Default for everything** — sections, cards, panels, table rows, navs. |
| `shadow-1`             | `shadow-sm`    | Reserved.                              |
| `shadow-2`             | `shadow-md`    | Reserved.                              |
| `shadow-3`             | `shadow-lg`    | Reserved.                              |
| `shadow-modal`         | `shadow-modal` | **Modal-tier only**: `<Dialog>`, command palette, context menus, popovers over chapters. |

**Hard rule**: cards, sections, tables, navs **never** get a shadow. If you're tempted to add one, use whitespace or `border-whisper` instead.

In dark mode, shadow opacities scale up (0.20–0.40) to remain visible against dark canvas. Already automatic.

---

## Typography

### Families

| Token         | Latin                   | CJK (TC default)         | UnoCSS class | When                          |
| ------------- | ----------------------- | ------------------------ | ------------ | ----------------------------- |
| `font-sans`   | Inter Variable          | Source Han Sans          | `font-sans`  | All UI, default body.         |
| `font-mono`   | CaskaydiaMono Nerd Font | Sarasa Mono TC           | `font-mono`  | Code, IDs, hashes.            |
| `font-serif`  | Source Serif 4          | Source Han Serif         | `font-serif` | Reader (book content), 書評.  |

CJK regional routing (SC / JP / KR) is automatic via CSS `:lang()`. Don't override font-family per locale.

### Sizes (all `clamp()` viewport-responsive)

| Token       | Min  | Max  | UnoCSS class | When                       |
| ----------- | ---- | ---- | ------------ | -------------------------- |
| `text-xs`   | 12px | 13px | `text-xs`    | Captions, table cells.     |
| `text-sm`   | 13px | 14px | `text-sm`    | Dense UI body, form labels. |
| `text-base` | 14px | 16px | `text-base`  | Default UI body.           |
| `text-md`   | 16px | 18px | `text-md`    | Comfortable reading.       |
| `text-lg`   | 18px | 22px | `text-lg`    | Subsection headings.       |
| `text-xl`   | 22px | 28px | `text-xl`    | Section headings.          |
| `text-2xl`  | 28px | 36px | `text-2xl`   | Page titles.               |
| `text-3xl`  | 36px | 48px | `text-3xl`   | Hero / chapter titles.     |
| `text-reader` | 16px | 20px | `text-reader` | **Book content body** (special). |

### Weights

`400` regular / `500` medium / `600` semibold. **Avoid 700+** — it fights the editorial mood.

### Line-height (mandatory)

| Context             | Token            | Value | UnoCSS                |
| ------------------- | ---------------- | ----- | --------------------- |
| Reader / book body  | `leading-reader` | 1.60  | `leading-[1.6]`       |
| Article body        | `leading-body`   | 1.55  | `leading-[1.55]`      |
| UI labels, chrome   | `leading-ui`     | 1.40  | `leading-[1.4]`       |
| Dense tables, nav   | `leading-dense`  | 1.30  | `leading-[1.3]`       |

---

## Common mistakes

| Wrong                                           | Right                                            |
| ----------------------------------------------- | ------------------------------------------------ |
| `bg-[#f4606c]`                                  | `bg-brand-fill`                                  |
| `color: #f4606c` (text)                         | `text-text-brand` (uses `#C4433A` light)         |
| `bg-white`                                      | `bg-surface-elevated`                            |
| `bg-gray-100`                                   | `bg-surface-subtle`                              |
| `text-gray-500`                                 | `text-text-secondary`                            |
| `font-size: 14px`                               | `text-sm` (gets clamp scaling)                   |
| `border` (= `border-gray-200`)                  | `border-whisper` (tokenized)                     |
| `rounded-[8px]`                                 | `rounded-md`                                     |
| `transition-all duration-200`                   | `transition duration-base`                       |
| `font-bold` (700)                               | `font-medium` (500) — bold fights editorial mood |
| Emoji in button label                           | Lucide icon                                      |
