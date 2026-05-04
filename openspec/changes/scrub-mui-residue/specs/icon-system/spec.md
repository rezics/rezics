## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Canonical mapping table for former MUI icons

**Reason**: The `deprecate-mui` migration is complete and archived. No source file imports from `@mui/icons-material`, so the "former MUI name → replacement" mapping no longer serves an active purpose. The skill file `.claude/skills/rezics-design/icons.md` is rewritten in this change to drop the MUI column entirely; the right-hand list of approved icons by category remains as the canonical guidance for non-brand icons. Keeping the mapping table would require AI agents to absorb obsolete MUI vocabulary that has no application in the current codebase.

**Migration**: Delete the MUI → lucide / tabler mapping table from `.claude/skills/rezics-design/icons.md`. The remaining sections (brand-icon table, non-brand category lists, sizing/color guidance) stay. Any future need for a "renamed-to" pointer is handled by ad-hoc grep and skill updates rather than a frozen historical mapping.
