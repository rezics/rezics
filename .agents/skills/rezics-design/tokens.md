# Token Reference — Foundation v1

**Single source of truth**: `package/ui/src/config/tokens/*.ts`. UnoCSS (`theme.spacing` / `theme.fontFamily` / etc.) consumes the TS objects directly via its native API.

**Two surfaces** depending on whether the token needs to switch with theme:

| Category | Where it lives | How to consume |
| --- | --- | --- |
| **Colors** (surface, text, brand, semantic, sentiment, border) | TS source + flat `--colors-*` CSS var emitted by `uno-config.ts` preflights | UnoCSS utility (`bg-brand-fill`, `text-text-primary`) |
| **Shadows** | TS source + `--shadow-*` CSS var emitted by `uno-config.ts` | UnoCSS utility (`shadow-md`) |
| **Spacing / radius / motion / font** | TS source ONLY — UnoCSS auto-emits `--spacing-*`/`--radius-*` etc. through preset-wind4's theme system | UnoCSS utility (`p-4`, `rounded-md`, `duration-fast`, `font-sans`) |

**Hard rule — never hand-write `var(--rezics-*)`; the namespace is retired.**
Use the utility class or import the token from `@rezics/ui/config/tokens/*`
directly. Color CSS vars use the flat `--colors-*` namespace.

---

## Color — surfaces

| Token              | Light      | Dark       | UnoCSS         | CSS var                          | When                                  |
| ------------------ | ---------- | ---------- | -------------- | -------------------------------- | ------------------------------------- |
| `surface-canvas`   | `#ffffff`  | `#000000`  | `bg-surface-canvas`   | `--colors-surface-canvas`     | Page background. Default body.        |
| `surface-base`     | `#ffffff`  | `#0b0b0b`  | `bg-surface-base` | `--colors-surface-base`    | Panels, inline content blocks.       |
| `surface-elevated` | `#ffffff`  | `#161616`  | `bg-surface-elevated` | `--colors-surface-elevated` | Modals, popovers, command palette. |
| `surface-subtle`   | `#f5f5f5`  | `#202020`  | `bg-surface-subtle` | `--colors-surface-subtle`  | Code blocks, table zebra, chip bg.    |
| `surface-sunken`   | `#eeeeee`  | `#2a2a2a`  | `bg-surface-sunken` | `--colors-surface-sunken`  | Inset panels (rare).                  |

## Color — text

| Token            | Light       | Dark      | UnoCSS              | CSS var                     | When                                |
| ---------------- | ----------- | --------- | ------------------- | --------------------------- | ----------------------------------- |
| `text-primary`   | `#111111`   | `#f5f5f5` | `text-text-primary` | `--colors-text-primary`  | Body, headings, long-form content.      |
| `text-secondary` | `#5f6368`   | `#b6b6b6` | `text-text-secondary` | `--colors-text-secondary` | Secondary copy, captions.        |
| `text-tertiary`  | `#7a7a7a`   | `#8a8a8a` | `text-text-tertiary` | `--colors-text-tertiary` | Hints and low-emphasis metadata. |
| `text-disabled`  | `#b8b8b8`   | `#5c5c5c` | `text-text-disabled` | `--colors-text-disabled` | Decorative disabled labels only. |
| `text-on-brand`  | `#ffffff`   | `#ffffff` | `text-text-on-brand` | `--colors-text-on-brand` | Text on brand-filled controls. |
| `text-brand`     | `#DB515C`   | `#DB515C` | `text-text-brand`   | `--colors-text-brand`    | Short stable brand chrome: REZICS, hero labels, accents. |

## Color — brand

Brand fill is **mode-invariant**: `#DB515C` in both light and dark.

| Token               | Value      | UnoCSS         | CSS var                          | When                                              |
| ------------------- | ---------- | -------------- | -------------------------------- | ------------------------------------------------- |
| `brand-fill`        | `#DB515C`  | `bg-brand-fill`     | `--colors-brand-fill`         | Primary button bg, selected indicators, accent marks, logo fill.    |
| `brand-fill-hover`  | `#C94651`  | `bg-brand-fill-hover` | `--colors-brand-fill-hover` | Primary filled control `:hover`.                                  |
| `brand-fill-active` | `#B83F49`  | `bg-brand-fill-active` | `--colors-brand-fill-active` | Primary filled control `:active` / pressed.                  |
| `text-brand`        | (see text) | `text-text-brand` | `--colors-text-brand`     | The ONLY brand-text token (above).               |

**Reading rule**: contrast numbers are diagnostics, not a blanket veto. Brand red
is allowed in short, stable UI chrome and brand text, but long-form and
frequently changing content stays neutral.

