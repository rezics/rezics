## Context

The `establish-design-system` change shipped foundation, multi-package Storybook topology, voice/patterns docs, and adoption audits — all archived. Cosmos is gone (zero artifacts repo-wide). Four canonical specs are in place: `design-system-foundation`, `design-system-storybook`, `design-system-voice-patterns`, `design-system-adoption`.

What survived is a documentation site that documents the *foundation* of the design system but not its *application*. A designer or AI agent landing on Storybook today sees tokens, the parchment canvas, and 12 sections of do/don't — but cannot see how a `BookCard` looks in horizontal vs vertical, how a `ReactionBar` scales sm/md/lg, what a `PostTree` does with 0 vs 10 replies, how the carousel chrome behaves with a near-end scroll, or how text-heavy cards break under 80-character CJK strings. The 41 migrated cosmos fixtures cover only ~5 % of the visual surface area.

This change builds out coverage on the stable foundation. It also closes three small gaps the migration exposed:

1. The `Green/Orange/Rose Button` triplet — three single-color sibling files, same shape, same disabled+loading pattern, evolving in lockstep, currently three drift surfaces.
2. The `ReviewCard` 2up wrapper — a composer hiding inside a "card variant" name (`VerticalTwoReviewCard`).
3. The four `Horizontal{Book,Review,Excerpt,Shelf}Carousel` wrappers — same Embla scaffolding, four duplicated chromes, no common abstraction.

These are not coincidental. The migration's act of authoring stories *forced* the question: what is varying, and what is repeating? The proposal codifies the answer (the abstraction-vs-split rule) so future-rezics — and future-AI generating UI — has a load-bearing decision aid, not just a list of `Do` blocks.

The change is scoped to: `@rezics/ui` (carousel generic + button consolidation + patterns.mdx), `@rezics/app` (the bulk: ~60 stories + 6 MDX overviews + central fixtures + 4 carousel-wrapper thinning + ReviewCardPair rename), `@rezics/storybook-config` (addon-a11y wiring + play-function support), and the `.claude/skills/rezics-design/` skill (rule mirror + story-ID citations). Other packages (`folio`, `editor`, `admin`) stay at cosmos-parity coverage.

## Goals / Non-Goals

**Goals:**

- Make Storybook a first-class visual reference for the rezics component surface, not just the foundation.
- Codify the abstraction-vs-split rule in the canonical patterns doc and the AI skill so the rule is consultable, not tribal.
- Eliminate the three known abstraction gaps (button triplet, review-pair naming, carousel duplication) as a side-effect of authoring stories — story-ification as a refactor forcing function.
- Establish authoring conventions (file location, naming vocabulary, mock-data architecture, locale axis, play function for forms) that scale to the next ~80 stories without re-deciding per author.
- Keep accessibility on the radar via `addon-a11y` at warnings-only severity — zero-effort surface, cumulative information.

**Non-Goals:**

- Promoting any `@rezics/app`-resident component into `@rezics/ui`. Components stay where they live; promotion criteria are a future change.
- Visual regression CI (Chromatic, Percy, the Storybook test runner). Local static dist remains the deliverable.
- Hosted Storybook deployment (Netlify, Vercel, GH Pages PR previews). Defer to a future change once designers join the loop.
- The deferred large refactors from prior adoption audits (editor `MarkdownEditor.css` markdown-prose palette, editor toolbar chrome, `package/folio/src/styles/theme.ts` reader-theme tokenization). Each remains its own dedicated PR per `design-system-adoption` Requirement-3.
- Tier-5 page templates beyond a hard cap of 3, marked illustrative-not-canonical.
- Migrating `voice.mdx` or `tokens.mdx` content (already canonical).

## Decisions

### Decision 1 — Five-tier component taxonomy

Adopt a five-tier model that determines which Storybook hosts what and how much coverage each tier earns:

