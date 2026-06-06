---
title: Theme Color Role Runtime
status: done
created: 2026-06-06
completed: 2026-06-06
supersededBy:
tags: [ui, theme, design-system]
---

## Why

The Storybook color docs now describe the target Rezics color model: white/black
page baselines, mode-invariant brand red for product identity and primary
actions, and unified blue for textual navigation. Runtime tokens and callsites
still reflect the previous parchment/dark-stone theme and often use brand text
for link-like UI.

This proposal turns the reviewed design direction into implementation work:
update the token source, make the generated UnoCSS utilities natural to consume,
then audit existing brand/link usage so code matches the role model instead of
hardcoding color intent locally.

## Durable constraints & decisions

- (type) Link must be a first-class runtime color group with a `DEFAULT` value so
  consumers can use `text-link` naturally. Do not force link consumers through
  `text-text-link`.
- (type) Brand fill is mode-invariant `#DB515C`; hover and active are control
  interaction states, not selected/current state names.
- (type) Surface tokens stay fully enumerated even when light values repeat.
  `surface-canvas`, `surface-base`, and related container tiers still need
  distinct tokens because components depend on roles, not only values.
- (comment) Contrast numbers are diagnostics, not a blanket veto: long-form and
  frequently changing content must stay neutral, while short stable brand chrome
  may use brand red.
- (test) Link primitives should default to blue link text and preserve hover
  affordance without consuming brand text.
- (test) Convention checks must continue rejecting retired `--rezics-*` CSS
  variables; docs-only preview variables must avoid that namespace.

## Tasks

## 1. Runtime Token Shape

- [x] 1.1 Update `package/ui/src/config/tokens/colors.ts` to the white/black
  surface ladder, `#DB515C` brand fill states, and `#1a73e8` link role.
- [x] 1.2 Add a `link` color group to `ColorTokens` with `DEFAULT` and `hover`,
  so UnoCSS emits `text-link` and related utilities. Do not add a global visited
  link token; visited state is out of scope unless a future content-browsing
  surface needs it locally.
- [x] 1.3 Reconcile the Storybook docs naming with the final runtime shape in
  `package/ui/src/docs/tokens/colors.mdx`; keep one source of truth for link
  color instead of parallel `text.link` and `link.text` token sources.
- [x] 1.4 Update shadcn-facing slots in `colors.ts` so `background`,
  `foreground`, `primary`, `accent`, `ring`, `sidebar.*`, and chart colors map to
  the new roles.

## 2. Link And Brand Callsite Audit

- [x] 2.1 Change `package/ui/src/primitive/link/TextLink.tsx` from brand text to
  link text, with hover underline or the agreed link hover treatment.
- [x] 2.2 Change app/admin router link wrappers in `package/app/src/shared/ui/link.tsx`
  and `package/admin/src/shared/ui/link.tsx` to match the core `TextLink` role.
- [x] 2.3 Audit `text-brand`, `hover:text-text-brand`, `text-brand-fill`, and raw
  `var(--colors-brand-fill)` text usages under `package/app`, `package/admin`,
  and `package/ui`; convert link-like text to link tokens and keep true brand
  chrome on brand tokens.
- [x] 2.4 Keep primary buttons, logo/wordmark, accent bars, selected indicators,
  and stable brand labels on brand tokens.

## 3. Component Interaction Follow-Up

- [x] 3.1 Rework `package/ui/src/primitive/typography/collapsible/Collapsible.tsx`
  against its real states and labels; test the proposed closed-brand/open-blue
  disclosure treatment instead of assuming current copy.
- [x] 3.2 Add or update Storybook stories for link primitives and collapsible
  disclosure states so hover, active, focus, light, and dark behavior are visible.
- [x] 3.3 Update token docs/examples after runtime implementation so the docs
  page renders from real tokens where practical instead of docs-only constants.

## 4. Validation

- [x] 4.1 Run `node_modules/.bin/biome check` or a targeted equivalent for the
  touched files.
- [x] 4.2 Run `bun run check:convention` and `bun run check:tokens`.
- [x] 4.3 Run `bun --filter=@rezics/ui run build-storybook`.
- [x] 4.4 Provide the Storybook URL for design review:
  `http://localhost:6007/?path=/docs/foundation-tokens-colors--docs`.

## Out of scope

- This plan does not redesign non-color typography, spacing, radius, or
  component density.
- This plan does not remove semantic, sentiment, chart, inverse, or sidebar
  roles; it preserves the full color architecture while changing values and
  role boundaries.
- This plan does not implement application feature behavior outside the color
  role migration.
