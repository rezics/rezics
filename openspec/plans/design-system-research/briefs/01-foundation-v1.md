# Foundation v1 — rezics Design Tokens

**Status**: Phase 2A Brand Foundation — **Gate-A1 artifact**, awaiting user approval before Phase 3 (token codification) begins.
**Date**: 2026-05-01
**Supersedes**: `../04-rezics-direction-brief.md` (v0)
**Scope**: Pure design tokens — color, typography, spacing, radius, motion, elevation. Component primitive conventions (Button/Input/Card forms) live in a separate "Atomic Primitives" brief (TBD).

This brief is the canonical foundation. All subsequent surface briefs (Library family, UGC, Tag, Admin, etc.) inherit from this and may extend but not contradict.

---

## 1. Decisions Already Locked (from prior conversation)

| Topic                    | Decision                                                                                                        | Status         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------- |
| Brand color              | 轮回红 `#f4606c` + light-text variant `#C4433A`                                                                 | Locked by user |
| Background               | Warm parchment `#f5f4ed` (light) / warm dark stone `#1a1a18` (dark)                                             | Locked         |
| Sans family              | Inter (Latin) + Source Han Sans (CJK) via unicode-range                                                         | Locked         |
| Mono family              | CaskaydiaMono Nerd Font (Latin) + Sarasa Mono TC (CJK)                                                          | Locked         |
| Serif family             | Source Serif 4 (Latin) + Source Han Serif (CJK), reader / 書評 only                                             | Locked         |
| Default CJK region       | Traditional Chinese (`zh-hant`)                                                                                 | Locked         |
| Per-language routing     | `:lang()` CSS rules for TC / SC / JP / KR; Latin auto via unicode-range                                         | Locked         |
| Type sizing              | `clamp()` viewport-responsive                                                                                   | Locked         |
| Semantic colors          | Warm-tinted (success teal, warning amber, error rose, info blue)                                                | Locked         |
| Single accent strictness | Strict (only `#f4606c` chromatic) + `palette.accent` reserved as `null` escape hatch                            | Locked         |
| MUI alignment            | MUI is the foundation; all tokens map to `theme.palette` / `theme.spacing` / `theme.shape` / `theme.typography` | Locked         |
| Foundation v1 scope      | Tokens only; no component conventions                                                                           | Locked         |

---

## 2. Color Tokens

### 2.1 Surfaces (background scale)

Two-mode parity tokens (light + dark designed independently).

| Token              | Light                 | Dark                      | Use                                       |
| ------------------ | --------------------- | ------------------------- | ----------------------------------------- |
| `surface-canvas`   | `#f5f4ed` parchment   | `#1a1a18` warm dark stone | Page background                           |
| `surface-base`     | `#faf9f5` ivory       | `#26251e` warm graphite   | Default raised surface (cards)            |
| `surface-elevated` | `#ffffff` paper       | `#30302e` warm slate      | Modals, popovers, command palette         |
| `surface-subtle`   | `#ebeae5` warm gray   | `#1f1e1c` deep warm       | Code blocks, chip background, table zebra |
| `surface-sunken`   | `#e6e5e0` deeper warm | `#141413` deepest warm    | Inset panels (rare)                       |

### 2.2 Text (foreground)

All text colors verified against `surface-canvas` for both modes.

| Token            | Light value | On parchment                               | Dark value | On dark stone       | Use                                                                          |
| ---------------- | ----------- | ------------------------------------------ | ---------- | ------------------- | ---------------------------------------------------------------------------- |
| `text-primary`   | `#1d1d1f`   | **15.26:1** AAA                            | `#f0eee6`  | **15.00:1** AAA     | Body, headings                                                               |
| `text-secondary` | `#6e6e73`   | **4.60:1** AA-body                         | `#a39e98`  | **6.56:1** AA-body  | Secondary copy                                                               |
| `text-tertiary`  | `#86868b`   | **3.29:1** AA-large                        | `#6e6c66`  | **3.32:1** AA-large | Metadata, disabled labels                                                    |
| `text-disabled`  | `#c7c7cc`   | (decorative)                               | `#48484a`  | (decorative)        | Disabled UI state                                                            |
| `text-on-brand`  | `#ffffff`   | (on brand fill, **3.12:1** with `#f4606c`) | `#ffffff`  | (same)              | White on `#f4606c` button — **AA-large only** (≥14px medium / ≥16px regular) |
| `text-brand`     | `#C4433A`   | **4.52:1** AA-body                         | `#fa7882`  | **6.70:1** AA-body  | Brand-color text (links, brand-emphasized headlines, brand error labels)     |