| Tier | Definition | Storybook | Examples |
| ---- | ---------- | --------- | -------- |
| 0 | Foundation (tokens, voice, patterns) | `ui` | already shipped |
| 1 | Primitives (pure, no domain) | `ui` | `ColorfulButton`, `ArrowButton`, `CarouselIndicator`, `TextField`, `Progress*`, `EmptyState` |
| 2 | Composites (patterned, no domain) | `ui` | `Pagination`, `DialogContainer`, `FullScreenModal`, `ConfirmDeleteDialog`, `SafeLink`, `AuthProviderButton`, `DomainCarousel` (new) |
| 3 | Domain atoms (shaped by content) | `app` | `BookCard{Horizontal,Vertical}`, `ReviewCard`, `ExcerptCard`, `ShelfCard`, `RemarkCard`, `RealmCard`, `NotificationCard`, `ReactionBar` family, `PostCard`, `PostReply`, `ThreadingRail`, `TagPill`, `RatingBadge` |
| 4 | Domain composites | `app` | `PostTree` data-shape variants, `ReplyComposer` interactions, `ShelfDiscussion`, search filter rail, profile header |
| 5 | Page templates (illustrative) | `app` | Homepage row stack, Book detail, Profile — capped at 3 |

**Alternative considered**: a flat "everything in `app`" model. Rejected because the Tier 1/2 work surfaces ambiguity in `@rezics/ui` (the button triplet, the missing carousel generic) that won't be re-examined if all stories live in `app`.

### Decision 2 — Abstraction-vs-split rule, three tests

The rule that goes into `patterns.mdx` and `.claude/skills/rezics-design/patterns.md`:

> A new component is split rather than expressed as a variant prop on an existing component when **any one** of these tests fires:
>
> - **Layout test** — the JSX/DOM tree shape changes between cases.
> - **Naming test** — the cases would receive different *nouns* in conversation, not adjectival modifiers.
> - **Evolution test** — over a six-month horizon, one case is expected to evolve independently.
>
> When none fires, express cases as variant props.

The 10-second decision aid (for the AI skill specifically): "If the story names would read `Default / Compact / Large`, variant prop. If they would read `Hero / Compact / Sidebar`, split."

**Alternative considered**: a single `if`-density rule (>3 conditional branches → split). Rejected because some legitimate variant components have one giant `if` (empty-state branch) and some legitimate splits have zero `if`s (different DOM trees).

**Application to known cases (specced in `storybook-coverage`):**

| Case | Verdict | Reason |
| ---- | ------- | ------ |
| `Reaction*Action` sm/md/lg | variant prop | Same DOM, scale tokens swap (Layout: no, Naming: no, Evolution: lockstep) |
| `BookCard{H,V}` | split (already correct) | Layout test fires |
| `Green/Orange/Rose Button` | **consolidate to `ColorfulButton color`** | Same DOM, color swap, lockstep evolution — none of the three tests fires |
| Four `Horizontal*Carousel` | **generify to `<DomainCarousel renderItem>`** | Same intent + scaffolding, only items differ — variant by data, not by component |
| `ReviewCard` 2up | **rename + split** | "2up" is a layout that holds two cards, not a card variant — Naming test fires (composer ≠ atom) |
| `ChapterList / Linear / Arborist` | keep split (already correct) | Layout test fires three times |
| `RatingBadge / RatingSelector` | keep split (already correct) | Different intent (display vs edit) — Naming + Evolution |
| `PostCard / PostReply` | investigate at implementation time | Borderline — decide based on prop intersection (>80 % overlap → variant; otherwise keep split) |

### Decision 3 — `<DomainCarousel>` API

```tsx
// package/ui/src/composite/carousel/DomainCarousel.tsx
type DomainCarouselProps<TItem> = {
  items: readonly TItem[];
  renderItem: (item: TItem, index: number) => ReactNode;
  itemKey?: (item: TItem, index: number) => string;
  // chrome
  showArrows?: boolean;          // default true
  showIndicators?: boolean;      // default true
  indicatorPosition?: "overlay" | "bottom";
  // scrolling
  itemsPerView?: number | { sm: number; md: number; lg: number };
  scrollSnap?: "start" | "center";
  ariaLabel?: string;
};
```

The four existing wrappers in `@rezics/app` (`HorizontalBookCarousel`, etc.) collapse to thin shims:

```tsx
export const HorizontalBookCarousel = (props: { books: Book[] }) => (
  <DomainCarousel
    items={props.books}
    renderItem={(b) => <BookCardHorizontal book={b} />}
    itemKey={(b) => b.id}
    ariaLabel="Books"
  />
);
```

