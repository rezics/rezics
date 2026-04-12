## Why

The backend has undergone three fundamental architectural shifts — Post unification (replacing Comment, Review, Remark), Shelf replacement of Readlist, and the introduction of Realm communities — but the frontend still reflects the old data model. The contract has deprecated `comment.ts`, `review.ts`, and `readlist.ts` (all empty stubs), yet the frontend still imports from legacy patterns, references non-existent `UnitType` values (`COMMENT`, `NOTE`, `REVIEW`, `READLIST`), and has ~50 `// MOCK:` annotations marking workarounds for APIs that now exist. The `comment/` server domain is dead code (references a `CommentIndex` table that does not exist in the Prisma schema or any migration). Realm, multilingual UI, and realm-tag aggregation have zero frontend implementation despite full backend support. The app is non-functional in several areas and the divergence is growing.

## What Changes

### Removals

- **BREAKING**: Delete `package/app/src/readlist/` feature directory (10+ files, 5 routes). Replaced by `shelf/`.
- **BREAKING**: Delete `package/app/src/comment/` feature directory (8 files). Replaced by `discussion/` using the Post threading model.
- **BREAKING**: Remove `PostKind.COMMENT` from the Prisma enum and contract. Threading via `parentPostUnitId` handles all reply semantics.
- **BREAKING**: Remove routes `/readlist/*`. Replaced by `/shelf/*`.
- Remove empty contract stubs: `comment.ts`, `review.ts`, `readlist.ts` from `package/contract/src/`.
- Remove dead server domain `package/server/src/comment/` (CommentIndex table does not exist).
- Remove invalid `UnitType` references in frontend: `COMMENT`, `NOTE`, `REVIEW`, `READLIST` in `build-url.ts`, `UserUnitsPage.tsx`, `UnitsPage.tsx`.

### New Features

- **Shelf feature** (`package/app/src/shelf/`): Full CRUD pages, browse/search at `/shelf/search`, detail view with grid/list/review modes, item management, keyword filtering.
- **Realm feature** (`package/app/src/realm/`): Full CRUD, membership management (join/leave/roles), content feed, realm-scoped tag curation for moderators. Routes at `/realm/*`.
- **Discussion feature** (`package/app/src/discussion/`): Threaded discussion on any work's detail page. Uses Post model with `kind: POST` and `targetUnitId`. New discussion tab on book detail.
- **Remark inline UX**: Inline remark creation form on the book review tab (star rating + text, Douban-style 短评). Remarks use `PostKind.REMARK`, trigger rating aggregation, no character limit.
- **Review enforcement**: Long-form reviews (`PostKind.REVIEW`) enforce 200-character minimum on frontend. Dedicated editor page with markdown support.
- **Realm-tag context display**: Tag display on units shows all global tags sorted by score, plus realm-aggregated highlights from the user's preferred realms. New backend endpoint `GET /tags/for-unit/:unitId/context`.
- **User realm-tag preferences**: Per-unit-type configuration of which realms influence tag display and their rank order. Stored in a new `settings` JSON column on the `User` table (not EchoKV). Max 50 realms per unit type.
- **Multilingual UI**: Language switcher for unit detail views, translation editor for creating/editing per-language content, work/release navigation between editions, tag label localization using user's preferred language.
- **Ecosystem homepage**: Homepage redesigned with library section cards (Book, Game, Media), content previews (shelves, reviews, realms), and links to dedicated browse pages.
- **Search route separation**: Browse/discovery at root routes (`/book`, `/shelf`, `/review`, `/realm`). Full search with filtering at sub-routes (`/book/search`, `/shelf/search`, `/review/search`, `/realm/search`).
- **Backend endpoints**: `GET /realms/me` (joined realms), `GET /tags/for-unit/:unitId/context` (tag context with realm highlights), `GET /users/me/settings`, `PUT /users/me/settings` (user settings including realm-tag preferences).

### Modifications

- **PostKind contract formalization**: Change `kind` field from `t.Optional(t.String())` to a typed union of `REVIEW | REMARK | QUOTE | POST` in `package/contract/src/post.ts`.
- **Book detail tabs**: Rework from 3 tabs (Info, Review, Content) to 4 tabs (Info, Content, Reviews & Ratings, Discussion).
- **Navigation sidebar**: Update entries — rename Readlists→Shelves, add Realms, add My Shelves/My Realms, update Create menu.
- **Translation helpers** (`package/app/src/shared/util/translation-helpers.ts`): Replace hardcoded `['zh-CN', 'zh', 'en', 'ja']` fallback with user-preference-aware chain.
- **Rating UI**: Mock rating input and distribution components with `// TODO:` annotations (rating system under separate refactor).
- **Resolve ~50 MOCK annotations**: Replace content-search-as-list-query hacks with proper API calls (`shelfApi.list()`, `postApi.list({ kind })`, etc.) now that backend endpoints exist.

