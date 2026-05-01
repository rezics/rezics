### Requirement: Token TypeScript modules are the single source of truth

The rezics design system SHALL define all foundation tokens (color, typography, spacing, radius, elevation, motion) as TypeScript constants under `package/ui/src/config/tokens/`. Every other consumer — MUI theme, UnoCSS preset, CSS custom properties in `layers.css` — SHALL derive from these modules. Token authors SHALL NOT introduce parallel sources of truth (Tailwind config literals, CSS-in-TS theme objects, MDX-only definitions).

#### Scenario: All token categories live under the tokens directory

- **WHEN** the contents of `package/ui/src/config/tokens/` are listed
- **THEN** the directory SHALL contain `colors.ts`, `typography.ts`, `spacing.ts`, `radius.ts`, `elevation.ts`, `motion.ts`, and `index.ts`
- **AND** `index.ts` SHALL re-export from each of the six token modules

#### Scenario: MUI theme imports tokens, not literals

- **WHEN** `package/ui/src/config/theme.ts` is inspected
- **THEN** color, spacing, radius, and motion values SHALL be sourced from `./tokens/*` imports
- **AND** raw hex / px / millisecond literals for foundation values SHALL NOT appear in the theme file

#### Scenario: UnoCSS preset binds to tokens via CSS variables

- **WHEN** `package/ui/src/config/uno-config.ts` defines theme colors / spacing / radius
- **THEN** the values SHALL be `var(--rezics-…)` strings, not raw hex / px literals
- **AND** the same UnoCSS class SHALL render different colors when `[data-theme="dark"]` is set on `<html>`

### Requirement: CSS custom property namespace is `--rezics-*`

All design-system CSS custom properties SHALL use the `--rezics-` prefix. The previous `--rzc-*` shorthand SHALL NOT be used. Font-family local fallback names SHALL use `'rezics-sans'`, `'rezics-serif'`, `'rezics-mono'` — never `'rzc-sans'` etc.

#### Scenario: No legacy prefix remains

- **WHEN** `rg "rzc"` is run from the repository root
- **THEN** there SHALL be zero matches in source files, MDX docs, OpenSpec plans, and Storybook configs

#### Scenario: Tokens declared on `:root`

- **WHEN** `package/ui/src/shared/styles/layers.css` is parsed
- **THEN** the `:root` selector SHALL declare `--rezics-color-*`, `--rezics-space-*`, `--rezics-radius-*`, `--rezics-motion-*`, `--rezics-ease-*`, `--rezics-shadow-*`, and `--rezics-font-*` custom properties

#### Scenario: Dark mode override

- **WHEN** `[data-theme="dark"]` (or its transitional alias `html.dark`) is set on the document
- **THEN** `--rezics-color-surface-canvas`, `--rezics-color-text-primary`, `--rezics-color-text-brand`, and the other mode-sensitive tokens SHALL switch to their dark-mode values
- **AND** `--rezics-color-brand-fill` SHALL remain `#f4606c` in both modes (it is a fill, not text)

### Requirement: Brand color contrast policy

The brand color `#f4606c` (轮回红) SHALL be used as a UI fill (button background, badge fill, focus ring, icon fill, decorative accent) but SHALL NOT be used as a text color. Brand-colored text SHALL route through `--rezics-color-text-brand` (`#C4433A` light / `#fa7882` dark), which is contrast-verified for AA-body on its corresponding canvas.

#### Scenario: Body text using brand fill is forbidden

- **WHEN** any UI surface renders body text (paragraph, label, caption sized < 18px regular and < 14px bold)
- **THEN** the text color SHALL NOT be `#f4606c` or `var(--rezics-color-brand-fill)`
- **AND** any brand-colored body text SHALL use `var(--rezics-color-text-brand)`

#### Scenario: `text-brand` exists for both modes

- **WHEN** `package/ui/src/shared/styles/layers.css` is parsed
- **THEN** `--rezics-color-text-brand` SHALL be declared on `:root` with the light value `#C4433A`
- **AND** the dark theme block SHALL override it to `#fa7882`

### Requirement: Semantic colors with fill / text-light / text-dark variants

The design system SHALL provide `success`, `warning`, `error`, and `info` semantic colors. Each semantic SHALL expose a `*-fill` token (3:1 UI contrast minimum) and `*-text` tokens contrast-verified for AA-body 4.5:1 against the canvas in each mode. Components SHALL select the variant matching the use case (fill for chips/icons/borders, text for body copy).

#### Scenario: Semantic fill tokens exist

- **WHEN** `--rezics-color-success-fill`, `--rezics-color-warning-fill`, `--rezics-color-error-fill`, `--rezics-color-info-fill` are referenced
- **THEN** all four SHALL resolve to declared values in both light and dark themes

#### Scenario: Semantic text tokens exist with AA-body contrast

- **WHEN** `--rezics-color-success-text`, `--rezics-color-warning-text`, `--rezics-color-error-text`, `--rezics-color-info-text` are referenced
- **THEN** all four SHALL resolve to declared values verified against `--rezics-color-surface-canvas` for AA 4.5:1 in their respective mode