Each wrapper's *external prop API stays unchanged*; only its body changes. Existing call sites do not touch.

**Alternative considered**: leave wrappers untouched and document each individually in Storybook. Rejected because authoring four near-identical stories codifies duplication. Authoring one `DomainCarousel` with `Books`, `Reviews`, `Excerpts`, `Shelves` data-variant stories makes the abstraction the canonical reference.

### Decision 4 — `<ColorfulButton>` consolidation

```tsx
// package/ui/src/primitive/button/colorful/ColorfulButton.tsx
type ColorfulButtonProps = {
  color: "green" | "orange" | "rose";
  label: string;
  disabled?: boolean;            // shows loading spinner, per existing pattern
  // ...rest of MUI ButtonProps subset
};
```

The three sibling files (`GreenButton.tsx`, `OrangeButton.tsx`, `RoseButton.tsx`) and their three matching `*.stories.tsx` (just migrated from cosmos) are **deleted**. A single `ColorfulButton.stories.tsx` covers all three colors as named exports (`Green`, `Orange`, `Rose`, plus `Disabled`).

Existing call sites swap mechanically:
- `<GreenButton label="Save" />` → `<ColorfulButton color="green" label="Save" />`
- (sed-able; verified via `rg "GreenButton|OrangeButton|RoseButton" package/`)

**Alternative considered**: keep the three named components and just have one `ColoredButton` they wrap. Rejected as additive complexity (more files, not fewer). The named-call-site argument doesn't apply since these are internal.

### Decision 5 — Mock data architecture: central, hand-authored, decoupled

Stories rendering Tier 3/4 components need realistic data. Three choices considered:

| Option | Verdict | Why |
| ------ | ------- | --- |
| Inline per story | rejected | Duplication, drift; same `Book` shape redefined ten times |
| Per-feature `__mocks__/` next to source | rejected | Scattering same-domain entities across feature folders; no obvious place for cross-feature data |
| Central `package/app/src/stories/fixtures/<domain>.ts` | **chosen** | One source of truth per domain; `// MOCK:` comments find them all in one rg |

| Coupling option | Verdict | Why |
| --------------- | ------- | --- |
| Import from `package/server/prisma/factory/` | rejected | Server-side concerns leak into frontend stories; factory shapes are realistic-preset deterministic, not story-friendly; tight coupling makes story authoring depend on factory stability |
| Hand-author shapes matching runtime types | **chosen** | Stories own their data fate; matching shapes by hand is one-time work and rarely changes |
| Hand-author shapes **+ shared primitive generators** via `@rezics/shared/{random,text}` | **chosen** for primitives | Avoids re-deriving locale-aware CJK/Latin string generation, faker locale instances, and the curated multilingual title/summary corpus — the server factory uses the same primitives, so fixtures stay drift-free for typography axes without inheriting Prisma-coupled entity generators |

Each fixtures module exports collections by data shape (`bookEmpty`, `bookFew`, `bookMany`, `bookLongTitle`, `bookCJK`, `bookLatin`) so stories pick by intent. Every export carries `// MOCK:` per project convention. Where a fixture needs a long CJK string, a Latin paragraph, or a title from the curated corpus, it imports the relevant helper from `@rezics/shared/text` (`getFaker`, `generateParagraph`, `getTitlePool`, …) rather than re-deriving locale machinery. The ban on `prisma/factory/` imports stands — `@rezics/shared` carries only the **pure**, Prisma-free subset of the factory's helpers.

### Decision 6 — Story naming vocabulary as a closed list

Storybook story names default to whatever the author types. Without a vocabulary, 80 stories accumulate ad-hoc names (`Tiny`, `Big`, `Long`, `LotsOfText`, `WithCover`, `NoCover`) and the sidebar becomes noise.

The closed list:

- **State**: `Default · Empty · Loading · Error · LongContent · Disabled`
- **Variant**: `Compact · Hero · Horizontal · Vertical · Small · Medium · Large`
- **Mode**: `Light · Dark` (Tier 0/1 only)
- **Locale**: `LocaleCJK · LocaleLatin` (Tier 3 cards only)
- **Interaction**: `HappyPath · WithError · Submitting`