## Capabilities

### New Capabilities

- `shelf-migration`: Complete readlist-to-shelf frontend migration — delete readlist/ feature, build shelf/ with full CRUD pages, routes at `/shelf/*` and `/shelf/search`, update navigation/footer/locale/URL builder, wire to shelf API and replace content-search hacks.
- `review-remark-ux`: Distinct Review (long-form, 200 char min, dedicated editor, PostKind.REVIEW) and Remark (inline creation on book page, no char limit, PostKind.REMARK) UX. Rating input/overview components (mocked). Book detail review tab redesign with rating summary, inline remark form, and sub-tab toggle between remarks and reviews.
- `work-discussion`: Threaded discussion feature on work detail pages using Post model (kind: POST, targetUnitId). Delete comment/ feature, build discussion/ module with ThreadList, ThreadView, ReplyDrawer, InlinePostForm. Add Discussion tab to book detail layout.
- `realm-frontend`: Full realm feature — RealmListPage (browse/search at /realm and /realm/search), RealmPage (detail with content feed, tag curation, member list), RealmManagePage (settings for owner/admin), NewRealmPage, JoinButton, RealmTagManager. Navigation integration.
- `realm-tag-context`: Realm-based tag aggregation — new backend endpoint `GET /tags/for-unit/:unitId/context` returning global tags plus realm highlights for authenticated users. User realm-tag preferences stored in User.settings JSON column (max 50 realms per unit type). Frontend RealmTagHighlights component and RealmTagPreferences settings page. Backend `GET /realms/me` endpoint for joined realms.
- `multilingual-ui`: Frontend multilingual support — TranslationTabs (switch display language on unit detail views), TranslationEditor (multi-language editing in book/unit edit forms), WorkReleaseNav (navigate between editions of the same work), tag label localization (resolve tag translations in user's preferred language), LanguagePreference settings.
- `homepage-ecosystem`: Ecosystem-aware homepage — library section cards (Book, Game, Media with stats and links), content preview sections (featured books, trending shelves, recent reviews, active realms), search routes separation (`/book/search`, `/shelf/search`, `/review/search`, `/realm/search`).
- `post-kind-contract`: Formalize PostKind as typed enum in contract (REVIEW, REMARK, QUOTE, POST), remove COMMENT, clean up all frontend UnitType references to non-existent values (COMMENT, NOTE, REVIEW, READLIST), remove empty contract stubs.

### Modified Capabilities

- `type-extension-post`: PostKind enum formalized — COMMENT removed from Prisma enum and contract. Comment server domain (`package/server/src/comment/`) deleted (dead code — CommentIndex table never existed). All comment/reply functionality handled by Post threading model (`parentPostUnitId`, `depth`, `sortPath`).

## Impact

### Affected Packages

| Package | Scope |
|---------|-------|
| `package/app` | Major: feature directories added/deleted/rewritten, routes restructured, navigation/locale updated, ~50 MOCK annotations resolved |
| `package/contract` | Moderate: PostKind enum, empty stubs removed, realm-tag context types, user settings types |
| `package/api` | Minor: realm-tag context query hooks, user settings hooks, possible new query wrappers |
| `package/server` | Moderate: new endpoints (tag context, realms/me, user settings), comment/ domain deleted, PostKind enum update |
| `package/admin` | Minor: navigation label updates (already uses "shelves") |
| `package/ui` | Minor: possible new shared components (RatingInput, TranslationTabs) |
| `package/search` | None: Meilisearch integration unchanged |

### Database Changes

- `User` model: Add `settings Json?` column for user preferences (realm-tag preferences, language preference).
- `PostKind` enum: Remove `COMMENT` value.
- No table additions. No data migrations needed (COMMENT posts can remain as-is; their kind value becomes unused).

### API Changes

- New: `GET /tags/for-unit/:unitId/context` — tag context with realm highlights (auth optional)
- New: `GET /realms/me` — current user's joined realms (auth required)
- New: `GET /users/me/settings` — user settings JSON (auth required)
- New: `PUT /users/me/settings` — update user settings (auth required)
- Deprecated: All `/comments/*` endpoints (dead code, to be removed)
- Modified: `POST /posts` query param `unitType` usage cleaned up

### Breaking Changes

- `/readlist/*` routes removed (no backward compatibility, per requirements)
- `PostKind.COMMENT` removed from enum
- Empty contract files (`comment.ts`, `review.ts`, `readlist.ts`) removed — any imports will break at compile time
- Frontend `UnitType.COMMENT`, `UnitType.NOTE` references removed