**Mandatory rule**: `text-brand` is the ONLY token allowed for brand-color text. Direct use of `#f4606c` as text color is **forbidden** — it fails AA on parchment (2.83:1) and fails AA-body on white (3.12:1).

### 2.3 Brand color variants

| Token                                         | Value                   | Use                                                                                                                                |
| --------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `brand-fill`                                  | `#f4606c`               | Button background, badge fill, focus ring, icon fill, `<Tag>` background, decorative accents — **anywhere not used as text color** |
| `brand-fill-hover`                            | `#e85666` (darken ~5%)  | Button hover state                                                                                                                 |
| `brand-fill-active`                           | `#d94c5c` (darken ~10%) | Button active/pressed state                                                                                                        |
| `brand-text-light` (alias `text-brand` light) | `#C4433A`               | Brand text on light backgrounds                                                                                                    |
| `brand-text-dark` (alias `text-brand` dark)   | `#fa7882`               | Brand text on dark backgrounds                                                                                                     |

**Known caveat — UI 3:1 contrast**: `brand-fill #f4606c` on `surface-canvas #f5f4ed` is 2.83:1, which is below WCAG SC 1.4.11 for non-text UI elements (3:1). Three resolution options for buttons specifically:

| Option           | Approach                                                                                     | Tradeoff                                                             |
| ---------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **A. Accept**    | Document the limitation; rely on saturation differential for visual separation               | Industry-standard pragma (MUI default does same); fails strict audit |
| **B. Border**    | Brand button = `bg: brand-fill` + `border: 1px solid brand-fill-active`                      | Adds border to all brand buttons; preserves `#f4606c` identity       |
| **C. Swap fill** | Brand button uses `#C4433A` as fill (4.52:1 ✓) and reserves `#f4606c` for accents/decoration | Violates "primary = #f4606c" intent                                  |

**Foundation v1 default**: **Option A (Accept)** — standard pragma. Brand-critical compliance surfaces (e.g., admin login, payment) can opt into Option B locally. This is documented but not enforced at token level.

### 2.4 Semantic colors

Warm-tinted family (matches parchment temperature). Each semantic has a `fill` variant (UI element, 3:1 sufficient) and a `text-light` / `text-dark` variant (AA-body 4.5:1 required).

| Semantic  | `*-fill` (3:1 UI) | On parchment | On dark  | `*-text-light` (AA-body)   | `*-text-dark` (AA-body) |
| --------- | ----------------- | ------------ | -------- | -------------------------- | ----------------------- |
| `success` | `#1f8a65`         | 3.90:1 ✓     | 4.05:1 ✓ | `#157352` (5.28:1 ✓)       | `#3da884` (5.92:1 ✓)    |
| `warning` | `#b8732e`         | 3.44:1 ✓     | 4.59:1 ✓ | `#8a5520` (5.60:1 ✓)       | `#d8943e` (6.83:1 ✓)    |
| `error`   | `#cf2d56`         | 4.58:1 ✓     | 3.45:1 ✓ | `#cf2d56` (4.58:1 ✓ reuse) | `#e34c75` (4.61:1 ✓)    |
| `info`    | `#3898ec`         | 2.77:1 ✗     | 5.70:1 ✓ | `#1565c0` (5.21:1 ✓)       | `#5aa9f0` (6.95:1 ✓)    |

**Note on `info-fill` on parchment**: 2.77:1 falls below UI 3:1. Same Option A-vs-B-vs-C choice as brand-fill applies; default is Option A (accept), with `info-text-light` strictly used for any info-colored text.

### 2.5 Borders

Borders are the primary depth mechanism (not shadows).

| Token            | Light                  | Dark                        | Use                                                             |
| ---------------- | ---------------------- | --------------------------- | --------------------------------------------------------------- |
| `border-whisper` | `rgba(0,0,0,0.08)`     | `rgba(255,255,255,0.10)`    | Default surface containment (Notion pattern)                    |
| `border-defined` | `#d2d2d7`              | `#3a3937`                   | Stronger boundary (admin tables, dense forms)                   |
| `border-strong`  | `#86868b`              | `#5a5856`                   | Maximum visibility (rare — focused fields, emphasized dividers) |
| `border-focus`   | `#f4606c` (brand-fill) | `#fa7882` (brand-text-dark) | `:focus-visible` ring                                           |
| `border-error`   | `#cf2d56`              | `#e34c75`                   | Form validation error                                           |

