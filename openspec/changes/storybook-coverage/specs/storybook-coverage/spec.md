## ADDED Requirements

### Requirement: Per-package Storybook coverage targets

Storybook coverage SHALL be governed by per-package targets that distinguish full coverage from parity-only packages. The targets SHALL be:

| Package          | Coverage policy   | Story count target            |
| ---------------- | ----------------- | ----------------------------- |
| `@rezics/ui`     | Full              | ≥ 30 stories                  |
| `@rezics/app`    | Full              | ≥ 60 stories                  |
| `@rezics/folio`  | Cosmos parity + 1 | ≥ 6 stories (includes Reader theme axis) |
| `@rezics/editor` | Cosmos parity     | ≥ 9 stories                   |
| `@rezics/admin`  | Cosmos parity     | ≥ 1 story                     |

The "full" tier SHALL cover Tier 1 (primitives), Tier 2 (composites), Tier 3 (domain atoms), and Tier 4 (domain composites). Tier 5 (page templates) SHALL be capped at 3 stories total across all packages and SHALL be marked illustrative-not-canonical in the story description.

#### Scenario: Story counts meet targets

- **WHEN** each package's `storybook-static/index.json` is inspected after a clean `bun run build-storybook` in that package
- **THEN** the count of `type: "story"` and `type: "docs"` entries combined SHALL meet or exceed the package's target above

#### Scenario: Tier 5 cap respected

- **WHEN** the union of all package `index.json` story IDs is filtered to those whose meta `category` or `title` prefix is `Page/` (or equivalent Tier-5 marker)
- **THEN** there SHALL be at most 3 such entries
- **AND** each SHALL include in its `parameters.docs.description.story` (or `meta.parameters`) the marker "illustrative-not-canonical"

### Requirement: Stories are co-located with source

Every component story SHALL live as `<Component>.stories.tsx` in the **same directory** as the component it documents. Cluster files (one stories file documenting multiple unrelated components) SHALL NOT be used. Each story file SHALL contain exactly one default-export `Meta` and document exactly one component.

#### Scenario: One stories file per component

- **WHEN** any `*.stories.tsx` file in `package/{ui,app,folio,editor,admin}/src/` is parsed
- **THEN** it SHALL have exactly one `default export` of type `Meta`
- **AND** the `Meta.component` field SHALL reference exactly one component import

#### Scenario: Story sits next to source

- **WHEN** any `<Component>.stories.tsx` exists at path `<dir>/<Component>.stories.tsx`
- **THEN** there SHALL be a corresponding `<Component>.tsx` in the same `<dir>`

### Requirement: Story names use a closed vocabulary

Story names (the named exports in a `.stories.tsx` file) SHALL be drawn from a closed vocabulary appropriate to the component's tier. The base vocabulary SHALL be:

- **State names**: `Default`, `Empty`, `Loading`, `Error`, `LongContent`, `Disabled`
- **Variant names**: `Compact`, `Hero`, `Horizontal`, `Vertical`, `Small`, `Medium`, `Large`
- **Mode names**: `Light`, `Dark` (only for Tier 0/1 where mode is the message; otherwise rely on the global toolbar)
- **Locale names**: `LocaleCJK`, `LocaleLatin` (only for Tier 3 text-heavy cards)
- **Interaction names** (with `play` function): `HappyPath`, `WithError`, `Submitting`

A component MAY use any subset; it SHALL NOT invent new names without proposing an addition to the vocabulary in this spec.

#### Scenario: Vocabulary respected

- **WHEN** a story file is reviewed
- **THEN** every named export SHALL match one of the names listed above (allowing for namespacing suffixes like `LongContentChinese` only when the locale rule applies)

### Requirement: Mock data lives in a central per-domain module

Story-only mock data SHALL live in `package/app/src/stories/fixtures/<domain>.ts` modules, one per domain (book, post, shelf, review, excerpt, remark, user, realm, notification, tag). Stories SHALL import from these modules; they SHALL NOT inline domain shapes beyond trivial overrides. Every export from a fixtures module SHALL carry a `// MOCK:` comment per `CLAUDE.md` Mock convention. Fixtures SHALL NOT import from `package/server/prisma/factory/` — fixture shapes match runtime types by hand.

#### Scenario: Fixtures module structure

- **WHEN** `package/app/src/stories/fixtures/` is listed
- **THEN** it SHALL contain at minimum these modules: `book.ts`, `post.ts`, `shelf.ts`, `review.ts`, `excerpt.ts`, `remark.ts`, `user.ts`, `realm.ts`, `notification.ts`, `tag.ts`
- **AND** each SHALL export at least one entry tagged with `// MOCK:` and at least one collection (`*Many`, `*Few`, `*Empty`) where applicable

