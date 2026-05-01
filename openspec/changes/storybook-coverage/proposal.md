## Why

The `establish-design-system` change shipped a foundation (tokens, MUI theme, UnoCSS preset, `--rezics-*` namespace), a Storybook composition site (5 packages + host), 6 MDX token galleries, voice/patterns docs, and per-package adoption audits. What it did **not** do is populate Storybook with the actual component surface area. The result is a documentation site that documents the system's *foundation* but not its *application* — a designer or AI agent landing on Storybook today sees tokens, but cannot see how a `BookCard`, a `ReactionBar`, or a `PostTree` renders, what its variants look like, or how it behaves with empty / loading / long-content data.

This change builds out coverage. It also closes three small abstraction gaps the cosmos migration exposed (`GreenButton`/`OrangeButton`/`RoseButton` triplet, the `ReviewCard` 2up naming, the latent `<DomainCarousel>` API behind four near-identical wrappers), and codifies the **abstraction-vs-split** rule that should govern future component design — the rule the recent migration kept tripping on.

## What Changes

- **ADDED**: ~80 new component stories across `@rezics/ui` (Tier 1 primitives + Tier 2 composites) and `@rezics/app` (Tier 3 domain atoms + Tier 4 domain composites), each authored as `*.stories.tsx` co-located with the source component, named exports per state (`Default · Empty · Loading · Error · LongContent · Compact · Hero · Disabled` — closed vocabulary).
- **ADDED**: Six MDX overview pages under `package/app/src/docs/` clustering related stories with prose context — `Engagement.mdx`, `Cards.mdx`, `Posts.mdx`, `Shelves.mdx`, `Search.mdx`, `Profile.mdx`.
- **ADDED**: Central per-domain mock-data module at `package/app/src/stories/fixtures/{book,post,shelf,review,excerpt,remark,user,realm,notification,tag}.ts`, all entries marked `// MOCK:` per project convention. Shapes are hand-authored to match the runtime types but **do not** import from `prisma/factory/`.
- **ADDED**: `<DomainCarousel>` generic in `@rezics/ui` (`renderItem` + items API). Four `Horizontal{Book,Review,Excerpt,Shelf}Carousel` wrappers in `@rezics/app` collapse to thin domain shims that delegate to it.
- **ADDED**: `<ColorfulButton color="green|orange|rose">` consolidating the three single-color sibling files in `@rezics/ui`. The three `*Button.tsx` source files are removed; existing call sites updated.
- **ADDED**: `@storybook/addon-a11y@^10` enabled in shared `@rezics/storybook-config` with warnings-only severity. Every story shown in Storybook surfaces an a11y panel.
- **ADDED**: Scripted `play()` interaction stories for six critical forms — `ReplyComposer`, `ReviewForm`, `RemarkInlineForm`, `AuthModal`, `OtpInput`, `TokenCreateDialog` — covering the typical happy path (open → fill → submit → success-state) without backend.
- **ADDED**: Locale-axis stories (CJK + Latin long-string variants) for five text-heavy cards: `BookCard`, `ReviewCard`, `ExcerptCard`, `RemarkCard`, `ShelfCard`.
- **MODIFIED**: `ReviewCard` 2up renamed to `ReviewCardPair`. Composer, not variant. Existing `ReviewCard` keeps its name and atoms-only role.
- **MODIFIED**: `package/ui/src/docs/patterns.mdx` and `.claude/skills/rezics-design/patterns.md` gain a new section codifying the **abstraction-vs-split rule** (layout test, naming test, evolution test).
- **MODIFIED**: `.claude/skills/rezics-design/mui-vs-shadcn.md` and `patterns.md` cross-reference Storybook story IDs (e.g. `Domain/Cards/BookCard--horizontal`) so the skill's recommendations cite concrete examples instead of describing them.
- **NOT IN SCOPE**: Promotion of any `@rezics/app` atoms (`ReactionBar`, etc.) into `@rezics/ui`. Components stay where they live this round; promotion criteria are a future concern.
- **NOT IN SCOPE**: Tier-5 page templates beyond a token-illustrative cap of three (Homepage row stack, Book detail, Profile) marked illustrative-not-canonical.
- **NOT IN SCOPE**: The deferred large refactors from the prior adoption audits (editor `MarkdownEditor.css` palette, editor toolbar chrome, `package/folio/src/styles/theme.ts` reader theme tokenization). Those remain on their own dedicated PR tracks per `design-system-adoption` Requirement-3.
- **NOT IN SCOPE**: Storybook PR previews / hosted deployment, Chromatic visual regression, addon-test runner. Local static dist remains the deliverable.

