## Context

Rezics now treats `@rezics/ui/shadcn` Card as the canonical card primitive. The
primitive already encodes the design-system surface policy through
`surface="plain" | "contained" | "elevated"`, `interactive`, calibrated
elevation, size, and `CardMedia`.

The app package also has search-specific card components:

- `SearchLibraryUnitCard` for book-like library units with a stable cover anchor.
- `SearchContentResultCard` for text-first previews such as posts, realms,
  users, entities, and other content snippets.

However, the active search result lists still render local row components with
manual borders and spacing. The profile overview has the same issue in pinned
items, recent activity, mobile stats, and sidebar stat links. Some of those
surfaces also use raw gray utility classes instead of Rezics tokens.

This change is frontend-only and stays within `package/app`. It consumes the
existing UI Card primitive but does not change `package/ui`.

## Goals / Non-Goals

**Goals:**

- Make federated and legacy search result lists render through the app card
  components backed by `@rezics/ui/shadcn` Card.
- Keep search result cards preview-focused: clamped content, no expansion,
  replies, or reaction controls.
- Replace profile overview ad hoc cards/rows with Card/token-aligned surfaces.
- Remove raw gray styling from touched profile surfaces.
- Preserve route behavior, API contracts, search result schemas, and query
  behavior.
- Add Storybook coverage for the resulting profile/search card states.

**Non-Goals:**

- Changing `@rezics/ui/shadcn/card.tsx` or adding a new UI package primitive.
- Redesigning the profile route structure or tab model.
- Replacing mock profile overview data sources with real pinned/activity APIs.
- Changing Meilisearch/server contracts or ranking behavior.
- Introducing a third-party UI library.

## Decisions

### 1. Search lists render semantic app cards, not local rows

`FederatedResultList` should map each result document to either
`SearchLibraryUnitCard` or `SearchContentResultCard`. The list component remains
responsible for grouped/ranked/single control flow, empty/loading states, and
category navigation. The card components own the visual preview surface.

Mapping:

| Result kind | Card |
| --- | --- |
| Book-like content results | `SearchLibraryUnitCard` |
| Shelf results without stable cover behavior | `SearchContentResultCard` unless library-unit presentation is clearer |
| Post/review/excerpt/remark results | `SearchContentResultCard` |
| Realm results | `SearchContentResultCard` |
| User results | `SearchContentResultCard` with avatar/user metadata |
| Entity results | `SearchContentResultCard` with avatar/fallback metadata |

Rationale: search results are previews, not domain detail cards. This keeps
search visually consistent and avoids pulling full domain card behavior into a
mixed result list.

Alternative considered: keep using domain cards such as `ReviewCard` for some
types. Rejected for the general search list because domain cards can include
detail-page or flow semantics that make mixed search results uneven.

### 2. Card surface defaults stay preview-first

Search result cards should default to `surface="plain"` and `interactive` so
they read as content-led feed/search items with an outer state layer. Contained
cards may be used only when the surrounding layout needs tonal grouping, and
elevated cards remain out of scope for these dense result lists.

Rationale: this matches the design-system guidance that `plain` is the default
for flat feed/media items and avoids card chrome inside search sections.

Alternative considered: wrap each search section in a contained Card. Rejected
because page sections should remain unframed; repeated items may be cards.

### 3. Profile overview gets feature-local card surfaces

Profile overview should use either existing app search cards or small
feature-local components for stats, pinned items, and activity previews. These
components live under `package/app/src/user/components` or
`package/app/src/user/pages` depending on reuse. They consume
`@rezics/ui/shadcn` Card and tokens; they do not move profile-specific copy or
contract mapping into `@rezics/ui`.

Rationale: profile cards are product/domain surfaces and should stay in the app
package. The UI package Card remains primitive-only.

Alternative considered: promote profile stats or pinned cards to `package/ui`.
Rejected because they depend on product navigation, profile labels, and content
search documents.

### 4. Data mapping remains local and contract-first

Search and profile components should adapt existing contract documents at the
consumer boundary. They should not duplicate DTO types in app code and should not
change `@rezics/contract`.

Rationale: the change is visual and structural. Keeping contract mapping local
reduces blast radius and preserves API compatibility.

### 5. Storybook documents the card states users will see

Existing `SearchResultCards` stories should be updated if card props or states
change. Profile-specific card surfaces should get focused stories for compact
stats, pinned items, empty states, long titles, and CJK/Latin text where
applicable.

Rationale: the risk is visual regression, not backend behavior. Storybook is the
fastest feedback loop for these surfaces.

## Risks / Trade-offs

- [Risk] Search result cards may lose some domain-specific detail from existing
  `ReviewCard` rendering. → Mitigation: preserve the important preview fields
  in `SearchContentResultCard` and keep full domain cards for domain pages.
- [Risk] Generic card components could grow too many one-off props. →
  Mitigation: prefer adapter functions in `FederatedResultList`; only add card
  props when they are generally useful to search/profile previews.
- [Risk] Profile overview can accidentally become a page wrapped in cards. →
  Mitigation: use cards only for repeated items or compact stat surfaces; keep
  sections unframed.
- [Risk] Storybook coverage may lag implementation. → Mitigation: include story
  updates in the same tasks as each surface migration.

## Migration Plan

1. Refactor search result row rendering behind the existing list component
   exports, preserving public component names.
2. Refactor profile overview and profile basic info surfaces in place.
3. Update Storybook/docs for search and profile card states.
4. Run formatting, relevant tests, and convention checks.

Rollback is straightforward because no API, route, or database changes are
introduced. The prior row rendering can be restored in `package/app` if needed.

## Open Questions

- Whether shelf search results should always use `SearchLibraryUnitCard` or use
  `SearchContentResultCard` when there is no strong cover/thumbnail signal.
- Whether profile pinned items should reuse `SearchLibraryUnitCard` directly or
  use a smaller feature-local card that shares only the Card surface policy.
