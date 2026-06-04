---
title: Feed Row System
status: active
created: 2026-06-04
completed:
supersededBy:
tags: [feed, home, realm, library, post, review, shelf, factory]
---

## Why

Home, realm, and library pages currently do not share a real feed model. Home is
a fixed stack of sections, realm feed is a post list with ad hoc review
hydration, and library pages still expose separate review/shelf/post surfaces.
The result is a broken discovery experience: feeds cannot paginate as a coherent
timeline, review cards do not behave like other content cards, and factory data
does not reliably produce populated realm feeds.

Build a unified feed row system where a page asks for rows, then renders mixed
content rows and horizontal carousel rows through the same renderer. Reviews,
remarks, excerpts, and ordinary posts should share one content-card interaction
model, while work and shelf recommendations appear as scheduled carousel rows.
The first target is a user-usable Home feed and Realm feed; book/game/media
library feeds should follow the same contract.

## Durable constraints & decisions

- (type) Feed responses are row-based, not section-based: a response contains
  ordered `content` rows and `carousel` rows plus a cursor for the next page.
- (type) Feed scope is explicit: at minimum `home`, `realm`, and `library` with
  library sub-scope for work type such as book/game/media.
- (type) `content` rows carry the hydrated render context needed by the card:
  `post`, canonical `href`, optional `realm`, optional `targetUnit`, optional
  `variantContext`, and optional recommendation reason. The frontend must not
  batch-query book details just to render review target links.
- (type) `carousel` rows carry a stable row id, carousel kind (`works` or
  `shelves` for v1), title i18n key/params, and bounded item summaries. Home,
  realm, and library feeds may use different row recipes while preserving the
  same shape.
- (test) Review rows and ordinary post rows use the same whole-row click model:
  clicking the row opens the primary feed target; nested links such as reviewed
  work, realm, variant, author, rating, and actions do not trigger the row
  navigation.
- (test) Realm feed reads include only posts that have their own `UnitRealm`
  relation to that realm. Adding works to a realm is not enough to populate the
  realm post feed.
- (test) Factory showcase data must create at least one realm with approved
  realm-scoped long posts, image-rich posts, reviews targeting works, remarks or
  excerpts, shelves, reactions, and varied timestamps so Home and Realm feed UI
  can be evaluated without manual data entry.
- (test) Infinite feed pagination is cursor-based. It must not use `start` /
  offset paging for feed rows because new content insertion can duplicate or
  skip rows during scrolling.
- (test) Carousel scheduling is deterministic and sparse: no adjacent carousel
  rows, carousel rows are skipped when data is insufficient, and the carousel
  ratio stays bounded so content remains the primary feed.
- (comment) The feed service owns row scheduling. Frontend renderers must not
  randomly insert carousels or synthesize feed order, because pagination,
  debugging, and analytics need server-visible row decisions.
- (comment) Loading states are part of the feed experience: initial load uses
  feed-shaped skeleton rows, next-page load uses a bottom sentinel state, and
  retry keeps already loaded rows visible.

## 1. Contract and API Shape

- [ ] 1.1 Add feed row DTOs and query/response schemas under
  `package/contract/src/feed/`, extending or replacing the current
  `feed-context.ts` candidate-only model.
- [ ] 1.2 Export the feed contract from `package/contract/src/feed/index.ts`
  and root contract exports if needed by app/api/server packages.
- [ ] 1.3 Add frontend API client, keys, and React Query helpers under
  `package/api/src/feed/`, matching existing package API conventions.
- [ ] 1.4 Define cursor fields and page-size behavior in types rather than
  relying on `PostListQuery.start`.

## 2. Server Feed Service

- [ ] 2.1 Add a backend feed domain under `package/server/src/feed/` with
  `{feed}.api.ts`, `.service.ts`, `.mapper.ts`, and `.types.ts` files.
- [ ] 2.2 Mount the feed API from `package/server/src/index.ts`.
- [ ] 2.3 Implement Home feed row selection by combining recent/ranked post
  rows with bounded work and shelf carousel rows.