### Requirement: Border-led depth, not shadow-led

Containment SHALL be expressed primarily via `--rezics-color-border-whisper` (default surface boundary, 1px at 8% opacity) and whitespace, not via shadows. Cards, sections, table rows, and panels SHALL NOT carry box-shadow. Shadow tokens SHALL exist only for modal-tier surfaces (dialogs, command palettes, context menus, popovers).

#### Scenario: Whisper border is the default boundary

- **WHEN** `--rezics-color-border-whisper` is referenced
- **THEN** it SHALL resolve to `rgba(0,0,0,0.08)` in light mode and `rgba(255,255,255,0.10)` in dark mode

#### Scenario: Modal-tier shadow tokens exist

- **WHEN** `--rezics-shadow-1`, `--rezics-shadow-2`, `--rezics-shadow-3`, `--rezics-shadow-modal` are referenced
- **THEN** all four SHALL resolve to declared values
- **AND** `--rezics-shadow-modal` SHALL be a 4-layer accumulating stack

### Requirement: Typography uses Latin + CJK layered families

`font-sans`, `font-serif`, and `font-mono` SHALL each compose a Latin face (Inter / Source Serif 4 / CaskaydiaMono) and a CJK face (Source Han Sans / Source Han Serif / Sarasa Mono) via `unicode-range` segmentation. Default CJK region SHALL be Traditional Chinese (`zh-hant`); `:lang(zh-Hans|zh-CN)`, `:lang(ja)`, `:lang(ko)` SHALL switch the active CJK family via the `--rezics-font-sans-cjk` / `--rezics-font-serif-cjk` custom property.

#### Scenario: Font stack includes Latin and CJK in order

- **WHEN** `--rezics-font-sans` is resolved
- **THEN** the `font-family` value SHALL list `'Inter'` first, the local fallback `'rezics-sans'`, and a CJK family before any system fallback

#### Scenario: `:lang()` switches regional CJK

- **WHEN** content carries `lang="zh-hans"` or `lang="ja"` or `lang="ko"` on an ancestor element
- **THEN** the matching `:lang()` rule SHALL override `--rezics-font-sans-cjk` / `--rezics-font-serif-cjk` to the regional Source Han variant

### Requirement: Type scale is viewport-responsive via clamp()

The type scale SHALL define eight size tokens (`text-xs` through `text-3xl`), each authored as `clamp(min, preferred-with-vw, max)` so type scales smoothly with viewport width without manual breakpoints.

#### Scenario: All scale tokens use clamp()

- **WHEN** the typography token module is inspected
- **THEN** every size in `text-xs` / `text-sm` / `text-base` / `text-md` / `text-lg` / `text-xl` / `text-2xl` / `text-3xl` SHALL be a `clamp()` expression
- **AND** the min and max SHALL bracket sensible mobile / desktop sizes per the foundation brief

### Requirement: Line-height policy enforces minimum 1.30

The system SHALL provide `leading-reader` (1.60), `leading-body` (1.55), `leading-ui` (1.40), and `leading-dense` (1.30) tokens. Component code SHALL NOT set numeric `line-height` below `1.30`. Reader content (book content, > 3-paragraph long-form articles) SHALL use `leading-reader`.

#### Scenario: No component sets line-height below 1.30

- **WHEN** `rg "lineHeight: ['"]?1\\b|line-height: 1\\b"` is run across `package/ui/src/`, `package/app/src/`, `package/admin/src/`, `package/editor/src/`, `package/folio/src/`
- **THEN** matches SHALL be either fixed or document the exception inline

### Requirement: Motion respects `prefers-reduced-motion`

`layers.css` SHALL include a global `@media (prefers-reduced-motion: reduce)` rule that collapses `animation-duration` and `transition-duration` to `0ms` for all elements. Component animations SHALL therefore not need to handle the preference individually.

#### Scenario: Global reduced-motion rule exists

- **WHEN** `package/ui/src/shared/styles/layers.css` is parsed
- **THEN** there SHALL be a `@media (prefers-reduced-motion: reduce)` block applying `animation-duration: 0ms !important` and `transition-duration: 0ms !important` to `*`, `*::before`, `*::after`

### Requirement: MUI theme exposes light and dark themes

`@rezics/ui` SHALL export `lightTheme` and `darkTheme` as fully-built MUI theme objects, plus `getTheme(mode)` and `getDynamicTheme(...)` for backward-compatible consumers. Both themes SHALL derive `palette` / `spacing` / `shape` / `typography` / `transitions` from the token modules.

#### Scenario: Light and dark themes export

- **WHEN** `@rezics/ui` is imported
- **THEN** `lightTheme` and `darkTheme` SHALL be available as named exports
- **AND** their `palette.primary.main` SHALL equal `--rezics-color-brand-fill` (`#f4606c`)

#### Scenario: Backward-compatible API preserved

- **WHEN** existing consumers import `getTheme` or `getDynamicTheme`
- **THEN** the imports SHALL resolve and produce themes structurally compatible with prior versions
- **AND** `app` / `admin` / `folio` SHALL compile without changes