**Focus ring spec**: `outline: 2px solid var(--rzc-border-focus); outline-offset: 2px;` — uses brand color in both modes for instant brand recognition during keyboard navigation.

---

## 3. Typography

### 3.1 Family triad

Three logical font families, each layered as Latin-via-unicode-range + CJK-via-`:lang()`.

| Logical role | Latin source            | CJK source                                            | Use                                            |
| ------------ | ----------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| `font-sans`  | Inter Variable          | Source Han Sans (TC default; SC/JP/KR via `:lang()`)  | All UI, default body                           |
| `font-mono`  | CaskaydiaMono Nerd Font | Sarasa Mono TC                                        | Code, terminal, IDs/hashes                     |
| `font-serif` | Source Serif 4          | Source Han Serif (TC default; SC/JP/KR via `:lang()`) | Reader (book content), 書評 long-form articles |

### 3.2 `@font-face` with unicode-range (Latin segmentation)

Each logical family uses two `@font-face` declarations sharing the same `font-family` name, distinguished by `unicode-range`:

```css
/* Inter — Latin only */
@font-face {
  font-family: 'rzc-sans';
  src: url('/fonts/inter-variable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
  font-size-adjust: ex-height 0.522;  /* match Source Han Sans x-height */
  unicode-range:
    U+0000-024F,    /* Latin + Latin-1 Extended */
    U+1E00-1EFF,    /* Latin Extended Additional */
    U+2000-206F,    /* General Punctuation */
    U+20A0-20CF,    /* Currency Symbols */
    U+2150-218F,    /* Number Forms */
    U+2190-21FF,    /* Arrows */
    U+2500-257F,    /* Box Drawing */
    U+2700-27BF;    /* Dingbats */
}

/* Source Han Sans — CJK + CJK-relevant punctuation. Default = TC. */
@font-face {
  font-family: 'rzc-sans';
  src: url('/fonts/source-han-sans-tc.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
  unicode-range:
    U+3000-303F,    /* CJK Symbols and Punctuation */
    U+3040-309F,    /* Hiragana */
    U+30A0-30FF,    /* Katakana */
    U+3100-312F,    /* Bopomofo */
    U+3130-318F,    /* Hangul Compatibility Jamo */
    U+31A0-31BF,    /* Bopomofo Extended */
    U+31F0-31FF,    /* Katakana Phonetic Extensions */
    U+3400-4DBF,    /* CJK Unified Ideographs Extension A */
    U+4E00-9FFF,    /* CJK Unified Ideographs */
    U+A000-A4CF,    /* Yi Syllables (rare) */
    U+AC00-D7AF,    /* Hangul Syllables */
    U+F900-FAFF,    /* CJK Compatibility Ideographs */
    U+FE30-FE4F,    /* CJK Compatibility Forms */
    U+FF00-FFEF;    /* Halfwidth/Fullwidth Forms */
}
```

Same pattern for `rzc-serif` (Source Serif 4 + Source Han Serif) and `rzc-mono` (CaskaydiaMono + Sarasa Mono TC).

### 3.3 `:lang()` regional CJK switching

The `@font-face` above defaults the CJK family to TC. When content carries `lang="zh-Hans"` / `"ja"` / `"ko"`, swap to the regional variant:

```css
:root {
  --rzc-font-sans-cjk: 'Source Han Sans TC';
  --rzc-font-serif-cjk: 'Source Han Serif TC';
}
:lang(zh-Hans), :lang(zh-CN) {
  --rzc-font-sans-cjk: 'Source Han Sans SC';
  --rzc-font-serif-cjk: 'Source Han Serif SC';
}
:lang(ja) {
  --rzc-font-sans-cjk: 'Source Han Sans JP';
  --rzc-font-serif-cjk: 'Source Han Serif JP';
}
:lang(ko) {
  --rzc-font-sans-cjk: 'Source Han Sans KR';
  --rzc-font-serif-cjk: 'Source Han Serif KR';
}
body {
  font-family: 'Inter', var(--rzc-font-sans-cjk), system-ui, sans-serif;
}
```

