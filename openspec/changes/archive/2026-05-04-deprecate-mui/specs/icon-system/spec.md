## ADDED Requirements

### Requirement: Icon vocabulary is lucide-default with tabler-fallback

The rezics frontend SHALL use `lucide-react` as the default icon source. `@tabler/icons-react` SHALL be used as the named fallback when `lucide-react` lacks a glyph the design needs. No third icon library SHALL be introduced. Both sources SHALL be imported at the named-export level (e.g. `import { Star } from "lucide-react"`); barrel-only imports SHALL NOT be used.

#### Scenario: Default icon need

- **WHEN** a developer (human or AI) selects an icon for any UI element
- **THEN** they SHALL first attempt to find the icon in `lucide-react`
- **AND** SHALL only reach for `@tabler/icons-react` when no fitting `lucide-react` glyph exists

#### Scenario: Third icon library introduction is forbidden

- **WHEN** a pull request adds an icon library other than `lucide-react` or `@tabler/icons-react` to any `package/*/package.json`
- **THEN** code review SHALL block the merge
- **AND** introducing a third source SHALL require an OpenSpec change updating this requirement

#### Scenario: Inline SVG for missing glyphs

- **WHEN** neither `lucide-react` nor `@tabler/icons-react` provides a glyph (e.g. a brand-specific affordance, a vendor logo)
- **THEN** the project SHALL use an inline `<svg>` element authored as a small rezics-owned primitive component
- **AND** SHALL NOT introduce a third icon library

### Requirement: `@tabler/icons-react` is added on first use, not preemptively

`@tabler/icons-react` SHALL be added to the `dependencies` of `@rezics/ui` only when the first tabler glyph is invoked. Preemptive inclusion is forbidden. If no tabler glyph is invoked across the codebase, the dependency SHALL NOT be present.

#### Scenario: Migration completes without tabler

- **WHEN** the migration completes and `rg "from ['\"]@tabler/icons-react"` returns zero matches across `package/*/src/`
- **THEN** `@tabler/icons-react` SHALL NOT appear in any `package/*/package.json`

#### Scenario: First tabler glyph is invoked

- **WHEN** the first source file authors `import { <Glyph> } from "@tabler/icons-react"`
- **THEN** the same change SHALL add `@tabler/icons-react` to `package/ui/package.json` `dependencies`
- **AND** the dependency version SHALL be pinned (no caret-only) consistent with other icon library entries

### Requirement: Canonical mapping table for former MUI icons

The rezics-design AI skill SHALL contain a file `.claude/skills/rezics-design/icons.md` that records the canonical mapping from former `@mui/icons-material` icon names to the chosen replacement (`lucide-react` or `@tabler/icons-react`). The file SHALL list at minimum every icon name that appeared in the codebase at the start of the deprecate-mui change. Each mapping row SHALL state: former MUI name, replacement library, replacement export name, and a one-line rationale when the mapping is non-obvious.

#### Scenario: AI agent looks up icon replacement

- **WHEN** an AI agent or developer needs to replace a former MUI icon
- **THEN** they SHALL consult `.claude/skills/rezics-design/icons.md` first
- **AND** SHALL apply the mapping recorded there

#### Scenario: New mapping needed

- **WHEN** a former MUI icon is encountered that is not in the mapping table
- **THEN** the developer SHALL add the mapping to `icons.md` in the same change that introduces the migration
- **AND** the mapping SHALL prefer `lucide-react` per the default rule

### Requirement: Emoji are content, not UI chrome

Emoji SHALL NOT be used as UI chrome — affordances such as close (✕), menu (☰), disclosure (▶ ▼), star ratings (★), checkmarks (✓), arrows (← →), or any iconographic role. Emoji SHALL only appear as content (in user-generated text, fixtures, and content emoji within posts/comments).

#### Scenario: Emoji as button label

- **WHEN** a button or interactive element renders an emoji as its primary affordance
- **THEN** code review SHALL flag this as a violation of icon policy
- **AND** the emoji SHALL be replaced with a `lucide-react` (or fallback `@tabler/icons-react`) icon

#### Scenario: Emoji in user content

- **WHEN** a user-authored post, comment, review, or message contains emoji
- **THEN** the emoji SHALL render as content unchanged
- **AND** the icon-policy SHALL NOT apply to user content

### Requirement: Icon size and color derive from tokens

Icon size SHALL be controlled via UnoCSS class width/height utilities (e.g. `w-4 h-4`, `w-5 h-5`, `w-6 h-6`) deriving from the `--rezics-space-*` token scale. Icon color SHALL inherit from `currentColor` by default and SHALL be overridden via `text-*` UnoCSS classes deriving from `--rezics-color-*`. Direct `size={…}` numeric props on `lucide-react` icons SHALL be avoided when a UnoCSS class is available.

#### Scenario: Icon sizing via class

- **WHEN** an icon is rendered alongside body text
- **THEN** the icon SHALL receive a `w-N h-N` class matching the surrounding text height (typically `w-4 h-4` for body, `w-5 h-5` for UI affordances, `w-6 h-6` for emphasized buttons)
- **AND** SHALL NOT receive a hard-coded `size={20}` prop

#### Scenario: Icon color inheritance

- **WHEN** an icon is rendered without explicit color
- **THEN** the icon SHALL inherit `currentColor` from its parent
- **AND** color overrides SHALL use `text-*` UnoCSS classes pointing to `--rezics-color-*` tokens
