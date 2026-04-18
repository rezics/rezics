## Context

Tags are first-class Units (`type = TAG`) with `UnitTranslation` records for multilingual labels. The `UnitTag` junction table scores tags per content unit. The current book detail page reads a flat `BookDTO.tags` array with an optional `label` string — this is a shortcut that bypasses the translation system and is now being replaced with proper multilingual resolution.

The `book-detail-restructure` change (prerequisite) provides the Overview tab, page-wide language selection via `useBookLanguage(bookId)`, and the contextual sidebar system. This change builds on that foundation.

### Current Data Flow (broken)

```
BookDTO.tags: [{ tagUnitId, label?, score }]
  → getBookTagLabels() → [{ tagUnitId, label, score }]
    → hero chips with <Link to="/book" search={{ tags: label }}>
       ↑ label is a flat string, no language awareness, search link is wrong
```

### Target Data Flow

```
tagQueries.list({ unitId: bookId })
  → UnitTagDTO[]: [{ tagUnitId, score, voteCount }]  (no label)
  
tagQueries.batchTranslations(tagUnitIds, lang)
  → Map<tagUnitId, { name, slug, description }>  (language-resolved)

Combined → TagInteraction component
  → Popper detail (single click)
  → Multi-select mode
  → Search navigation with injected state
```

## Goals / Non-Goals

**Goals:**

- Provide language-aware tag display in the hero section and Overview tab, following the page-wide language selection
- Build an interactive tag component with single-click detail (Popper), voting, and multi-select search
- Enable zero-latency search navigation by injecting pre-resolved tag data into router state
- Clean up the broken `BookDTO.tags` / `getBookTagLabels` path

**Non-Goals:**

- Tag management UI (create, edit, delete tags) — that's an admin feature
- Realm tag interactions (RealmTagUnit) — existing realm tag system is unaffected
- Tag autocomplete/search-as-you-type in the search page — search page already handles tag resolution from `[slug]` syntax
- Changing the `UnitTag` scoring or voting API — the existing `castTagVote` endpoint is used as-is

## Decisions

### Decision 1: Batch Translation Query — Dedicated Endpoint

**Choice:** Add a new server endpoint `GET /api/tags/batch-translations?unitIds=id1,id2&lang=ja` that accepts an array of tag `unitId`s and a language code. Returns an object keyed by `unitId` with `{ name, slug, description }` resolved via the standard translation resolution chain.

**Why not reuse tagQueries.list?** `tagQueries.list({ unitId })` returns `UnitTagDTO[]` for a given content unit — it answers "what tags does this book have?" but doesn't resolve tag Unit translations. We need a second query that answers "given these tag unit IDs, what are their translated labels?"

**Why not embed translations in UnitTagDTO?** That would couple the scored junction (how important is this tag on this unit?) with display data (what's the tag called in Japanese?). These are different concerns with different cache lifetimes — tag scores change with votes, translations rarely change.

**Frontend query key:** `['tags', 'translations', tagUnitIds.sort().join(','), lang]` — deduplicates across components that need the same tags in the same language. Both hero and Overview tag section share this query.

### Decision 2: Tag Interaction State Machine — Three States via useReducer

**Choice:** Manage the TagInteraction component's state with `useReducer` implementing three states:

```
IDLE → (click chip) → SINGLE_PREVIEW
  - popperAnchor: element ref
  - previewTagId: string

SINGLE_PREVIEW → (click ✕ or same chip) → IDLE
SINGLE_PREVIEW → (click different chip) → MULTI_SELECT
  - selectedTagIds: Set<string> (initially contains both the previewed and newly clicked tag)

MULTI_SELECT → (toggle chips) → MULTI_SELECT
MULTI_SELECT → (all deselected) → IDLE
```

**Why useReducer over Zustand/Jotai?** This state is local to the TagInteraction component instance, transient (no persistence needed), and has well-defined transitions. useReducer is the right tool — no global store overhead.

### Decision 3: Popper Component — MUI Popper with ClickAwayListener

**Choice:** Use MUI `Popper` (not `Popover`) with `placement="bottom"` and an arrow modifier. Wrap the popper content in a `ClickAwayListener` that excludes the tag chip area, so clicking other chips doesn't trigger "click away" (it triggers chip click handlers instead). The popper includes a close (✕) button.

**Why Popper, not Popover?** Popper is non-modal by default — no backdrop, no focus trap, no scroll lock. Clicks on other chips pass through naturally. Popover would need `disableScrollLock`, `hideBackdrop`, and other overrides to achieve the same behavior.

**Popper content:**
```
┌────────────────────────────────────── ✕ ┐
│  Tag Name (translated)                   │
│  Description (translated, 2-3 lines)     │
│                                          │
│  Score: 142   Votes: 89                  │
│  [▲ Upvote] [▼ Downvote]               │
│                                          │
│  [🔍 Search this tag]                   │
└──────────────────────────────────────────┘
```

### Decision 4: Search Injection — TanStack Router State

**Choice:** Use TanStack Router's `navigate({ state })` to pass pre-resolved tag data. The search page reads `state.injectedTags` on mount. If present, it hydrates the search state with these objects directly. If absent, it falls back to parsing `[slug]` from the URL `q` param and resolving via API.

```ts
// Navigation from tag interaction
navigate({
  to: '/search',
  search: { q: serializeSearchString({ tags: selectedTags.map(t => ({ slug: t.slug })) }) },
  state: {
    injectedTags: selectedTags.map(t => ({
      slug: t.slug,
      unitId: t.unitId,
      name: t.name,
    })),
  },
});
```

**Why router state over Jotai/Zustand store?** Router state is scoped to the navigation — it lives exactly as long as the page transition, doesn't pollute global state, and is automatically cleaned up. A global store would need manual cleanup and could leak between unrelated navigations.

**URL remains canonical:** The `q` search param contains the `[slug]` syntax. If a user copies the URL and shares it, the recipient loads the page without injected state and the search page resolves slugs normally. Both paths produce identical results.

### Decision 5: BookDTO.tags Removal — Replace with Independent Queries

**Choice:** Remove `tags` from `BookDTO` and `scoredTagBriefSchema` from the contract. All tag display goes through two independent queries:

1. `tagQueries.list({ unitId: bookId })` → `UnitTagDTO[]` (tagUnitId, score, voteCount)
2. `tagQueries.batchTranslations(tagUnitIds, lang)` → translations

**Migration:** Grep for `bookInfo?.tags`, `book.tags`, `BookDTO` tag references, `getBookTagLabels`, `scoredTagBriefSchema`. All call sites switch to the independent query pattern.

## Risks / Trade-offs

**[Risk] Two queries instead of one for tag display**
→ Mitigation: Both queries are lightweight (tag count per book is typically 5-15). They share the React Query cache — the translation query deduplicates across hero and Overview. The latency is comparable to the current single-fetch approach. Net benefit is correct multilingual behavior and proper cache separation.

**[Risk] Router state is not persisted across browser refresh**
→ Accepted: This is by design. On refresh, the URL `q` param is the source of truth and slugs are resolved via API. The injected state is a performance optimization for in-app navigation, not a data persistence mechanism.

**[Risk] Multi-select UX may be non-obvious to users**
→ Mitigation: The transition is discoverable — clicking a second chip while the popper is open is a natural gesture. The multi-select state is visually distinct (highlighted chips + search action bar). No hidden mode switch or gesture is required.

**[Trade-off] Removing BookDTO.tags is a breaking change**
→ Accepted: The field is currently non-functional (label is language-unaware, search link is broken). Removing it forces all consumers to the correct path. The migration surface is small — grep identifies all call sites.