(Implementation note: maintaining 4 sets of `@font-face` for each family is verbose; in Phase 3 we generate this from a config rather than hand-write.)

### 3.4 i18next integration (must align)

rezics's i18n uses lower-cased BCP-47: `zh-hant`, `zh-hans`, `ja`, `en`, `de`. The `<html lang>` attribute must mirror i18next's current `i18n.language`.

CSS `:lang()` matching is **case-insensitive and accepts script subtags**, so:
- i18next `"zh-hant"` → `<html lang="zh-hant">` → matches `:lang(zh-Hant)` ✓
- i18next `"zh-hans"` → `<html lang="zh-hans">` → matches `:lang(zh-Hans)` ✓

No code changes needed in `@rezics/i18n`. Only required: ensure `<html lang>` syncs with `i18n.language` (likely already implemented; verify in Phase 3 spike).

### 3.5 German / Latin-only locales

`en` and `de` content uses Inter via unicode-range automatically. German diacritics (ß ä ö ü) are within Inter's coverage (Latin Extended). No CJK font load triggered for these locales.

### 3.6 Type scale (viewport-responsive)

Single 8-step scale, all sizes use `clamp(min, preferred-with-vw, max)`:

| Token       | Min  | Preferred           | Max  | Use                        |
| ----------- | ---- | ------------------- | ---- | -------------------------- |
| `text-xs`   | 12px | `0.75rem + 0.05vw`  | 13px | Captions, table cells      |
| `text-sm`   | 13px | `0.8125rem + 0.1vw` | 14px | Dense UI body, form labels |
| `text-base` | 14px | `0.875rem + 0.2vw`  | 16px | Default UI body            |
| `text-md`   | 16px | `1rem + 0.3vw`      | 18px | Comfortable reading body   |
| `text-lg`   | 18px | `1.125rem + 0.4vw`  | 22px | Subsection headings        |
| `text-xl`   | 22px | `1.375rem + 0.6vw`  | 28px | Section headings           |
| `text-2xl`  | 28px | `1.75rem + 0.8vw`   | 36px | Page titles                |
| `text-3xl`  | 36px | `2.25rem + 1.2vw`   | 48px | Hero / chapter titles      |

**Reader special**: book content body uses `text-md` minimum (`clamp(16px, 1rem + 0.4vw, 20px)`) to protect against small-CJK-serif rendering issues.

### 3.7 Line-height policy (mandatory)

| Context                                    | Line height | Rule                                     |
| ------------------------------------------ | ----------- | ---------------------------------------- |
| Reader body (book content, > 3 paragraphs) | `1.60`      | Hard requirement (claude rule)           |
| Standard article body                      | `1.55`      | Default for most pages                   |
| UI labels, chrome                          | `1.40`      | Tight enough not to waste vertical space |
| Dense tables, nav                          | `1.30`      | Maximum compactness                      |

Implemented as token: `leading-reader` `1.60` / `leading-body` `1.55` / `leading-ui` `1.40` / `leading-dense` `1.30`.

### 3.8 Weights

Restrained palette: `400` regular, `500` medium (headlines, emphasis), `600` semibold (rare strong emphasis only). **Avoid 700+** — it fights the editorial mood.

### 3.9 `font-size-adjust` for Latin/CJK harmony

Inter's x-height is taller than Source Han Sans's by default. Use `font-size-adjust: ex-height 0.522` on Inter to normalize x-height to ~52.2% of font-size, matching Source Han Sans. This eliminates the "Latin runs taller than CJK" visual stutter in mixed text.

---

## 4. Spacing

