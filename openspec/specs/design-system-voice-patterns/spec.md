### Requirement: Voice and Patterns are canonical do/don't references

The rezics design system SHALL provide two canonical reference docs:

- `package/ui/src/docs/voice.mdx` — mood pillars, tone-per-surface table, reference systems, litmus test.
- `package/ui/src/docs/patterns.mdx` — code-level do/don't sections covering layout, cards, buttons, inputs, links, icons, color, typography, spacing, mode handling, mock convention, admin/app density.

Both SHALL render in the `@rezics/ui` Storybook under the `Foundation` tree. They SHALL be the human-readable counterpart to the AI-side `.claude/skills/rezics-design/voice.md` and `.claude/skills/rezics-design/patterns.md`; both surfaces SHALL derive from `openspec/plans/design-system-research/briefs/01-foundation-v1.md` (or its archived successor) so the AI and human voices cannot diverge.

#### Scenario: Voice doc exists and registers in Storybook

- **WHEN** `package/ui/src/docs/voice.mdx` is built into the `@rezics/ui` Storybook
- **THEN** the resulting `storybook-static/index.json` SHALL contain a doc entry titled `Foundation/Voice`

#### Scenario: Patterns doc exists and registers in Storybook

- **WHEN** `package/ui/src/docs/patterns.mdx` is built into the `@rezics/ui` Storybook
- **THEN** the resulting `storybook-static/index.json` SHALL contain a doc entry titled `Foundation/Patterns`

#### Scenario: AI skill mirrors human docs

- **WHEN** `.claude/skills/rezics-design/` is inspected
- **THEN** it SHALL contain `SKILL.md`, `voice.md`, `tokens.md`, `patterns.md`, and `mui-vs-shadcn.md`

### Requirement: Mood is "parchment archive, not glass dashboard"

The voice doc SHALL define the rezics mood as four pillars:

- **Editorial restraint** — pages breathe; headings carry weight through size and spacing, not bold weight or borders.
- **Warm restraint** — parchment `#f5f4ed` and warm dark stone `#1a1a18` are the foundation; pure white and pure black SHALL be forbidden as canvas; the brand color punctuates without dominating.
- **Density when warranted** — `app` is generous; `admin` is dense; each surface earns its rhythm.
- **Quietly expressive** — small delight allowed (press scale to 0.98, 200ms hover), but never decorative shadows, gradients, or animation for its own sake.

#### Scenario: Pure white / black canvas forbidden

- **WHEN** the voice doc is read
- **THEN** it SHALL state that pure `#ffffff` and pure `#000000` are NOT permitted as page canvas
- **AND** it SHALL prescribe parchment / warm-stone tokens instead

### Requirement: Patterns doc is structured do/don't

The patterns doc SHALL present each rule as a `<Compare>` of `<Do>` and `<Dont>` (rendered visual comparisons where the contrast is visual, code-level prose where it is structural). The doc SHALL cover at minimum the following areas:

1. Section / page layout (borderless, whitespace-separated; not bordered card chrome)
2. Cards and surfaces
3. Buttons (brand fill + scale-on-press)
4. Inputs (borderless / underlined defaults)
5. Links (`<SafeLink>` mandatory)
6. Icons (MUI icons; no emoji as UI chrome)
7. Color usage (`brand-fill` as fill, `text-brand` for text)
8. Typography (clamp scale, line-height ≥ 1.30)
9. Spacing (8px scale; section rhythm via `space-8`–`space-12` for app/folio, `space-4`–`space-5` for admin/editor)
10. Mode handling (`[data-theme]` attribute; CSS vars switch instantly)
11. Mock convention (`// MOCK:` comments per `CLAUDE.md`)
12. Admin / app density distinction

#### Scenario: All 12 sections present

- **WHEN** `package/ui/src/docs/patterns.mdx` is parsed
- **THEN** it SHALL contain heading sections for each of the 12 areas above

#### Scenario: Comparisons render visually

- **WHEN** the patterns doc is rendered in Storybook
- **THEN** each `<Compare>` block SHALL show a `<Do>` and `<Dont>` side-by-side with rendered JSX for the visual rules

### Requirement: Hard-Never rules are enumerated and enforced

The voice and patterns docs (and the skill's `patterns.md`) SHALL enumerate the Hard-Never rules — design violations that block PRs:

- **#1**: Brand color `#f4606c` SHALL NOT appear as text color or as a scattered string literal; central constants and `--rezics-color-text-brand` are the only acceptable surfaces.
- **#2**: Pure white `#ffffff` and pure black `#000000` SHALL NOT be used as page canvas backgrounds.
- **#3**: Emoji SHALL NOT be used as UI chrome icons (✕ ☰ ▶ ▼ ★ etc.); MUI Material Icons or shadcn `lucide-react` icons SHALL be used. Content emoji (in user-generated text, fixtures) is acceptable.
- **#4**: Raw `<a href>` SHALL NOT be used for outbound links; `<SafeLink>` from `@rezics/ui` SHALL be used (covered by `outbound-link-protection` spec).
- **#5**: `line-height` SHALL NOT be set below `1.30`.
- **#6**: Section / card / panel surfaces SHALL NOT carry decorative `box-shadow`; shadows are reserved for modal-tier surfaces.

#### Scenario: Hard-Never list authoritative

- **WHEN** the AI skill at `.claude/skills/rezics-design/SKILL.md` is read
- **THEN** the Hard-Never section SHALL match the rules above (allowing for cosmetic wording differences)
- **AND** any addition or removal SHALL be paired with an OpenSpec change updating this requirement

### Requirement: MUI-first component policy

The system SHALL prescribe MUI as the primary component library, shadcn / Radix as supplements when MUI lacks a fitting primitive, and custom unthemed components as a last resort. The `mui-vs-shadcn.md` skill file SHALL document the selection table and decision flows for modal, form, and empty-state cases.

#### Scenario: Selection table exists in skill

- **WHEN** `.claude/skills/rezics-design/mui-vs-shadcn.md` is read
- **THEN** it SHALL contain a selection table with rows for at minimum: modal, form, button, table, empty-state, navigation
- **AND** for each row SHALL identify the recommended source (MUI / shadcn / custom) with rationale

### Requirement: Tone-per-surface table

The voice doc SHALL specify tone per surface so that `@rezics/app`, `@rezics/folio`, `@rezics/editor`, and `@rezics/admin` use distinguishable but coherent voices. At minimum:

- **App (browse / library)** — generous, editorial, restful.
- **Folio (reader)** — quiet, immersive, serif-led.
- **Editor** — focused, chrome-light, mono-led for technical contexts.
- **Admin** — dense, efficient, sans-led, smaller type, tighter rhythm.

#### Scenario: Tone table explicit

- **WHEN** `package/ui/src/docs/voice.mdx` is read
- **THEN** it SHALL contain a tone-per-surface table covering at minimum the 4 surfaces above