## Color — link

Link blue is **mode-invariant**: `#1a73e8` in both light and dark.

| Token        | Value      | UnoCSS      | CSS var                 | When |
| ------------ | ---------- | ----------- | ----------------------- | ---- |
| `link`       | `#1a73e8`  | `text-link` | `--colors-link`         | Ordinary text links, URLs, metadata links, textual navigation. |
| `link-hover` | `#1a73e8`  | `text-link-hover` | `--colors-link-hover` | Same color; hover adds underline. |

## Color — semantic

Each semantic has `*-fill` (UI element, 3:1) and `*-text` (AA-body, mode-aware).

| Semantic   | `*-fill`  | `*-text` light | `*-text` dark | UnoCSS class       | When                              |
| ---------- | --------- | -------------- | ------------- | ------------------ | --------------------------------- |
| `success`  | `#157352` / `#3da884` | `#157352`      | `#3da884`     | `bg-success` / `text-success-text` | Confirmations, completed status. |
| `warning`  | `#9c5e22` / `#d8943e` | `#8a5520`      | `#d8943e`     | `bg-warning` / `text-warning-text` | Cautions, soft warnings.         |
| `error`    | `#cf2d56` | `#cf2d56`      | `#e34c75`     | `bg-error` / `text-error-text`     | Form errors, destructive states. |
| `info`     | `#1a73e8` | `#1a73e8`      | `#1a73e8`     | `bg-info` / `text-info-text`       | Informational notices.           |

**Rule**: `*-fill` for icon-only or filled badges; `*-text` for any colored text. Mixing is a contrast bug.

## Color — borders

| Token            | Light                    | Dark                       | UnoCSS         | When                                |
| ---------------- | ------------------------ | -------------------------- | -------------- | ----------------------------------- |
| `border-whisper` | `rgba(0,0,0,0.10)`       | `rgba(255,255,255,0.12)`   | `border-border-whisper` | Default surface containment.       |
| `border-defined` | `#d9d9d9`                | `#3a3a3a`                  | `border-border-defined` | Stronger boundary (admin tables). |
| `border-strong`  | `#8a8a8a`                | `#777777`                  | `border-border-strong`  | Maximum visibility (rare).         |
| `border-focus`   | `#DB515C`                | `#DB515C`                  | `border-border-focus`   | `:focus-visible` ring (brand).    |
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
| `radius-md`   | 8px    | `rounded-md` / `rounded` | **Default.** Buttons, chips, cards. |
| `radius-lg`   | 12px   | `rounded-lg`   | Popovers, contained controls, secondary surfaces. |
| `radius-xl`   | 16px   | `rounded-xl`   | Modals, large overlay surfaces.                          |
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
| (no shadow)            | `shadow-none`  | **Default for sections, panels, table rows, navs, and flat/contained cards.** |
| `shadow-1`             | `shadow-sm`    | shadcn `<Card surface="elevated">` for media-rich recommendation/article cards; sticky bars and micro hover lift. |
| `shadow-2`             | `shadow-md`    | Elevated interactive Card hover, floating action menus, and popovers when modal shadow is too heavy. |
| `shadow-3`             | `shadow-lg`    | Reserved for exceptional floating surfaces. |
| `shadow-modal`         | `shadow-modal` | **Modal-tier only**: `<Dialog>`, command palette, context menus, popovers over chapters. |

**Hard rule**: sections, tables, navs, and generic panels **never** get a shadow.
Cards may only use shadow through shadcn `<Card surface="elevated">`, which uses
`shadow-1` by default and may lift to `shadow-2` on interactive hover. Do not
hand-roll shadow card recipes.

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
| `bg-[#DB515C]`                                  | `bg-brand-fill`                                  |
| `color: #DB515C`                                | `text-text-brand` for brand chrome, `text-link` for ordinary links |
| `bg-white` for page/component roles             | `bg-surface-canvas` / `bg-surface-elevated`      |
| `bg-gray-100`                                   | `bg-surface-subtle`                              |
| `text-gray-500`                                 | `text-text-secondary`                            |
| `font-size: 14px`                               | `text-sm` (gets clamp scaling)                   |
| `border` (= `border-gray-200`)                  | `border-whisper` (tokenized)                     |
| `rounded-[8px]`                                 | `rounded-md`                                     |
| `transition-all duration-200`                   | `transition duration-base`                       |
| `font-bold` (700)                               | `font-medium` (500) — bold fights editorial mood |
| Emoji in button label                           | Lucide icon                                      |
