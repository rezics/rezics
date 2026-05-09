---
name: rezics-design
description: >
  rezics design system reference: brand identity (轮回红 #f4606c on warm parchment),
  token library, typography rules, shadcn-or-custom component policy,
  Apple-inspired borderless aesthetic, and do/don't patterns. Use this skill
  whenever generating, modifying, or reviewing UI in rezics — JSX, CSS, UnoCSS
  classes, theme tokens, color choices, typography, spacing, or component
  selection. Trigger proactively any time UI styling decisions are being made,
  even when the user hasn't named the skill: choosing colors, picking a
  component (shadcn vs custom), naming a CSS variable, deciding card vs section
  treatment, picking icons, writing copy. Also load when reviewing a PR for
  visual consistency or when asked questions like "is this on-brand?", "what
  color should this be?", "does this match our design system?". Skip only for
  backend, infra, build, test, or non-visual work.
---

# rezics Design System — Foundation v1

This is the canonical AI reference for rezics UI work. Truth lives in code at
`package/ui/src/config/tokens/*.ts` and is emitted to CSS via the preflight in
`package/ui/src/config/uno-config.ts` (post-`unify-tokens-single-source`: flat
`--colors-*` namespace; legacy `--rezics-*` is forbidden by R9).
This skill is the human/AI-readable index.

**Live visual reference**: `bun -F @rezics/ui storybook` (port 6007). Foundation
pages (Tokens × 7, Patterns × 7) render every token and pattern with live samples.
Every shadcn primitive and rezics primitive/composite has a story. The toolbar
exposes global Theme (Light/Dark). Density is documented at
`Foundation/Patterns/Density` as an intrinsic component vocabulary backed by the
fixed `--padding-*` tokens, not as a runtime toolbar.

---

## Top-Level Rules (always apply)

1. **Brand color**: 轮回红 `#f4606c` (`--colors-brand-fill`). It is a fill color, never a text color. For brand-tinted text, use `text-text-brand` (`#C4433A` light / `#fa7882` dark) — already contrast-verified.
2. **Background**: warm parchment `#f5f4ed` (light) / warm dark stone `#1a1a18` (dark). Not pure white, not pure black.
3. **Borderless by default**: cards, sections, panels do NOT get bordered card chrome. Use whitespace and `border-whisper` (`rgba(0,0,0,0.08)`) for containment. Reserve shadows for modal-tier surfaces only.
4. **shadcn-or-custom**. Pick from `@rezics/ui/shadcn` first; these primitives are vendored from the `base-luma` registry under Path P, with `carousel.tsx` and `sidebar.tsx` as explicit exceptions. Reach for rezics-owned custom primitives (`@rezics/ui/primitive/`, `@rezics/ui/composite/`, or feature-local) only when shadcn lacks the component. See `component-selection.md` for the decision tree, `openspec/specs/ui-component-foundation/spec.md` for the spec, and `openspec/changes/migrate-shadcn-to-base-ui-luma/design.md` for the migration boundary.
5. **No emoji icons in UI chrome**. Use `lucide-react` (default) or `@tabler/icons-react` (named fallback when lucide lacks the glyph). Emoji are content (user posts), not interface vocabulary.
6. **No raw `<a href>`**. Always use `<SafeLink href={url}>` from `@rezics/ui` (enforced by `bun run check:convention` R5).
7. **Tokens, not hex literals**. `bg-brand-fill`, `text-text-primary`, `var(--colors-surface-canvas)` — never `bg-[#f4606c]` or `color: #1d1d1f`.
8. **Type sizing is `clamp()` viewport-responsive**. Use the scale (`text-xs` → `text-3xl`, plus `text-reader` for book content). Don't hardcode `font-size: 14px`.
9. **Line-height is mandatory**: book reader = `1.60`, body = `1.55`, UI = `1.40`, dense = `1.30`. Never set lower.
10. **Both light and dark modes are first-class**. Every color decision must work in both. Mode switches via `<html data-theme="dark">` (canonical) or `html.dark` (transitional alias).
11. **Default CJK locale is Traditional Chinese**. Per-language CJK font routing happens automatically via CSS `:lang()` — don't override.
12. **Admin ≠ App**. Admin is operations/management, not a duplicate of app-side editing. Compact density (`p-4`–`p-6`, 16–24px); app uses generous rhythm (`p-12`–`p-24`, 48–96px).

---

## Decision Quickstart

| If you're picking…                | Default                                      | When to deviate                            |
| --------------------------------- | -------------------------------------------- | ------------------------------------------ |
| Button color                      | `brand-fill` background, `text-on-brand`     | Secondary = ghost (`text-text-primary`)    |
| Card chrome                       | No border, whitespace separation             | Whisper border for table rows / list items |
| Heading typography                | `font-sans` + medium weight (500)            | Long-form 書評 / book content → `font-serif` |
| Spacing between sections          | `p-12` (48px) for app; `p-4` (16px) for admin | Hero pages → `p-24` (96px)                 |
| Icon library                      | `lucide-react`                                | `@tabler/icons-react` only when lucide lacks the glyph |
| Form input                        | shadcn `<Input>` + `<Label>` (borderless)    | Compose `<textarea>` for multi-line if needed |
| Modal                             | shadcn `<Dialog>`                             | shadcn `<Sheet>` for side drawers, vaul for mobile bottom sheet |
| Color for success/error/warning   | `text-success`, `text-error`, `text-warning` | `*-fill` for icon-only badges              |
| Brand-tinted text                 | `text-text-brand`                             | NEVER `color: #f4606c` directly            |
| Toast / Snackbar                  | `sonner`                                     | —                                          |

---

## Token Reference (high-level)

For full details, load `tokens.md`.

- **Surfaces**: `surface-canvas` / `-base` / `-elevated` / `-subtle` / `-sunken`
- **Text**: `text-primary` / `-secondary` / `-tertiary` / `-disabled` / `-on-brand` / `-brand`
- **Brand**: `brand-fill` / `-fill-hover` / `-fill-active` / `text-text-brand` (light/dark variants auto-switch)
- **Semantic**: `success-fill` / `success-text`, same for `warning` / `error` / `info`
- **Borders**: `border-whisper` (default) / `-defined` / `-strong` / `-focus` / `-error`
- **Spacing**: UnoCSS `p-N` = `N × 4px` (Tailwind v4). Common steps: `p-2` (8px) / `p-4` (16px) / `p-6` (24px) / `p-8` (32px) / `p-12` (48px) / `p-16` (64px) / `p-24` (96px) / `p-32` (128px).
- **Radius**: `radius-xs` (4) / `-sm` (6) / `-md` (8 default) / `-lg` (12) / `-xl` (16) / `-2xl` (24) / `-pill` / `-full`
- **Motion**: `motion-fast` (120ms) / `-base` (200) / `-slow` (350) / `-page` (500) + easings `ease-out` / `-in-out` / `-spring`

---

## How to apply

| Context           | Form                                             |
| ----------------- | ------------------------------------------------ |
| UnoCSS classes    | `bg-brand-fill`, `text-text-primary`, `p-4`      |
| Raw CSS / `<style>` | `var(--colors-brand-fill)`                       |
| Inline dynamic    | `style={{ '--rezics-local-color': computed }}` then reference via UnoCSS class |

Both forms resolve to the same underlying value because tokens flow:
`tokens.ts` → `layers.css` (CSS vars) + `uno-config.ts` (Uno theme).

---

## Sub-files (load on demand)

- **`voice.md`** — design mood, density, tone, brand voice. Read when authoring landing pages, marketing copy, hero sections, or any place that establishes "what is rezics". Storybook: `Foundation/Voice`.
- **`tokens.md`** — full token cheatsheet: every token with its value, intended use, and common mistakes. Storybook: `Foundation/Tokens/{Colors,Typography,Spacing,Radius,Elevation,Motion,Iconography}`.
- **`patterns.md`** — concrete do/don't gallery with code snippets. Storybook: `Foundation/Patterns/{Density,State Layer,Depth Without Shadow,Inverse Surface,Layout & Breakpoints,Patterns}`.
- **`component-selection.md`** — shadcn-or-custom decision tree and category-by-category recommendations. Storybook: every shadcn primitive lives under `Primitives/<Name>`; rezics primitives under `Primitive/<Category>/<Name>`; composites under `Composite/<Category>/<Name>`.
- **`icons.md`** — lucide-default + tabler-fallback icon guidance and brand-mark catalog. Storybook: `Foundation/Tokens/Iconography`.

For deeper context: `openspec/plans/design-system-research/briefs/01-foundation-v1.md` (the canonical brief).

---

## Hard "Never" List

1. Never use `#f4606c` as a text color (fails AA contrast on parchment).
2. Never use raw `<a href>`. Use `<SafeLink>`.
3. Never use emoji as UI icons. Use `lucide-react` (default) or `@tabler/icons-react` (named fallback).
4. Never wrap a section/page in a bordered card with shadow. Use whitespace.
5. Never set `font-size: 14px` (or any fixed px). Use the `clamp()` scale.
6. Never set line-height below 1.30 for any text. Below 1.55 for body. Below 1.60 for book reader.
7. Never introduce a new chromatic accent color. The escape hatch is `palette.accent` (currently `null`); proposing a second hue requires an OpenSpec change.
8. Never bypass the design tokens by hardcoding hex values, px values, or font names.

---

## When in doubt

Bias toward restraint. rezics is a content-first, library-archive aesthetic. The interface should disappear into the content. If the design feels noisy or assertive, you've over-decorated.