- [ ] 2.4 Implement Realm feed row selection by reading realm-scoped post
  membership from `UnitRealm`, preserving moderation and language visibility
  rules equivalent to the current `postService.byRealm`.
- [ ] 2.5 Implement Library feed scope for at least book library, with the same
  row contract and a path for game/media reuse.
- [ ] 2.6 Hydrate content row context server-side: reviewed work target title/id,
  realm summary when relevant, variant context, and primary href.
- [ ] 2.7 Implement deterministic row scheduling for carousels with no adjacent
  carousel rows and bounded carousel frequency.
- [ ] 2.8 Add service/api tests for cursor pagination, scope filtering, review
  target hydration, carousel scheduling, and insufficient-carousel-data skip
  behavior.

## 3. Frontend Feed Renderer

- [ ] 3.1 Add a shared feed renderer in `package/app/src/feed/` that renders
  `content` and `carousel` rows from the feed API.
- [ ] 3.2 Add `FeedContentCard` by consolidating the durable interaction and
  layout behavior currently split across `PostCard` and `ReviewCard`.
- [ ] 3.3 Ensure review content renders a target-work link line without
  disrupting whole-row navigation.
- [ ] 3.4 Render work carousels through the existing domain carousel pattern so
  book/game/media share the same item vocabulary where possible.
- [ ] 3.5 Render shelf carousels through existing shelf card/carousel components
  after adapting props to the feed row summaries.
- [ ] 3.6 Add feed-shaped loading, next-page, retry, empty, and end-of-list
  states using existing `Skeleton`, `Spinner`, `EmptyState`, and button
  patterns.
- [ ] 3.7 Add focused component stories for content rows, review rows with target
  links, work carousel rows, shelf carousel rows, loading rows, and error retry.

## 4. Page Integration

- [ ] 4.1 Replace the fixed post list in `RealmContentFeed` with the shared feed
  renderer while keeping sort, tag filter, manage mode, and moderation filters.
- [ ] 4.2 Replace the static lower Home sections in
  `package/app/src/home/pages/Home.tsx` with the Home feed renderer while
  deciding which legacy hero/search content remains above the feed.
- [ ] 4.3 Adapt book library/community surfaces to the library feed scope,
  starting with book and keeping the contract ready for game/media.
- [ ] 4.4 Preserve realm pinboard/rule/about placement around the feed; pinned
  items are not automatically mixed into the infinite feed unless the feed
  service explicitly returns them as rows.
- [ ] 4.5 Ensure feed routes use the existing read-language context and do not
  duplicate DTOs in app code.

## 5. Factory and Fixtures

- [ ] 5.1 Add a factory scenario or preset that creates a showcase realm with
  realm-scoped posts, reviews, remarks/excerpts, shelves, reactions, and varied
  timestamps.
- [ ] 5.2 Ensure seeded review posts written for the showcase realm have
  `UnitRealm` rows for that realm, not only target works in the realm.
- [ ] 5.3 Add factory tests proving showcase realm feed membership includes
  content rows and that review target works are present for card context.
- [ ] 5.4 Keep random factory behavior useful, but make the showcase deterministic
  enough for visual QA and Storybook/mock fixtures.

## 6. Validation

- [ ] 6.1 Run targeted contract/server/app tests for the new feed domain and
  renderer.
- [ ] 6.2 Run `bun run check:convention` for folder/API/import conventions.
- [ ] 6.3 Run `bun run check:tokens` if feed UI styling changes touch JSX/CSS
  classes.
- [ ] 6.4 Manually verify after `bun run dev`: Home feed, Realm feed with
  content, review target links, infinite scroll, carousel insertion, loading,
  retry, and end-of-list states.

## Out of scope

- Full personalized recommendation ranking beyond deterministic v1 row recipes.
- Analytics event instrumentation for feed impressions and carousel engagement.
- Major redesign of post thread/detail pages.
- Backward compatibility for internal feed DTO names during development; this
  is a clear cutover.
- Completing the backend Drizzle migration. Feed work should align with the new
  repository/schema direction when touching server data access, but the migration
  itself is owned by the existing Drizzle proposal.
