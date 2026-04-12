## Context

The Rezics platform is a full-stack TypeScript monorepo with an Elysia backend and a React 19 + Vite frontend. The backend has undergone three structural shifts that the frontend has not absorbed:

1. **Post unification**: Comment, Review, and Remark are now all rows in the `Post` table, distinguished by `PostKind` enum (`REVIEW`, `COMMENT`, `QUOTE`, `REMARK`, `POST`). The old `CommentIndex` table was never created — the `comment/` server domain is dead code. The contract files `comment.ts` and `review.ts` are empty stubs.

2. **Shelf replacement of Readlist**: The `Shelf` model replaces `Readlist` with richer semantics — items with keywords, labels, sort order, attached reviews via `ShelfItemReview`, a favorites concept (`kindKey: "favorites"`), and a collection API. The contract file `readlist.ts` is an empty stub.

3. **Realm introduction**: Community spaces with membership roles, content feeds, and realm-scoped tag curation. Full backend support (CRUD, membership, content feed, `RealmTagUnit`), zero frontend implementation.

Additionally, the `UnitType` enum in the contract has 12 values (`BOOK`, `GAME`, `MEDIA`, `POST`, `TAG`, `REALM`, `SHELF`, `CHAPTER`, `IMAGE`, `VIDEO`, `QUOTE`, `LINK`), but the frontend references non-existent values (`COMMENT`, `NOTE`, `REVIEW`, `READLIST`). The frontend has ~50 `// MOCK:` annotations marking workarounds for APIs that now exist.

### Current Frontend State

| Feature | Status |
|---------|--------|
| `readlist/` | 10+ files, 5 routes — uses ShelfDTO but wrapped in MOCK casts |
| `shelf/` | 2 files (ShelfPage, ShelfItemCard) — skeletal, no routes |
| `comment/` | 8 files — imports PostDTO via `@rezics/api/post`, but structurally separate |
| `review/` | 15 files, 5 routes — uses PostDTO with MOCK annotations for extra extraction |
| `realm/` | Does not exist |
| `discussion/` | Does not exist |
| Multilingual UI | Does not exist (backend fully supports translations[]) |
| Realm-tag display | Does not exist |
| Homepage | Book-centric portal, not ecosystem-aware |

### Backend Endpoints Available but Unused by Frontend

- `shelfApi.list()`, `shelfApi.mine()`, `shelfApi.get()` — shelf CRUD
- `postApi.list({ kind: 'REVIEW' })`, `postApi.getByTarget()` — post queries by kind
- `realmApi.*` — full realm CRUD and membership
- `collectionApi.*` — collect to shelves, toggle favorites
- All translation data in DTOs (`translations[]`, `supportLanguages[]`)

## Goals / Non-Goals

**Goals:**

- Achieve full frontend-backend data model alignment across all packages
- Implement complete shelf, realm, discussion, and multilingual UI features
- Establish proper review/remark separation with distinct UX patterns
- Formalize PostKind in the contract and remove dead COMMENT kind
- Resolve all MOCK annotations by wiring to real API endpoints
- Introduce ecosystem-aware homepage and search route separation
- Add user settings infrastructure (User.settings JSON column) for realm-tag preferences and language settings

**Non-Goals:**

- Rating system refactor (mocked with TODO annotations; separate change)
- Game library or media library frontend (placeholder cards only)
- Admin panel changes beyond navigation label updates (admin already uses "shelves")
- Notification/inbox feature rework (existing implementation retained)
- Meilisearch index changes (content search contract unchanged)
- Mobile app or PWA considerations
- Performance optimization of existing features
- Backward-compatible redirects from `/readlist/*` to `/shelf/*`

## Decisions

### D1: Remove PostKind.COMMENT from enum

**Decision**: Remove `COMMENT` from the `PostKind` Prisma enum and contract. All reply/threading semantics are handled by `parentPostUnitId`, `rootPostUnitId`, `depth`, and `sortPath` on the Post model.