8px base unit (matches MUI's `theme.spacing(1)` and 91% of references).

| Token       | Value | Use                                |
| ----------- | ----- | ---------------------------------- |
| `space-0`   | 0     | —                                  |
| `space-px`  | 1px   | Hairline borders, dividers         |
| `space-0.5` | 2px   | Micro-gaps                         |
| `space-1`   | 4px   | Compact icon margin                |
| `space-2`   | 8px   | **Base** — default padding         |
| `space-3`   | 12px  | Input vertical padding, small gaps |
| `space-4`   | 16px  | Card padding, default gap          |
| `space-5`   | 24px  | Section internal padding           |
| `space-6`   | 32px  | Section divider                    |
| `space-8`   | 48px  | Between sections                   |
| `space-10`  | 64px  | Page-level vertical rhythm         |
| `space-12`  | 96px  | Chapter-level breathing            |
| `space-16`  | 128px | Hero / landing extra               |

**Section rhythm policy**: reader and folio use `space-8`–`space-12` between sections with no decorative dividers. Admin and editor use `space-4`–`space-5` for compactness.

---

## 5. Radius

Apple-inspired tier system (purposeful per component class).

| Token         | Value  | Use                                       |
| ------------- | ------ | ----------------------------------------- |
| `radius-xs`   | 4px    | Inline tags, code chips                   |
| `radius-sm`   | 6px    | Inputs, dense buttons                     |
| `radius-md`   | 8px    | **Default** — buttons, chips, small cards |
| `radius-lg`   | 12px   | Cards, surfaces                           |
| `radius-xl`   | 16px   | Modals, large cards                       |
| `radius-2xl`  | 24px   | Hero blocks, feature cards                |
| `radius-pill` | 9999px | Tags, status pills, hero CTAs             |
| `radius-full` | 50%    | Avatars, circular icon buttons            |

Maps to MUI `theme.shape.borderRadius = 8` with explicit overrides per component slot.

---

## 6. Motion

Most reference systems do not document motion. Declaring it explicitly puts rezics ahead of 80% of the field.

### 6.1 Duration tokens

| Token         | Value | Use                             |
| ------------- | ----- | ------------------------------- |
| `motion-fast` | 120ms | Press feedback, scale on tap    |
| `motion-base` | 200ms | Hover transitions, color shifts |
| `motion-slow` | 350ms | Layout shifts, panel open/close |
| `motion-page` | 500ms | Route transitions               |

### 6.2 Easing tokens

| Token         | Value                            | Use                         |
| ------------- | -------------------------------- | --------------------------- |
| `ease-out`    | `cubic-bezier(0.0, 0.0, 0.2, 1)` | Default for entries         |
| `ease-in-out` | `cubic-bezier(0.4, 0.0, 0.2, 1)` | State changes               |
| `ease-spring` | `cubic-bezier(0.4, 1.4, 0.5, 1)` | Reserved for delight (rare) |

### 6.3 Press feedback (notion pattern)

Buttons: `transform: scale(0.98)` on `:active`, `scale(1.0)` resting, `motion-fast` duration.

### 6.4 Reduced motion (mandatory)

`prefers-reduced-motion: reduce` collapses all durations to `0ms` and removes scale transforms. Implemented globally in `layers.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0ms !important;
    transition-duration: 0ms !important;
  }
}
```

---

## 7. Elevation

### 7.1 Default policy: borders + spacing, NOT shadows

Most surfaces have no shadow. Containment via `border-whisper` (1px at 8% opacity) and whitespace.

### 7.2 Reserved escalation: 4-layer shadow (modal-tier only)

ONLY for dialogs, command palette, context menus, popovers over chapters.

```css
--rzc-shadow-1: 0 1px 2px rgba(0,0,0,0.04);
--rzc-shadow-2: 0 2px 4px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.04);
--rzc-shadow-3: 0 4px 8px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.04), 0 16px 32px rgba(0,0,0,0.06);
--rzc-shadow-modal:
  0 1px 2px rgba(0,0,0,0.03),
  0 4px 8px rgba(0,0,0,0.04),
  0 8px 16px rgba(0,0,0,0.04),
  0 16px 32px rgba(0,0,0,0.06);   /* 4-layer accumulating */
```

Cards, sections, table rows, panels: **no shadow, ever**. Style guide rule, not suggestion.

In dark mode, shadow opacities scale up to `0.20–0.40` to remain visible against dark canvas.

---

## 8. MUI Theme Mapping

The TypeScript token files generate a single `createTheme()` call. Mapping:

| Token                         | MUI key                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `brand-fill` (#f4606c)        | `palette.primary.main`                                                                                                      |
| `brand-fill-active` (#d94c5c) | `palette.primary.dark`                                                                                                      |
| `brand-text-light` (#C4433A)  | `palette.primary.contrastText` not — use new `palette.primary.dark` (re-purposed for text) OR custom `palette.primary.text` |
| `brand-text-dark` (#fa7882)   | `palette.primary.light`                                                                                                     |
| `text-on-brand` (#ffffff)     | `palette.primary.contrastText`                                                                                              |
| `success-fill` etc.           | `palette.success.main`, `.dark`, `.light` analogously                                                                       |
| `text-primary`                | `palette.text.primary`                                                                                                      |
| `text-secondary`              | `palette.text.secondary`                                                                                                    |
| `text-disabled`               | `palette.text.disabled`                                                                                                     |
| `surface-canvas`              | `palette.background.default`                                                                                                |
| `surface-base`                | `palette.background.paper`                                                                                                  |
| `surface-elevated`            | (custom: `palette.background.elevated`)                                                                                     |
| `surface-subtle`              | (custom: `palette.background.subtle`)                                                                                       |
| `border-*`                    | (custom: `palette.divider` for whisper; rest via custom palette ext)                                                        |
| `radius-md` (8px)             | `shape.borderRadius = 8`                                                                                                    |
| `space-2` (8px)               | `spacing(1)`                                                                                                                |
| Type tokens                   | `typography.body1` / `body2` / `h1`–`h6` / custom                                                                           |
| Motion tokens                 | `transitions.duration.shortest` (120ms), `.shorter` (200ms), `.short` (350ms), `.standard` (500ms)                          |

**Escape hatch**: `palette.accent` is reserved as `null` in the theme type; future surfaces requiring a second chromatic color must propose via OpenSpec change before populating.

**Two themes**: `lightTheme` and `darkTheme` are separate `createTheme()` results. App switches via `<ThemeProvider theme={mode === 'dark' ? darkTheme : lightTheme}>`. CSS variables also switch via `[data-theme="dark"]` attribute on `<html>` for non-MUI consumers (UnoCSS classes).

### 8.1 UnoCSS preset

`package/ui/src/config/uno-config.ts` exposes shortcuts that resolve to CSS variables (so they auto-switch with mode):

```ts
export default defineConfig({
  theme: {
    colors: {
      brand: {
        DEFAULT: 'var(--rzc-color-brand-fill)',
        text: 'var(--rzc-color-text-brand)',
      },
      surface: {
        DEFAULT: 'var(--rzc-color-surface-canvas)',
        base: 'var(--rzc-color-surface-base)',
        elevated: 'var(--rzc-color-surface-elevated)',
      },
      // ...
    },
    spacing: { /* 8px base, mapped to space-* tokens */ },
    borderRadius: { /* radius-* tokens */ },
  },
});
```

This means `<div class="bg-surface text-primary">` and MUI's `<Paper>` consume the same underlying CSS variable, guaranteeing visual consistency.

---

## 9. CSS Custom Properties — naming scheme

Tokens compile to CSS variables with the prefix `--rzc-` (REZICS) and dot-notation flattened to dashes:

```css
:root {
  /* Light mode (default) */
  --rzc-color-surface-canvas: #f5f4ed;
  --rzc-color-surface-base:   #faf9f5;
  --rzc-color-text-primary:   #1d1d1f;
  --rzc-color-text-brand:     #C4433A;
  --rzc-color-brand-fill:     #f4606c;
  --rzc-color-success-text:   #157352;
  /* ... */
  --rzc-space-2: 8px;
  --rzc-radius-md: 8px;
  --rzc-motion-base: 200ms;
}

[data-theme="dark"] {
  --rzc-color-surface-canvas: #1a1a18;
  --rzc-color-surface-base:   #26251e;
  --rzc-color-text-primary:   #f0eee6;
  --rzc-color-text-brand:     #fa7882;
  /* brand-fill stays #f4606c — it's a fill, not text */
  --rzc-color-success-text:   #3da884;
  /* ... */
}
```

Mode switching is via `<html data-theme="dark">` attribute (user-toggleable, persists in localStorage). Optionally `prefers-color-scheme` honored on first visit.

---

## 10. Font Loading Strategy

### 10.1 Self-host (recommended)

rezics's primary audience may have unreliable access to Google Fonts CDN. **Self-host all font files** under `package/ui/src/assets/fonts/` (or app-side `/public/fonts/`).

### 10.2 Subsetting

Pre-subset CJK fonts using `fonttools` Python tool or `subset-font` JS:
- Source Han Sans TC subset (top ~7000 chars covering >99% common usage) ≈ ~700KB woff2
- Source Han Serif TC subset same range ≈ ~900KB woff2
- Sarasa Mono TC subset (top ~6000 chars + Latin) ≈ ~900KB woff2
- Inter Variable (full Latin Extended) ≈ ~50KB woff2
- Source Serif 4 (full Latin) ≈ ~50KB woff2
- CaskaydiaMono Nerd Font (Latin + Powerline glyphs) ≈ ~200KB woff2

**On-demand range loading**: for rare characters outside the common subset, declare additional `@font-face` blocks with narrower `unicode-range` and source pointing to per-range woff2 files (auto-generated by subsetter). Browser only fetches when a glyph in that range appears.

### 10.3 `font-display` policy

- Sans family: `font-display: swap` (instant text render with fallback, swap when loaded)
- Serif family: `font-display: optional` for reader (avoid layout shift mid-reading; if not cached, use system serif)
- Mono family: `font-display: swap`

### 10.4 Preload hints

In each app's HTML shell:

```html
<link rel="preload" href="/fonts/inter-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/source-han-sans-tc-common.woff2" as="font" type="font/woff2" crossorigin>
```

Mono and serif preloaded only on routes that need them (editor → mono, reader → serif).

### 10.5 License compliance

All fonts under SIL Open Font License (OFL) — commercial use ✓, embedding ✓, modification ✓. Bundle the OFL.txt files alongside font assets.

---

## 11. Contrast Policy (Codified)

| Use case                                             | WCAG threshold     | Token to use                                                          |
| ---------------------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| Body text (paragraph, label, caption ≥ 12px regular) | AA 4.5:1           | `text-primary` / `text-secondary` / `text-brand` (NEVER `brand-fill`) |
| Large text (≥ 18px regular OR ≥ 14px bold)           | AA 3:1             | Allows `text-tertiary`, `text-on-brand`                               |
| UI element boundary (button border vs canvas)        | AA 3:1 (SC 1.4.11) | `border-whisper` insufficient; `border-defined` minimum               |
| Decorative non-text                                  | none               | Any token                                                             |

**Enforcement plan**: Phase 3 ships a Storybook story `tokens/contrast-matrix.mdx` that auto-renders every token combination's contrast ratio and flags violations. CI runs `axe` on rendered Storybook for regression.

---

## 12. What This Brief Does NOT Cover (deferred to other briefs)

- **Component primitive forms**: Button shape, Input border policy, Card structure → "Atomic Primitives" brief
- **Library family surfaces**: 書庫 / 遊戲庫 / 媒體庫 visual treatment → "Library Family" brief
- **UGC / Post components**: ThreadCard / PostArticle / CommentTree / StreamPost / QuoteCard → "UGC" brief
- **Tag system visual language** → "Tag System" brief
- **Admin design language** → "Admin" brief
- **Voice / copy guidelines** (microcopy patterns, tone) → "Voice" brief

This Foundation v1 only fixes the foundational primitives; surfaces consume these.

---

## 13. What Happens After Approval

Once user approves this brief (with any final tweaks), Phase 3 begins:

1. **T3.1–T3.7**: Author `package/ui/src/config/tokens/{colors,typography,spacing,radius,elevation,motion,index}.ts`
2. **T3.8**: Author `package/ui/src/config/mui-theme.ts` (light + dark variants)
3. **T3.9**: Wire tokens into `package/ui/src/config/uno-config.ts`
4. **T3.10**: Inject CSS custom properties via `package/ui/src/shared/style/layers.css`
5. **T3.11**: Smoke-test in `@rezics/app` dev server
6. **Sub-task** (deferred until needed): font subsetting pipeline, preload integration in app shells

Estimated effort: ~1 week of focused work.

---

## 14. Open Questions for Final Approval

1. **Brand button contrast option** — Accept (A) / Border (B) / Swap fill (C)? **Default: A**.
2. **`palette.accent` escape hatch** — keep reserved as `null`? **Default: yes**.
3. **`font-size-adjust: ex-height 0.522`** — accept the empirical x-height ratio? Phase 3 should verify visually; happy to tune.
4. **Mode switching mechanism** — `[data-theme]` attribute (proposal) vs CSS class (`.dark`) vs `prefers-color-scheme`-only? **Default: data-attribute + persisted toggle, with first-visit defaulting to `prefers-color-scheme`**.
5. **Font self-host vs Google Fonts** — self-host (proposal) vs Google Fonts CDN? **Default: self-host** (audience reliability).

---

**Awaiting**: User review + answers to Section 14 (or "all defaults"). Then Phase 3 begins.
