# icon-system Specification

## Purpose

Defines the rezics frontend's icon vocabulary. Brand marks come from `@rezics/icons` (the project's first-party brand-icon library); non-brand glyphs default to `lucide-react`, with `@tabler/icons-react` as the named fallback. Emoji are content, not UI chrome. Icon size and color derive from the `--rezics-*` token scale.

## Requirements
### Requirement: Brand icons come from `@rezics/icons`

Brand marks for third-party services (Github, Google, Microsoft, Telegram, X / Twitter, Facebook, Instagram, Apple, Discord, LinkedIn, Reddit, YouTube, TikTok, Spotify, Twitch, Pinterest, Snapchat, Signal, Skype, Tumblr, VK, Meta, MetaMask, Medium, Dribbble, Figma, and any others the package ships) SHALL be imported from `@rezics/icons`, the project's first-party brand-icon library. Brand icons SHALL NOT be imported from `lucide-react` or `@tabler/icons-react`. The colored `*Icon` exports paint canonical brand colors; the `*GrayIcon` exports use `currentColor` for token-driven theming. Either variant is acceptable per the surface's needs.

#### Scenario: Brand icon need

- **WHEN** a developer (human or AI) selects an icon to identify a third-party service (footer social link, share dialog, OAuth provider button, account-linking row, etc.)
- **THEN** the icon SHALL be imported from `@rezics/icons`
- **AND** SHALL NOT be imported from `lucide-react` or `@tabler/icons-react`

#### Scenario: Brand glyph missing from `@rezics/icons`

- **WHEN** a brand glyph is needed that `@rezics/icons` does not yet export
- **THEN** the developer SHALL extend `@rezics/icons` (publish a new version) rather than reach for `lucide-react` or `@tabler/icons-react` as a workaround
- **AND** SHALL update the brand-icons section of `.claude/skills/rezics-design/icons.md` in the same change

#### Scenario: Existing brand-icon import is a regression

- **WHEN** code review or the convention check encounters a brand glyph imported from `lucide-react` (e.g. `Github`, `Facebook`, `Instagram`) or `@tabler/icons-react` (e.g. `IconBrandGithub`, `IconBrandTelegram`, `IconBrandTwitter`, `IconBrandGoogle`)
- **THEN** the import SHALL be replaced with the equivalent `@rezics/icons` export
- **AND** the migration SHALL not introduce a tabler/lucide brand-icon import as an interim step

### Requirement: Non-brand icon vocabulary is lucide-default with tabler-fallback

The rezics frontend SHALL use `lucide-react` as the default source for **non-brand** glyphs. `@tabler/icons-react` SHALL be used as the named fallback when `lucide-react` lacks a non-brand glyph the design needs. No fourth icon library SHALL be introduced (the three permitted sources are `@rezics/icons` for brand marks, `lucide-react` for non-brand glyphs, `@tabler/icons-react` for the non-brand fallback). All sources SHALL be imported at the named-export level (e.g. `import { Star } from "lucide-react"`, `import { GithubIcon } from "@rezics/icons"`); barrel-only imports SHALL NOT be used.

#### Scenario: Default icon need

- **WHEN** a developer (human or AI) selects a non-brand icon for any UI element
- **THEN** they SHALL first attempt to find the icon in `lucide-react`
- **AND** SHALL only reach for `@tabler/icons-react` when no fitting `lucide-react` glyph exists

#### Scenario: Fourth icon library introduction is forbidden

- **WHEN** a pull request adds an icon library other than `@rezics/icons`, `lucide-react`, or `@tabler/icons-react` to any `package/*/package.json`
- **THEN** code review SHALL block the merge
- **AND** introducing a fourth source SHALL require an OpenSpec change updating this requirement

#### Scenario: Inline SVG for missing non-brand glyphs

- **WHEN** neither `lucide-react` nor `@tabler/icons-react` provides a non-brand glyph (custom affordances specific to rezics)
- **THEN** the project SHALL use an inline `<svg>` element authored as a small rezics-owned primitive component under `package/ui/src/primitive/icon/`
- **AND** SHALL NOT introduce a fourth icon library

### Requirement: `@tabler/icons-react` is added on first use, not preemptively

`@tabler/icons-react` SHALL be added to the `dependencies` of `@rezics/ui` only when the first tabler glyph is invoked. Preemptive inclusion is forbidden. If no tabler glyph is invoked across the codebase, the dependency SHALL NOT be present.

#### Scenario: Migration completes without tabler

- **WHEN** the migration completes and `rg "from ['\"]@tabler/icons-react"` returns zero matches across `package/*/src/`
- **THEN** `@tabler/icons-react` SHALL NOT appear in any `package/*/package.json`

#### Scenario: First tabler glyph is invoked

- **WHEN** the first source file authors `import { <Glyph> } from "@tabler/icons-react"`
- **THEN** the same change SHALL add `@tabler/icons-react` to `package/ui/package.json` `dependencies`
- **AND** the dependency version SHALL be pinned (no caret-only) consistent with other icon library entries

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