**Rationale**: A "comment" is structurally a Post with `parentPostUnitId != null`. The `kind` field carries semantic meaning about the *content form* (review, remark, quote, general post), not about the *structural role* (top-level vs reply). Mixing structural and semantic concerns in one enum creates confusion. The `comment/` server domain references `CommentIndex` which does not exist in the database — the entire subsystem is dead code.

**Final PostKind enum**: `REVIEW | REMARK | QUOTE | POST`

**Migration**: Existing rows with `kind = 'COMMENT'` in the database remain as-is. The Prisma enum removal means new posts cannot use this value. Frontend code that created posts with `kind: 'comment'` will use `kind: 'POST'` with `parentPostUnitId` set. No data migration needed.

**Alternative considered**: Keep COMMENT as a deprecated value. Rejected — it adds no information and encourages incorrect usage patterns.

### D2: Route architecture — landing vs search separation

**Decision**: Each content type has two route levels:
- **Landing page** at root (`/book`, `/shelf`, `/review`, `/realm`) — curated discovery with editorial sections
- **Search page** at sub-route (`/book/search`, `/shelf/search`, `/review/search`, `/realm/search`) — full filtering/sorting UI powered by Meilisearch content search

**Rationale**: The filtering/search interface is complex (keyword, tags, NSFW, licensed, sort options, language filters). Mixing it with curated landing content creates a cluttered UX. Separating allows the landing page to be editorial and the search page to be a power tool. No backward compatibility needed per requirements.

**Route map**:

```
/                              Ecosystem homepage
/book                          Book Library landing (trending, new, picks)
/book/search                   Book search (full filters, pagination)
/book/:bookId                  Book detail layout
/book/:bookId/info             Info tab
/book/:bookId/content          Chapters tab
/book/:bookId/review           Reviews & Ratings tab
/book/:bookId/discussion       Discussion tab
/book/:bookId/edit/*           Book editing routes
/book/new                      New book

/shelf                         Shelf landing
/shelf/search                  Shelf search
/shelf/:shelfId                Shelf detail
/shelf/:shelfId/edit           Edit shelf
/shelf/new                     New shelf
/shelf/book/:bookId            Shelves containing a book

/review                        Review landing
/review/search                 Review search
/review/:reviewId              Review detail
/review/:reviewId/edit         Edit review
/review/new/:bookUnitId        New review for a book
/review/book/:bookId           Reviews for a book

/remark/:remarkId              Remark permalink (for sharing)
/remark/book/:bookId           Remarks on a book

/realm                         Realm landing
/realm/search                  Realm search
/realm/:realmId                Realm detail (feed, tags, members)
/realm/:realmId/manage         Realm management (owner/admin)
/realm/new                     New realm

/quote/*                       Quote routes (unchanged)
/tag/*                         Tag routes (unchanged)
/user/*                        User routes (unchanged)
/search                        Unified cross-type search (future)
/inbox                         Notifications (unchanged)
/feedback                      Feedback (unchanged)
```

### D3: Book detail — 4 tabs with review/remark integration

**Decision**: Book detail layout has 4 tabs: Info, Content, Reviews & Ratings, Discussion.

The Reviews & Ratings tab integrates:
1. **Rating overview** at top (mocked — distribution chart, average score, total count from reviews + remarks)
2. **Inline remark form** below (star rating selector + text input + submit button)
3. **Sub-tab toggle**: Remarks | Reviews
4. **Remark list**: Compact cards with author, rating stars, text, reactions, timestamp
5. **Review list**: Article preview cards with title, rating, word count, excerpt, reactions
6. **"Write a Full Review" link** navigating to `/review/new/:bookUnitId`

**Rationale**: Douban's 短评/长评 model works because remarks are low-friction (inline, no page navigation) while reviews are a commitment (dedicated editor). Combining both on one tab with the rating summary gives a complete picture of community sentiment.

**Rating components**: `RatingInput` (star selector), `RatingOverview` (summary + distribution) — both mocked with `// TODO: rating system being refactored` annotations. They read from `Rating.totalScore` and `Rating.totalCount` via `bookQueries.rating()` which already exists.

### D4: Remark inline UX

**Decision**: Remark creation uses an inline form on the book review tab, not a separate page or dialog.