## Capabilities

### New Capabilities
- `storybook-coverage`: Story authoring conventions (file location, naming vocabulary, per-component scope), per-package coverage targets, a11y addon policy, mock-data architecture, and the abstraction-vs-split rule that components SHALL satisfy before being authored or refactored.

### Modified Capabilities
- `design-system-storybook`: Adds the `@storybook/addon-a11y` requirement, the requirement that `@rezics/storybook-config` ships the addon and play-function support, and the requirement that overview MDX docs cluster related stories per package.
- `design-system-voice-patterns`: Adds the abstraction-vs-split rule as a required `patterns.mdx` (and skill `patterns.md`) section, with the layout / naming / evolution test triplet as the canonical decision procedure.

## Impact

- **Affected packages**:
  - `@rezics/ui` — `<DomainCarousel>` added, `<ColorfulButton>` added, three `*Button.tsx` removed, `patterns.mdx` updated.
  - `@rezics/app` — ~60 new `*.stories.tsx`, six `docs/*.mdx` overview pages, `stories/fixtures/` module, four carousel wrappers thinned to delegate, `ReviewCard` 2up renamed to `ReviewCardPair` and existing imports updated.
  - `@rezics/storybook-config` — adds `@storybook/addon-a11y` to the shared addon list, exposes a `playFunctionsEnabled` flag (default true).
  - `@rezics/folio`, `@rezics/admin`, `@rezics/editor` — no story expansion; remain at cosmos-parity. Folio adds one `Reader` theme-axis story (parity+1).
  - `.claude/skills/rezics-design/` — `patterns.md` and `mui-vs-shadcn.md` updated with abstraction-vs-split rule and story-ID citations.
- **Dependencies added**: `@storybook/addon-a11y@^10` (workspace devDependency on `@rezics/storybook-config`).
- **Dependencies removed**: None.
- **APIs**:
  - `<ColorfulButton color>` is a new public export of `@rezics/ui`. The three deleted button names (`GreenButton`, `OrangeButton`, `RoseButton`) are gone — call sites must migrate. The cosmos-period stories that were renamed to `*.stories.tsx` are updated in-place.
  - `<DomainCarousel items renderItem>` is a new public export of `@rezics/ui`. Existing `Horizontal{Book,Review,Excerpt,Shelf}Carousel` exports preserved as thin wrappers; their public prop API is unchanged.
  - `ReviewCardPair` is a new public export; `ReviewCard` retains its name. The previously-unexported `VerticalTwoReviewCard` is removed.
- **Backward compatibility**:
  - The four existing horizontal-carousel exports keep their prop APIs; only their internals change.
  - `ReviewCard` external prop API is unchanged. `VerticalTwoReviewCard` was internal — no external migration.
  - The three single-color button names are removed without aliases; this is a breaking change to internal API only (no external consumers exist outside the monorepo). Codemod-style sweep is mechanical (`GreenButton` → `<ColorfulButton color="green">` etc.).
  - All Storybook additions are additive; foundation, voice/patterns, and adoption specs are not modified, only augmented in two requirements each.
- **Migration**: A single PR-time `rg` sweep updates `GreenButton`/`OrangeButton`/`RoseButton` references to `ColorfulButton`. `VerticalTwoReviewCard` references update to `ReviewCardPair`. No data migration; no environment changes.