#### Scenario: No factory imports

- **WHEN** `rg "from .*prisma/factory" package/app/src/stories/` is run
- **THEN** there SHALL be zero matches

#### Scenario: Stories prefer central fixtures

- **WHEN** `*.stories.tsx` files in `package/app/src/` are reviewed
- **THEN** they SHALL import data from `~/stories/fixtures/<domain>` for any domain entity beyond trivial primitive overrides

### Requirement: Per-cluster MDX overview docs

Six MDX overview docs SHALL exist in `package/app/src/docs/` to cluster related stories with prose context. Each SHALL register in the `@rezics/app` Storybook under a `Domain/<Cluster>` doc tree. The six clusters SHALL be:

- `Engagement.mdx` — `ReactionBar`, `VoteGroup`, `ReplyAction`, `ShareAction`, `ShelfAction`, `OverflowMenu`
- `Cards.mdx` — `BookCard` (H/V), `ReviewCard`, `ReviewCardPair`, `ExcerptCard`, `RemarkCard`, `ShelfCard`, `RealmCard`
- `Posts.mdx` — `PostCard`, `PostReply`, `ThreadingRail`, `ReplyComposer`, `PostTreeSection` shapes
- `Shelves.mdx` — `ShelfCard`, `ShelfItemCard`, `ShelfDiscussionSection`, view modes
- `Search.mdx` — `TextSearchInput` family, the 11 filter primitives, `AppliedFilterChips`
- `Profile.mdx` — `ProfileBasicInfo`, `ProfileTabBar`, settings shells

Each overview doc SHALL state the cluster's intent in 2–4 sentences, embed the relevant stories via `<Story>` blocks (or `<Canvas>`), and cross-reference the abstraction-vs-split rule from `Foundation/Patterns`.

#### Scenario: Six docs registered

- **WHEN** `bun -F @rezics/app run build-storybook` is run
- **THEN** the resulting `storybook-static/index.json` SHALL contain doc entries titled `Domain/Engagement`, `Domain/Cards`, `Domain/Posts`, `Domain/Shelves`, `Domain/Search`, `Domain/Profile`

#### Scenario: Each doc embeds its cluster

- **WHEN** any of the six cluster MDX files is parsed
- **THEN** it SHALL include at least one `<Story>` or `<Canvas>` block referencing a story whose component is in that cluster

### Requirement: a11y addon enabled with warnings-only severity

The shared `@rezics/storybook-config` SHALL include `@storybook/addon-a11y@^10` in its addon list. The addon SHALL be configured at warning severity — failures SHALL surface in the Storybook UI panel but SHALL NOT block builds. Each package's preview SHALL inherit the addon via the shared config without per-package opt-in.

#### Scenario: Addon present in shared config

- **WHEN** `package/storybook-config/src/` (or its built output) is inspected
- **THEN** `@storybook/addon-a11y` SHALL appear in the exported `baseStorybookConfig.addons` array

#### Scenario: Build does not fail on a11y warnings

- **WHEN** `bun run build-storybook` is run at the root
- **THEN** the build SHALL succeed even if individual stories emit a11y warnings
- **AND** the warnings SHALL be visible when the Storybook is served and a story is opened

### Requirement: Critical forms have play-function interaction stories

Six critical forms SHALL have at least one named export using a `play` function that scripts the happy-path interaction (open → fill → submit → success state) without backend dependency. The six forms SHALL be:

- `ReplyComposer`, `ReviewForm`, `RemarkInlineForm`, `AuthModal`, `OtpInput`, `TokenCreateDialog`

Each form's stories file SHALL include at minimum a `Default` (no `play`) and a `HappyPath` (with `play`).

#### Scenario: Each critical form has a HappyPath story

- **WHEN** the stories file for any of the six critical forms is parsed
- **THEN** it SHALL export a story named `HappyPath`
- **AND** that story's object SHALL define a `play` function

### Requirement: Locale-axis stories for text-heavy cards

Five text-heavy card components SHALL each have a `LocaleCJK` and a `LocaleLatin` story showing the card with realistically long strings in Simplified Chinese and English respectively. The five SHALL be: `BookCard`, `ReviewCard`, `ExcerptCard`, `RemarkCard`, `ShelfCard`.

#### Scenario: CJK and Latin variants present

- **WHEN** the stories file for any of the five locale-axis cards is parsed
- **THEN** it SHALL export both a `LocaleCJK` and a `LocaleLatin` story
- **AND** the corresponding fixtures SHALL contain strings ≥ 80 characters in their respective scripts