**Form structure**:
```
[Star Rating: ☆☆☆☆☆]     // TODO: mock RatingInput
[Text input (expandable)]   // No character limit
[Submit Remark]              // Creates PostKind.REMARK with targetUnitId
```

**API call**: `postApi.create({ targetUnitId: bookUnitId, kind: 'REMARK', body: text, extra: { rating: selectedRating } })`

**Rationale**: Inline creation removes friction. Users see existing remarks, form a quick opinion, write it immediately. No context switching. The star rating is optional but encouraged (both reviews and remarks trigger rating aggregation when present).

### D5: Review — 200 character minimum

**Decision**: The review editor enforces a 200-character minimum on the frontend via form validation. The backend will later add a hardcoded check, but frontend enforces first.

**Enforcement**: Character counter below the editor body. Submit button disabled until 200 chars reached. Validation message: "Reviews must be at least 200 characters" (i18n key).

**Review editor fields**: Title (in `post.extra.title`), Body (markdown, main content), Rating (in `post.extra.rating`), Target book (from route param).

### D6: Discussion feature — Post threading on works

**Decision**: Every work (book, game, media) gets a Discussion tab. Discussion threads are Posts with `kind: POST` and `targetUnitId` pointing to the work. Replies are Posts with `parentPostUnitId` set.

**Components**:
- `ThreadList` — top-level posts for a target unit, paginated, sorted by `createdAt` desc
- `ThreadView` — single thread with nested replies (mode: `threaded`, sorted by `sortPath`)
- `ReplyDrawer` — compose reply (reused from current `comment/` feature, refactored)
- `InlinePostForm` — start a new discussion thread (text input + submit)
- `PostCard` — single post rendering with author, body, reactions, reply count

**Data flow**:
- List threads: `postApi.list({ targetUnitId, kind: 'POST', mode: 'flat' })` (only top-level, no parent)
- Load thread: `postApi.list({ rootPostUnitId: threadId, mode: 'threaded' })`
- Create thread: `postApi.create({ targetUnitId, kind: 'POST', body })`
- Reply: `postApi.create({ parentPostUnitId, kind: 'POST', body })`

### D7: Shelf migration strategy

**Decision**: Delete `readlist/` entirely. Build `shelf/` from scratch using the existing 2-file `shelf/` as seed. Do not rename/refactor — the data model is different enough to warrant a rewrite.

**Shelf feature structure**:

```
shelf/
├── page/
│   ├── ShelfListPage.tsx        Landing (/shelf) — editorial
│   ├── ShelfSearchPage.tsx      Search (/shelf/search) — Meilisearch
│   ├── ShelfPage.tsx            Detail with items (exists, enhanced)
│   ├── ShelfEditPage.tsx        Edit shelf metadata + items
│   ├── ShelfByBookPage.tsx      Shelves containing a specific book
│   └── NewShelfPage.tsx         Create new shelf
├── component/
│   ├── ShelfCard.tsx            Card for list views
│   ├── ShelfList.tsx            List/grid of shelves
│   ├── ShelfItemCard.tsx        (exists) Item card with keywords
│   ├── SingleShelf.tsx          Full detail view
│   └── HorizontalShelfCarousel.tsx  Carousel for homepage
└── index.ts
```

**API wiring**: Use `shelfApi.list()` / `shelfApi.mine()` / `shelfApi.get()` directly instead of content-search hacks. Shelf search page uses `contentSearchQueryOptions({ type: 'SHELF' })` for full-text search with tag/keyword filters.

### D8: Realm feature architecture

**Decision**: Full realm feature with 4 page types and a tabbed detail view.

**Realm detail tabs**: Feed | Tags | Members

**Pages**:
- `RealmListPage` — editorial landing at `/realm`
- `RealmSearchPage` — search with filters at `/realm/search`
- `RealmPage` — detail with 3-tab layout (Feed, Tags, Members)
- `RealmManagePage` — settings page for owner/admin (edit metadata, manage roles)
- `NewRealmPage` — create realm form

