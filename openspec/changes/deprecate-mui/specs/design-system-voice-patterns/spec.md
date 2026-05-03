## MODIFIED Requirements

### Requirement: Hard-Never rules are enumerated and enforced

The voice and patterns docs (and the skill's `patterns.md`) SHALL enumerate the Hard-Never rules — design violations that block PRs:

- **#1**: Brand color `#f4606c` SHALL NOT appear as text color or as a scattered string literal; central constants and `--rezics-color-text-brand` are the only acceptable surfaces.
- **#2**: Pure white `#ffffff` and pure black `#000000` SHALL NOT be used as page canvas backgrounds.
- **#3**: Emoji SHALL NOT be used as UI chrome icons (✕ ☰ ▶ ▼ ★ etc.); `lucide-react` icons SHALL be used by default, with `@tabler/icons-react` as the named fallback when lucide lacks a glyph. Content emoji (in user-generated text, fixtures) is acceptable.
- **#4**: Raw `<a href>` SHALL NOT be used for outbound links; `<SafeLink>` from `@rezics/ui` SHALL be used (covered by `outbound-link-protection` spec).
- **#5**: `line-height` SHALL NOT be set below `1.30`.
- **#6**: Section / card / panel surfaces SHALL NOT carry decorative `box-shadow`; shadows are reserved for modal-tier surfaces.
- **#7**: `@mui/*` imports SHALL NOT appear in any source file under `package/*/src/`. The full prohibition is captured in the `ui-component-foundation` spec; this Hard-Never entry is the design-system-side surface of the same rule.

#### Scenario: Hard-Never list authoritative

- **WHEN** the AI skill at `.claude/skills/rezics-design/SKILL.md` is read
- **THEN** the Hard-Never section SHALL match the rules above (allowing for cosmetic wording differences)
- **AND** any addition or removal SHALL be paired with an OpenSpec change updating this requirement

### Requirement: Patterns doc is structured do/don't

The patterns doc SHALL present each rule as a `<Compare>` of `<Do>` and `<Dont>` (rendered visual comparisons where the contrast is visual, code-level prose where it is structural). The doc SHALL cover at minimum the following areas:

1. Section / page layout (borderless, whitespace-separated; not bordered card chrome)
2. Cards and surfaces
3. Buttons (brand fill + scale-on-press)
4. Inputs (borderless / underlined defaults)
5. Links (`<SafeLink>` mandatory)
6. Icons (`lucide-react` default; `@tabler/icons-react` named fallback; no emoji as UI chrome)
7. Color usage (`brand-fill` as fill, `text-brand` for text)
8. Typography (clamp scale, line-height ≥ 1.30)
9. Spacing (8px scale; section rhythm via `space-8`–`space-12` for app/folio, `space-4`–`space-5` for admin/editor)
10. Mode handling (`[data-theme]` attribute; CSS vars switch instantly; no MUI ThemeProvider)
11. Mock convention (`// MOCK:` comments per `CLAUDE.md`)
12. Admin / app density distinction

#### Scenario: All 12 sections present

- **WHEN** `package/ui/src/docs/patterns.mdx` is parsed
- **THEN** it SHALL contain heading sections for each of the 12 areas above

#### Scenario: Comparisons render visually

- **WHEN** the patterns doc is rendered in Storybook
- **THEN** each `<Compare>` block SHALL show a `<Do>` and `<Dont>` side-by-side with rendered JSX for the visual rules

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
- **THEN** it SHALL contain `SKILL.md`, `voice.md`, `tokens.md`, `patterns.md`, `component-selection.md`, and `icons.md`

## REMOVED Requirements

### Requirement: MUI-first component policy

**Reason:** The component selection policy is replaced by the shadcn-or-custom policy defined in the `ui-component-foundation` spec. MUI is removed from runtime, dependencies, and the skill. The `mui-vs-shadcn.md` skill file is replaced by `component-selection.md` reflecting the new two-source vocabulary.

**Migration:** The skill file `.claude/skills/rezics-design/mui-vs-shadcn.md` is renamed to `.claude/skills/rezics-design/component-selection.md` and rewritten to document the shadcn-or-custom decision flow. The `SKILL.md` index, the patterns doc, and the voice doc are updated to point to the new file.

## ADDED Requirements

### Requirement: shadcn-or-custom component policy

The system SHALL prescribe `@rezics/ui/shadcn` primitives (Radix-based, token-aligned) as the default UI component source, and rezics-owned custom primitives under `@rezics/ui/primitive/` and `@rezics/ui/composite/` as the alternative when shadcn does not cover the case. The `.claude/skills/rezics-design/component-selection.md` skill file SHALL document the selection table and decision flows for modal, form, button, table, empty-state, navigation, and rating-input cases. There SHALL NOT be a third option (no Material-UI, no Ant Design, no Chakra, etc.).

#### Scenario: Selection table exists in skill

- **WHEN** `.claude/skills/rezics-design/component-selection.md` is read
- **THEN** it SHALL contain a selection table with rows for at minimum: modal, form, button, table, empty-state, navigation, rating-input
- **AND** for each row SHALL identify the recommended source (shadcn / custom) with rationale
- **AND** SHALL NOT recommend MUI for any row

#### Scenario: AI agent picking a primitive

- **WHEN** an AI agent encounters a UI authoring task
- **THEN** it SHALL consult `.claude/skills/rezics-design/component-selection.md` for the source decision
- **AND** SHALL pick from `@rezics/ui/shadcn` first
- **AND** SHALL fall back to a custom primitive only when shadcn does not cover the case

### Requirement: Icon vocabulary references the icon-system spec

The voice and patterns docs SHALL reference the `icon-system` capability spec for the authoritative icon-vocabulary policy (`lucide-react` default, `@tabler/icons-react` named fallback, emoji-not-as-chrome). The patterns doc SHALL NOT redefine these rules; it SHALL reference the icon-system spec by name and the `.claude/skills/rezics-design/icons.md` mapping table.

#### Scenario: Patterns doc references icon-system spec

- **WHEN** `package/ui/src/docs/patterns.mdx` is read
- **THEN** the icons section SHALL reference the `icon-system` capability and the `icons.md` skill mapping table
- **AND** SHALL NOT duplicate the icon-vocabulary normative statements