### Requirement: Abstraction-vs-split rule

A new component SHALL be split rather than expressed as a variant prop on an existing component when **any one** of the following tests fires:

1. **Layout test** — the JSX/DOM tree shape changes between cases (e.g. cover-on-top vs cover-on-left).
2. **Naming test** — the cases would receive different nouns in conversation ("the horizontal book card" vs "the compact book card") rather than adjectival modifiers ("the same card but smaller").
3. **Evolution test** — over a six-month horizon, one case is expected to evolve independently of the other (different prop additions, different consumer base).

When **none** of the three tests fires, cases SHALL be expressed as variant props on a single component (e.g. `size="sm|md|lg"`, `color="green|orange|rose"`).

This rule SHALL be codified in both `package/ui/src/docs/patterns.mdx` (the human-readable canonical reference) and `.claude/skills/rezics-design/patterns.md` (the AI-side mirror).

#### Scenario: Rule documented in both surfaces

- **WHEN** `package/ui/src/docs/patterns.mdx` is parsed
- **THEN** it SHALL contain a heading section titled "Abstraction vs Split" (or equivalent) listing the three tests
- **AND** the same rule SHALL appear in `.claude/skills/rezics-design/patterns.md` with matching test names

#### Scenario: ColorfulButton consolidates color-only variants

- **WHEN** `package/ui/src/primitive/button/colorful/` is inspected
- **THEN** it SHALL contain a single `ColorfulButton.tsx` exporting a component accepting `color: "green" | "orange" | "rose"`
- **AND** there SHALL be no `GreenButton.tsx`, `OrangeButton.tsx`, or `RoseButton.tsx` files

#### Scenario: ReviewCardPair separates from ReviewCard

- **WHEN** the review feature is inspected
- **THEN** `ReviewCard.tsx` SHALL exist as a single-card atom
- **AND** `ReviewCardPair.tsx` SHALL exist as a composer that arranges two `ReviewCard` instances
- **AND** the previous `VerticalTwoReviewCard` name SHALL not appear in source

### Requirement: DomainCarousel generic with renderItem API

`@rezics/ui` SHALL export a generic `<DomainCarousel<TItem>>` component accepting `items: TItem[]`, `renderItem: (item: TItem) => ReactNode`, and the existing carousel chrome props (arrows, indicators, scroll behavior). The four `Horizontal{Book,Review,Excerpt,Shelf}Carousel` wrappers in `@rezics/app` SHALL collapse to thin domain shims that delegate to it; their existing public prop APIs SHALL be preserved so call sites do not change.

#### Scenario: Generic exists in ui

- **WHEN** `package/ui/src/composite/carousel/` (or equivalent) is listed
- **THEN** it SHALL contain a `DomainCarousel.tsx` exporting a generic component as described
- **AND** it SHALL be re-exported from the `@rezics/ui` package barrel

#### Scenario: Wrappers delegate

- **WHEN** any of `HorizontalBookCarousel`, `HorizontalReviewCarousel`, `HorizontalExcerptCarousel`, `HorizontalShelfCarousel` source is read
- **THEN** the implementation SHALL render `<DomainCarousel>` directly (or via a one-line wrapper) and SHALL NOT duplicate carousel chrome logic
- **AND** the public exported prop API SHALL match what existed before this change

### Requirement: Skill cites Storybook story IDs

`.claude/skills/rezics-design/mui-vs-shadcn.md` and `.claude/skills/rezics-design/patterns.md` SHALL cite Storybook story IDs (e.g. `Domain/Cards/BookCard--horizontal`) when recommending or describing a component pattern. The skill SHALL NOT describe a pattern in prose alone if a corresponding story exists.

#### Scenario: Citations present

- **WHEN** `.claude/skills/rezics-design/mui-vs-shadcn.md` is read
- **THEN** at minimum the modal, form, empty-state, button, and table rows of its selection table SHALL each cite a story ID drawn from the live Storybook
- **AND** every citation SHALL resolve to a valid story in `storybook-static/index.json` for the package indicated

### Requirement: Promotion of `@rezics/app` atoms is out of scope

This change SHALL NOT promote any `@rezics/app`-resident component into `@rezics/ui`. Components stay in their current packages. A future change MAY introduce a promotion criterion and execute promotions; this spec SHALL NOT prescribe one.

#### Scenario: No app→ui promotions in this change

- **WHEN** the diff for this change is reviewed
- **THEN** no file SHALL be moved from `package/app/src/` into `package/ui/src/`
- **AND** no `@rezics/ui` source file SHALL gain an import from a `@rezics/app` domain folder