**Components**:
- `RealmCard` — card display (name, description, member count, public/official badges)
- `RealmContentFeed` — paginated list of units in the realm (via `realmApi.listUnits()`)
- `RealmMemberList` — member list with role badges, role management for moderators+
- `RealmTagManager` — moderators can attach/detach tags to units within the realm context
- `JoinButton` — join/leave toggle with member count

**Data flow**: All realm data comes from `@rezics/api/realm` — `realmApi.list()`, `realmApi.get()`, `realmApi.join()`, `realmApi.leave()`, etc. Content feed uses `realmApi.listUnits()`. Tag curation uses `realmApi.addTagUnit()` / `realmApi.removeTagUnit()`.

### D9: Tag display with realm aggregation

**Decision**: All tags are global. Display is sorted by score. Realm aggregation is additive — it highlights a subset of global tags, it does not create separate tag namespaces.

**Display model**:

```
Global tags (sorted by score):
  [科幻 42] [硬科幻 28] [宇宙 15] [黑暗森林 8] [费米悖论 5]

Realm highlights (from user's preferred realms):
  SF读书会: [硬科幻] [黑暗森林] [费米悖论]
  入门推荐: [科幻] [宇宙]
```

Realm highlights are collapsible sections below the global tag list. Each shows the realm name and the tags that realm's moderators have surfaced for this unit.

**New backend endpoint**: `GET /tags/for-unit/:unitId/context`

Server logic:
1. Fetch `UnitTag` rows for the unit, ordered by score DESC
2. If authenticated: read `User.settings.realmTagPreferences[unitType]` to get preferred realm IDs and rank
3. If no preferences: use first N realms from user's membership (via `RealmMember`)
4. Query `RealmTagUnit WHERE unitId = :unitId AND realmUnitId IN (:preferredRealmIds)`
5. Join with tag translations and realm translations for labels
6. Return merged response: `{ tags: UnitTagDTO[], realmHighlights: RealmTagHighlight[] }`

This is a single endpoint, resolved server-side. No N+1 queries from the frontend.

### D10: User settings — User.settings JSON column

**Decision**: Extend the `User` model with a `settings Json?` column. This stores user-configurable preferences including realm-tag preferences and language settings. Do not use EchoKV for user settings.

**Schema**:
```typescript
interface UserSettings {
  realmTagPreferences?: {
    [unitType: string]: {
      realmIds: string[];    // Ordered by rank, max 50
      maxDisplay: number;    // How many realm groups to show
    };
  };
  preferredLanguages?: string[];  // e.g. ['zh-CN', 'en', 'ja']
}
```

**API**:
- `GET /users/me/settings` — returns current settings
- `PUT /users/me/settings` — deep-merge update (partial updates allowed)

**Rationale**: User settings are per-user persistent configuration. EchoKV is a key-value store for app-wide configuration (announcements, feature flags). Using User.settings keeps user data in the user domain, enables server-side resolution (tag context endpoint can read User.settings directly), and doesn't pollute EchoKV namespace.

**Limit**: realmIds arrays capped at 50 entries per unit type (validated server-side).

### D11: Multilingual UI

**Decision**: Three components form the multilingual layer:

1. **TranslationTabs** — on unit detail views, shows available languages from `translations[]` as clickable tabs. Switching a tab re-renders the page using that language's translation data.

2. **TranslationEditor** — in edit forms (book edit, shelf edit, tag edit), provides a tabbed interface for managing translations per language. Users can add new languages, edit existing translations, and set the primary language.

3. **WorkReleaseNav** — on book detail pages, shows other releases of the same work (queried by `workUnitId`). Each release links to its detail page.

**Translation resolution upgrade**: Replace the hardcoded fallback chain `['zh-CN', 'zh', 'en', 'ja']` in `translation-helpers.ts` with a user-preference-aware chain:

```typescript
function getTranslation(translations, explicitLanguage?) {
  const chain = [
    explicitLanguage,
    ...getUserPreferredLanguages(),  // from User.settings.preferredLanguages
    ...SYSTEM_FALLBACK,              // ['zh-CN', 'zh', 'en', 'ja']
  ].filter(Boolean);
  // resolve from chain...
}
```