A reviewer flagging an unfamiliar story name asks: "Why isn't this `LongContent`?" — and the author either renames or proposes a vocabulary addition in a follow-up change. The vocab is in `storybook-coverage/spec.md`, not `patterns.mdx`, because it's a Storybook authoring convention, not a design rule.

### Decision 7 — `play()` for the six critical forms only

Storybook 10's `play` function scripts user interactions at story-load time (`userEvent.type`, `userEvent.click`, etc.). Two options:

- **Universal** — every form has `play` stories.
- **Six critical forms only** — the ones whose happy path is most frequently regressed.

The six: `ReplyComposer`, `ReviewForm`, `RemarkInlineForm`, `AuthModal`, `OtpInput`, `TokenCreateDialog`. These cover the core read/write loops a designer or QA-walker most often validates.

Each gets a `Default` (no play) and a `HappyPath` (with play). An optional `WithError` is allowed but not required.

**Alternative considered**: full coverage of every form. Rejected as YAGNI — play stories that nobody reads still cost maintenance.

### Decision 8 — Locale axis on five text-heavy cards only

Typography is the surface that breaks first under long strings; cards are where users meet typography. Five cards earn an explicit `LocaleCJK` and `LocaleLatin` axis:

- `BookCard`, `ReviewCard`, `ExcerptCard`, `RemarkCard`, `ShelfCard`

CJK strings ≥ 80 chars; Latin strings ≥ 80 chars. The fixtures module (`fixtures/book.ts` etc.) supplies them. This pairs naturally with the in-flight `unit-work-release-i18n` work — when that surfaces a typography bug, these stories are the canary.

**Alternative considered**: every text component gets a locale axis. Rejected as over-coverage; non-card components (badges, buttons, chips) have short bounded text where locale rarely matters.

### Decision 9 — Dark mode via the toolbar, not duplicate stories

Every preview already exposes a Light/Dark toolbar (per `design-system-storybook` Requirement-4). Two options for dark coverage:

- **Per-story `Light` and `Dark` named exports** — story count doubles
- **Toolbar only** — single source of truth, viewer toggles

Toolbar wins for Tier 2+. Tier 0 (token galleries) and Tier 1 primitives where the dark *is* the message keep explicit `Light`/`Dark` named exports. This matches existing token-gallery practice.

### Decision 10 — Skill ↔ Storybook bridge via story-ID citation

`.claude/skills/rezics-design/` files (especially `mui-vs-shadcn.md` and `patterns.md`) currently describe patterns in prose. Once stories exist, the same patterns have *concrete* live examples. Citing story IDs (e.g. `Domain/Cards--book-horizontal`) anchors skill recommendations to verifiable artifacts.

Citation format: Storybook canonical story ID slug as it appears in `storybook-static/index.json`. The `storybook-coverage` spec contains a scenario verifying citations resolve.

**Alternative considered**: embed code snippets in the skill instead of citing. Rejected — snippets drift; story IDs don't.

### Decision 11 — Implementation phase order

The work has three obvious sequencing tensions:

1. Refactors first, then stories — refactoring while stories exist forces story rewrites.
2. Stories first, then refactors — stories codify the un-abstracted state and need rewriting.
3. Refactors and their stories together — one PR per abstraction case (carousel, button, review-pair).

Choice: **(3) refactor + its stories together**, then **bulk story authoring** afterwards. Phase order:

- **Phase 1** — addon-a11y in shared config + fixtures module skeleton
- **Phase 2** — three abstraction-gap PRs (`ColorfulButton`, `DomainCarousel`, `ReviewCardPair`), each with its own stories
- **Phase 3** — `ui` Tier 1+2 stories (the rest)
- **Phase 4** — `app` Tier 3 stories (one feature folder per PR if practical)
- **Phase 5** — `app` Tier 4 stories + 6 MDX overview docs
- **Phase 6** — patterns.mdx + skill `patterns.md` abstraction-vs-split section + skill story-ID citations
- **Phase 7** — sign-off verification (target counts, citations resolve, addon-a11y warnings observable)

Phases 3–5 can parallelize across authors/sessions; Phase 2 must finish first so the abstractions exist.

