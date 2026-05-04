## Why

The realm system has accumulated a rich spec set (14+ specs) and a solid backend foundation (Prisma models, services, search index, default-realm bootstrap), but realms still cannot function as standalone forums. Posts cannot be created from a realm context, the realm content feed silently borrows the unrelated `Post.targetUnitId` reply field as its filter, and realm extras (`pinboard`, `announcement`) lack the curation slots (`rule`, `about`, `banner`, `tagTree`) that any usable forum surface needs. Worse, the data model carries an asymmetry: posts associate with tags through the `UnitTag` junction (clean, many-to-many) but with realms through a direct `Post.realmUnitId` foreign key (single-realm, breaks symmetry). This change closes the gap between the rich spec surface and a usable forum experience, and corrects the schema asymmetry while doing it.

## What Changes

- **BREAKING**: Drop `Post.realmUnitId` column, `Post.realm` relation, and `Unit.realmPosts` relation. Migrate all existing rows into `RealmUnit` junction entries. `RealmUnit` becomes the single source of truth for post-realm membership, mirroring how `UnitTag` indexes post-tag membership.
- **BREAKING**: `createPost` payload field `realmUnitId: string?` becomes `realmUnitIds: string[]?` to support cross-posting natively. The same call writes corresponding `RealmUnit` rows in one transaction. Add optional `tagIds: string[]?` to write `UnitTag` rows in the same transaction.
- Switch `RealmContentFeed` from the `byTarget(realmId)` query (which abuses `Post.targetUnitId`) to a new `byRealm(realmId)` query that joins through `RealmUnit`. `Post.targetUnitId` reverts to its real meaning: replying to a specific unit.
- Extend `realmExtraSchema` with four new keys: `rule: unitId` (single Post id, rendered as join-time consent modal), `about: unitId` (single Post id, rendered in sidebar), `banner: unitId | { url }`, and `tagTree: Node[]` where `Node = { tagId?, label?, disabled?, children? }`.
- All curation content (`pin`, `announcement`, `rule`, `about`, `banner`, future `wiki`) reuses the existing pattern from `package/app/src/pinboard/hooks/usePinboard.ts`: store unit ids in `Realm.extra`, fetch via `unitDetailQuery`, resolve translation via `getTranslation`. Multi-language is automatic through Unit's self-relation work/release (`Unit.workUnitId` + `Unit.releases[]`). No new tables, no new pipelines.
- Add a top-level realm post composer (either a new `TopLevelPostComposer` or extending `ReplyComposer` to accept `realmUnitIds` and `tagIds`). The composer is reachable from `RealmPage` via a "post in this realm" entry. The tag picker uses `realm.extra.tagTree` as a quick-pick UX hint while still allowing free search across the global tag pool.
- Add join-time rule consent: `JoinButton` checks `realm.extra.rule`, fetches the referenced Post if present, renders a modal with the rule content and an "agree and join" button. Joining is consent — no acknowledgment table, no backend changes. Rule updates flow through the existing `pinboard`/`announcement` + notify channels.
- Add forum surface sections to `RealmPage`: `RuleSection`, `AboutSection`, `BannerSection`, `RealmFeedSortSwitcher` (hot/new/top), `RealmFeedTagFilter` (filters feed by tagTree leaf nodes via `RealmTagUnit`/`UnitTag`).
- Add server-side post sort modes: `new` (createdAt desc), `top` (score desc), `hot` (time-decayed score). Add tag filter parameters to `PostListQuery`.
- Extend `/realm/:id/manage` with a `tagTree` editor (drag-reorder, add/remove leaves, toggle `disabled`) and a Post-id picker for `rule`/`about`/`banner` slots. Existing pinboard/announcement admin UIs stay.
- Meilisearch: add `realmIds: string[]` multi-value facet to the post index document (sourced from `RealmUnit`). Search supports filtering posts by realm via this facet.

## Capabilities

### New Capabilities
- `realm-forum-composer`: Top-level realm post composition with `realmUnitIds[]` + `tagIds[]`, tagTree-driven quick-pick UX, transactional `RealmUnit` and `UnitTag` writes.
- `realm-join-rule-consent`: Join-time rule modal that fetches `extra.rule` Post, renders multi-language content, and gates the join action behind explicit acknowledgment.
- `realm-feed-query`: `byRealm(realmId)` query path joining through `RealmUnit`, with `sort: hot|new|top` and `tagIds` filter parameters.
- `realm-post-junction`: Schema invariant declaring `RealmUnit` as the single source of truth for post-realm membership (parallel to `UnitTag` for post-tag membership). Documents the `Post.realmUnitId` removal and migration contract.

### Modified Capabilities
- `realm-extra-pinboard-keys`: Adds well-known keys `rule` (single unitId), `about` (single unitId), `banner` (unitId or `{url}`), and `tagTree` (`Node[]`). Defines `Node` schema with `tagId?`, `label?`, `disabled?`, `children?`.
- `realm-frontend`: Adds top-level forum surface (rule/about/banner sections, sort switcher, tag filter), management page extensions (tagTree editor, slot pickers), and "post in this realm" entry point.
- `realm-tag-unit`: Clarifies relationship to `extra.tagTree` — the tree is a UX hint, not a constraint; `RealmTagUnit` continues to track realm-scoped tag-on-unit usage independently.
- `post-reply-composer`: Composer (or its top-level sibling) accepts `realmUnitIds` and `tagIds`; `targetUnitId` semantics narrow to "reply target" only.
- `post-search-index`: Post index document gains `realmIds: string[]` multi-value facet sourced from `RealmUnit`; sync hooks fire on `RealmUnit` insert/delete and on post create.

## Impact

**Affected packages:**
- `package/server` — Prisma schema migration (drop `Post.realmUnitId`, backfill `RealmUnit`), `post.api.ts`/`post.service.ts` (createPost contract change, sort modes, tag filter), `realm-extra.api.ts`/`realm-extra.service.ts` (new keys), Meilisearch sync hooks
- `package/contract` — `createPostSchema`, `PostListQuery`, `realmExtraSchema`, new `tagTreeNode` type
- `package/api` — new `postQueries.byRealm(realmId, opts)`, deprecate `byTarget` for realm-feed usage, new `realmExtra` mutation hooks for rule/about/banner/tagTree
- `package/app` — new `TopLevelPostComposer` (or extended `ReplyComposer`), new `RuleSection`/`AboutSection`/`BannerSection`/`RealmFeedSortSwitcher`/`RealmFeedTagFilter`, `JoinButton` rule-consent flow, `/realm/:id/manage` extensions, `RealmContentFeed` rewired to `byRealm`
- `package/search` — post index document schema change, sync trigger on `RealmUnit` mutations

**Backward compatibility:**
- Schema migration is one-way and irreversible after column drop. Migration must run with zero `Post.realmUnitId` writes in flight (deploy ordering: backfill → API switch → column drop in a follow-up migration).
- API contract change (`realmUnitId` → `realmUnitIds[]`) is breaking for any external client. Internal callers updated atomically.
- Frontend `RealmContentFeed` query key changes; cached queries from `byTarget(realmId)` invalidate naturally.
- Existing realms without `extra.rule` keep zero-step join behavior — no UX regression.

**Out of scope (future changes):**
- Mod queue / content moderation workflow (genuinely new concept)
- Full wiki navigation UI (the `extra.wiki: unitId[]` data shape is trivial; the page experience needs its own design)
- Custom CSS / theme upload (file upload + safety review)
- Scheduled posts