**Tag label localization**: Tags are Units with translations. `getTranslation(tag.translations, userPreferredLanguage)` resolves the label. The existing `tagLabel` field in `UnitTagDTO` returns the first translation; the frontend overrides with user-preferred language.

### D12: Homepage ecosystem design

**Decision**: Homepage becomes an ecosystem gateway with library section cards and content preview sections.

**Layout**:
1. Hero section — brand identity, unified search bar
2. Library cards — Book Library (active), Game Library (coming soon), Media Library (coming soon)
3. Featured from Book Library — carousel of featured/new books
4. Trending Shelves — horizontal shelf cards
5. Recent Reviews — review preview cards
6. Active Realms — realm cards with member counts
7. Announcements — from EchoKV (existing)

**Existing sections moved to /book landing**: New Releases tabs (最新连载/最新上架/近期完结), Rankings, Editor Picks, Author Spotlight, Tag Explore, Wiki, Partner Brands, Newsletter, Mobile CTA. These are book-specific content that belongs on the Book Library landing page, not the ecosystem homepage.

### D13: Navigation update

**Decision**: Sidebar navigation restructured:

```
Home              /
────────────────────
Book Library      /book
Shelves           /shelf
Reviews           /review
Realms            /realm
Quotes            /quote
────────────────────
My Shelves        /shelf?userId=me
My Reviews        /review?userId=me
My Realms         /realm/me
────────────────────
+ Create          dropdown: Book, Shelf, Review, Quote, Realm
```

Footer product links updated: Discover→/book, Shelves→/shelf, Reviews→/review, Realms→/realm.

## Risks / Trade-offs

**[Large scope] → Phased implementation with clear boundaries**
This change touches ~100 files across 4 packages. Mitigated by splitting into 7 independent phases. Phases 2-4 (shelf, review/remark, realm) can proceed in parallel. Each phase produces a self-contained, testable increment.

**[Rating system mocked] → TODO annotations for future change**
The rating system is under separate refactoring. All rating UI components (`RatingInput`, `RatingOverview`, rating distribution) are mocked with `// TODO: rating system being refactored` annotations. They read from the existing `bookQueries.rating()` endpoint for basic average/count display but distribution data is fabricated.

**[COMMENT removal in Prisma] → Existing data unaffected**
Removing `COMMENT` from the `PostKind` enum doesn't require a data migration. Existing rows with `kind = 'COMMENT'` remain in the database. The application code simply stops creating new posts with this kind. If needed, a future migration can batch-update `COMMENT` posts to `POST`.

**[No backward-compatible redirects] → Clean break**
`/readlist/*` routes are removed without redirects. External links to old routes will 404. This is acceptable per requirements (no backward compatibility needed). If analytics show significant traffic to old URLs, redirects can be added later as a minimal follow-up.

**[New backend endpoints required] → Small, focused additions**
Four new endpoints are needed: `GET /tags/for-unit/:unitId/context`, `GET /realms/me`, `GET /users/me/settings`, `PUT /users/me/settings`. These are straightforward queries on existing data. The `User.settings` column addition is a single Prisma migration with no data transformation.

**[Dead code removal] → Verified non-functional**
The `comment/` server domain references `prisma.commentIndex` which does not exist in the schema or any migration. The contract files are empty stubs. Removing them cannot break working functionality.

## Open Questions

1. **COMMENT→POST migration**: Should existing `kind: 'COMMENT'` rows be batch-updated to `kind: 'POST'`? Or left as historical data? If left, queries filtering by `kind: 'POST'` won't include them. Recommendation: batch-update in a follow-up migration, not in this change.

2. **Realm-tag preferences default**: When a user has no realm-tag preferences configured, should the tag context endpoint return highlights from all joined realms (capped at 5) or return no realm highlights? Recommendation: return highlights from the 5 most recently joined realms as a sensible default.

3. **Remark/Review on non-book works**: The review tab UX is designed for books. When game and media libraries launch, should the same tab structure apply? Recommendation: yes — the tab layout is generic enough (rating + remarks + reviews) for any work type.
