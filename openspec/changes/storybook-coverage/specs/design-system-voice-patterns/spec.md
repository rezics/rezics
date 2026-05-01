## ADDED Requirements

### Requirement: Patterns doc codifies the abstraction-vs-split rule

`package/ui/src/docs/patterns.mdx` SHALL contain a section titled "Abstraction vs Split" (or a near-equivalent heading containing both words "abstraction" and "split"). The section SHALL state the three-test decision procedure that governs whether case differences become variant props or separate components:

1. **Layout test** — if the JSX/DOM tree shape changes between cases (e.g. cover-on-top vs cover-on-left), SPLIT.
2. **Naming test** — if the cases would receive different nouns in conversation ("the horizontal book card" vs "the compact book card") rather than adjectival modifiers ("the same card but smaller"), SPLIT.
3. **Evolution test** — if over a six-month horizon one case is expected to evolve independently of the other (different prop additions, different consumer base), SPLIT.

When **none** of the three tests fires, the section SHALL prescribe expressing cases as variant props on a single component.

The section SHALL include at minimum two `<Compare>` blocks: one demonstrating a correct SPLIT (e.g. `BookCardHorizontal` vs `BookCardVertical` — different DOM trees) and one demonstrating a correct VARIANT-PROP (e.g. `ReactionBar` size — same DOM, scale tokens swap).

#### Scenario: Section present and tests enumerated

- **WHEN** `package/ui/src/docs/patterns.mdx` is parsed
- **THEN** it SHALL contain a heading whose text includes both "Abstraction" and "Split"
- **AND** the section body SHALL list all three tests by name (Layout, Naming, Evolution)

#### Scenario: Compare blocks render the contrast

- **WHEN** the patterns doc is rendered in the `@rezics/ui` Storybook
- **THEN** the abstraction-vs-split section SHALL show at least two `<Compare>` blocks
- **AND** at least one SHALL demonstrate a SPLIT case and at least one SHALL demonstrate a VARIANT-PROP case

### Requirement: Skill mirror codifies the abstraction-vs-split rule

`.claude/skills/rezics-design/patterns.md` SHALL contain the abstraction-vs-split rule in a section whose heading mirrors the human-readable patterns doc. The three tests SHALL be named identically (Layout test, Naming test, Evolution test) and SHALL prescribe the same SPLIT-or-VARIANT outcomes. The section SHALL include a 10-second decision aid (the "story name" heuristic) that AI agents can apply: if the story names would read as `Default / Compact / Large` use a variant prop; if they read as `Hero / Compact / Sidebar` split.

#### Scenario: Skill mirror present and matches doc

- **WHEN** `.claude/skills/rezics-design/patterns.md` is read
- **THEN** it SHALL contain a section with the abstraction-vs-split rule
- **AND** the three test names SHALL match `package/ui/src/docs/patterns.mdx` exactly (allowing for cosmetic markdown differences)

### Requirement: Patterns doc cites Storybook story IDs

The patterns doc and the AI skill mirror SHALL cite Storybook story IDs (e.g. `Domain/Cards--book-horizontal`, `Domain/Engagement--reaction-bar-medium`) when the rule has a corresponding live story. The citation format SHALL be the Storybook canonical story-ID slug. The doc SHALL NOT describe a pattern in prose alone when a corresponding story exists.

#### Scenario: Citations resolve

- **WHEN** any story-ID citation in `package/ui/src/docs/patterns.mdx` or `.claude/skills/rezics-design/patterns.md` or `.claude/skills/rezics-design/mui-vs-shadcn.md` is checked against the current Storybook build
- **THEN** the cited story SHALL exist in the corresponding package's `storybook-static/index.json`