## Risks / Trade-offs

- **Risk**: Story explosion makes the sidebar noisy. → **Mitigation**: closed naming vocabulary (Decision 6); MDX overview docs (`Domain/<Cluster>`) provide curated entry points; per-package targets are a soft cap on volume.

- **Risk**: Mock fixtures drift from runtime types over time. → **Mitigation**: fixtures import the runtime `Book`, `Post`, etc. types from feature `models/` and pass through TypeScript — schema changes break the fixtures module loudly. Hand-authored shapes are not type-loose `any`.

- **Risk**: `<DomainCarousel>` generic loses behavior the four wrappers had (custom item gap per domain, scroll snap behavior). → **Mitigation**: Phase 2 reads each wrapper's existing chrome before designing the prop API; if a wrapper needs behavior outside the generic's prop set, that behavior is encoded as an option, not lost. Wrappers' external prop APIs are preserved as a contract.

- **Risk**: `ColorfulButton` consolidation breaks call sites. → **Mitigation**: pre-PR `rg "GreenButton|OrangeButton|RoseButton" package/` enumerates call sites; sed sweep is mechanical and verified by `tsc --noEmit` per package.

- **Risk**: `addon-a11y` produces a flood of warnings on existing stories. → **Mitigation**: warnings-only severity (per spec); warnings are observed and triaged but do not block builds. A follow-up change can elevate to errors when the warnings are tractable.

- **Risk**: The abstraction-vs-split rule is misapplied — author SPLITs a case that should be a variant prop, or vice versa. → **Mitigation**: the rule has three tests, not one; `<Compare>` blocks in patterns.mdx demonstrate both correct outcomes; reviewers cite the rule by test name in PR comments.

- **Risk**: `play()` interaction stories flake in CI when story tests are eventually wired. → **Mitigation**: this change does not wire the test runner; play stories are observation-only. Future test-runner change can quarantine flaky play stories.

- **Risk**: Locale-axis stories cause typography tweaks that ripple back into foundation. → **Mitigation**: that's the design-system feedback loop working as intended; if a CJK string breaks, the fix is in tokens, and the story documents the intent. Acceptable risk.

- **Trade-off**: Six-form `play` cap leaves other forms (`SearchFilter`, `RemarkEditDialog`, `TagListEdit`, `TokenCreateDialog`, …) as observation-only. Followed up if a regression slips.

- **Trade-off**: Per-component story files (one `.stories.tsx` per component) rather than cluster files (one `Cards.stories.tsx`) means more files but cleaner refactor surface. Worth the file count.

## Migration Plan

This change is internal. No data migration; no environment changes. Rollout sequencing:

1. Land Phase 1 (addon-a11y wiring + fixtures skeleton) in isolation. Verify all five Storybooks build clean with the addon panel visible.
2. Land Phase 2 PRs serially (`ColorfulButton`, `DomainCarousel`, `ReviewCardPair`), each with its own stories. Verify call-site sweeps with `tsc --noEmit` per package.
3. Phases 3–5 land per-feature-folder PRs (or per-tier batches in a single session). Each PR is independently reviewable.
4. Phase 6 (patterns.mdx + skill) lands once stories the rule cites exist.
5. Phase 7 final sweep: re-run `bun run storybook:build`, count `index.json` entries, verify targets.

Rollback: any single PR can be reverted in isolation. Fixtures module is additive (no consumers outside stories). `addon-a11y` is removable by undoing one config commit. `ColorfulButton` consolidation is the only PR with non-trivial revert (must restore three files), but the prior commit is the canonical snapshot.

## Open Questions

- **PostCard / PostReply** prop intersection. Resolved at Phase 2 implementation by reading both source files and computing overlap. Default to keep-split (per Decision 2 application table). If overlap > 80 %, author proposes a variant prop in a follow-up.
- **`addon-a11y` warning baseline**. Phase 7 verification observes the count after Phase 5; the count becomes input to a future "tighten a11y to errors" change. This change does not pin a number.
- **Whether `Domain/Search` MDX should treat the 11 search filter primitives as one cluster or split into "input atoms" and "filter rail composer"**. Resolved at Phase 5 authoring; current lean is one cluster with sub-headings.
