## 1. Contract scaffolding (no behaviour change)

- [ ] 1.1 In `package/contract/src/realm/realm-extra.ts`, add `rule?: string`, `about?: string`, and `banner?: { kind: "post"; unitId: string } | { kind: "url"; url: string }` to `realmExtraSchema`. Each new key carries a JSDoc comment describing intended use; keep `additionalProperties: true`. Re-export from `package/contract/src/realm/index.ts`.
- [ ] 1.2 In `package/contract/src/realm/realm-extra.ts`, define `tagTreeNodeSchema` as a recursive Typebox schema matching `{ tagId?: string; label?: string; disabled?: boolean; children?: TagTreeNode[] }`. Add `tagTree?: TagTreeNode[]` to `realmExtraSchema`. Export both `TagTreeNode` and `tagTreeNodeSchema`.
- [ ] 1.3 In `package/contract/src/post/create.ts` (or equivalent createPost contract module), change `realmUnitId?: string` to `realmUnitIds?: string[]`. Add `tagIds?: string[]`. Add a JSDoc note that `realmUnitIds` writes `RealmUnit` junction rows in the same transaction.
- [ ] 1.4 In `package/contract/src/post/list.ts` (or the file defining `PostListQuery`), add `realmUnitId?: string` (the realm to filter to) and `tagIds?: string[]` filter parameters, plus `sort?: "new" | "top" | "hot"` (default `"new"`). Mark the legacy single-realm-via-targetUnitId path as deprecated in JSDoc.
- [ ] 1.5 Run `bun run typecheck` in `package/contract` and any package that imports the changed types. Fix every consumer compile error by passing the new shape (callers should pass `realmUnitIds: [singleId]` for the period before composer changes ship). No runtime behaviour yet.

## 2. Locale entries for new extra keys

- [ ] 2.1 Author the English JSDoc string for each of `rule`, `about`, `banner`, `tagTree` in the contract source (these become the source of truth for locale text per the convention).
- [ ] 2.2 In every file under `package/app/src/locale/`, add entries at `realm.extra.rule.note`, `realm.extra.about.note`, `realm.extra.banner.note`, and `realm.extra.tagTree.note`. Start with the English string for non-English locales (translation can land in a follow-up); each value SHALL be a non-empty string.
- [ ] 2.3 Verify `bun run check:convention` (or whichever rule enforces locale parity) still passes.

## 3. Phase A — Server dual-write + RealmUnit-backed reads

- [ ] 3.1 In `package/server/src/post/post.service.ts`, locate `createPost`. Add transactional handling for `realmUnitIds: string[]?` — for each realm id, insert a `RealmUnit(realmUnitId, unitId, createdAt)` row inside the same `prisma.$transaction` that creates the Unit and Post. Continue writing `Post.realmUnitId` if the legacy field is still present in input (Phase A dual-write). Roll back on any insert error.
- [ ] 3.2 In `package/server/src/post/post.service.ts`, add transactional handling for `tagIds: string[]?` — insert `UnitTag(unitId, tagUnitId)` rows inside the same transaction. Validate that each `tagUnitId` references an existing tag-typed Unit; reject the whole transaction with 400 if any id is invalid.
- [ ] 3.3 Add a `byRealm(realmId, opts)` query in `package/server/src/post/post.service.ts` that joins `RealmUnit` to `Post` with `RealmUnit.realmUnitId = realmId`. Accept `opts.sort: "new" | "top" | "hot"`, `opts.tagIds?: string[]`, plus the existing pagination shape. Keep the existing query signature for `byTarget` unchanged.
- [ ] 3.4 Implement sort modes inside `byRealm`: `new` orders by `Post.createdAt DESC`; `top` orders by `ScoreEntry.value DESC` (left-join to `ScoreEntry`, treat null as 0); `hot` (phase-1 approximation) orders by `top` filtered to `createdAt > now() - INTERVAL '7 days'`. Document the approximation in code comments referencing `design.md` Decision 5.
- [ ] 3.5 Implement `tagIds` filter inside `byRealm`: prefer matching via `RealmTagUnit(realmUnitId = realmId, unitId = post.unitId, tagUnitId IN tagIds)`; fall back to `UnitTag(unitId = post.unitId, tagUnitId IN tagIds)` when no `RealmTagUnit` rows exist for the post. Multi-tag uses OR semantics (any-of-tags hits).
- [ ] 3.6 Add `GET /post/list?realmUnitId=...&sort=...&tagIds=...` route handling in `package/server/src/post/post.api.ts` that dispatches to `byRealm` when `realmUnitId` is present. Keep `byTarget` dispatch unchanged for non-realm `targetUnitId` callers. For Phase A only, add a deprecation log line when `byTarget` is called with a realm-typed target Unit.
- [ ] 3.7 Add a unit/integration test under `package/server/src/post/__tests__/` for `createPost` covering: post in zero realms, post in one realm, post in three realms, post with `tagIds`, post with both `realmUnitIds` and `tagIds`, and rollback when one realm in the list does not exist.
- [ ] 3.8 Add a unit/integration test for `byRealm` covering: empty result, single-realm filter, sort=new ordering, sort=top ordering, sort=hot 7-day window, tagIds OR semantics, RealmTagUnit/UnitTag fallback path, pagination.
- [ ] 3.9 Verify `bun run dev` (server) starts cleanly and `bun test` in `package/server` passes.

## 4. Phase A — Realm extra single-valued endpoints

- [ ] 4.1 In `package/server/src/realm/realm-extra.api.ts` (or the file where pinboard/announcement endpoints live), add `PUT /realms/:realmId/extra/:key` and `DELETE /realms/:realmId/extra/:key` handlers that route to a service method shared with the list-form endpoints' row-locking implementation.
- [ ] 4.2 In `package/server/src/realm/realm-extra.service.ts`, add `setSingleExtraKey(realmId, key, value)` and `clearSingleExtraKey(realmId, key)` that serialize per-realm via the same row-lock the list-form keys use. Validate `key ∈ { "rule", "about", "banner" }` and value shape against the contract Typebox schema.
- [ ] 4.3 Add server-side validation: `PUT .../extra/rule` and `PUT .../extra/about` reject non-existent or non-Post-typed Unit ids with 400. `PUT .../extra/banner` accepts both `{ kind: "post"; unitId }` (validates Post existence) and `{ kind: "url"; url }` (validates URL is a string).
- [ ] 4.4 Add `PUT /realms/:realmId/extra/tagTree` and `DELETE /realms/:realmId/extra/tagTree` handlers. Validation recurses through the tree: each node with `tagId` references an existing tag-typed Unit; nodes without `tagId` SHALL have `disabled: true` and a `label`; reject with 400 otherwise.
- [ ] 4.5 Add authorization: all four new endpoints require moderator role on the realm OR `hasAuthorityOver(caller, realmUnit)`. Mirror the existing list-form endpoint auth checks.
- [ ] 4.6 Add tests under `package/server/src/realm/__tests__/` for: setting and replacing each key, clearing each key, validation rejection for nonexistent ids and bad shapes, authorization rejection for non-moderator callers, concurrent-write serialization.
- [ ] 4.7 Add read-time stale-ID filtering for `rule`, `about`, and `banner.unitId` (when `banner.kind = "post"`). Public reads return `null` (or omit) for stale ids; admin reads include the stored id with a stale marker. Mirror the existing pinboard/announcement filtering rule.

## 5. Phase A — Search index post document gains realmIds

- [ ] 5.1 In `package/search` (or wherever the post index sync lives — see `package/server/src/search/post-search.service.ts` if that is the path), update the post document builder to include `realmIds: string[]` sourced from `RealmUnit` rows where `RealmUnit.unitId = post.unitId`. Empty array when post has no realms.
- [ ] 5.2 Update the Meilisearch index settings call to add `realmIds` to `filterableAttributes`. Keep `realmUnitId` (singular) in `filterableAttributes` for Phase A so cached query strings keep working; remove it in Phase C task 9.5.
- [ ] 5.3 Hook `RealmUnit` insert and delete events to fire-and-forget partial updates on the post document (`patchPostFields(unitId, { realmIds })`). Errors log but do not fail the originating mutation.
- [ ] 5.4 Run a one-shot reindex script that walks every post, computes its `realmIds` from current `RealmUnit` state, and partial-updates the document. This is the bridge from "old documents have only `realmUnitId`" to "new documents have `realmIds`".
- [ ] 5.5 Add a test verifying a post created with `realmUnitIds: ["r1", "r2"]` produces a Meilisearch document with `realmIds: ["r1", "r2"]` (order-independent), and that adding/removing a `RealmUnit` row updates the field.

## 6. Phase A — Frontend composer extension

- [ ] 6.1 In `package/app/src/post/composer/ReplyComposer.tsx` (or wherever `ReplyComposer` lives), extend props with optional `realmUnitIds?: string[]` and `tagIds?: string[]`. Keep `mode: "progressive" | "expanded"`, `targetUnitId`, `parentPostUnitId` unchanged.
- [ ] 6.2 Define a TypeScript discriminated union for the prop shape: `replyMode = { targetUnitId?: string; parentPostUnitId?: string; realmUnitIds?: never }` vs `realmPostMode = { realmUnitIds: string[]; targetUnitId?: never; parentPostUnitId?: never }`. The component types SHALL reject mixing.
- [ ] 6.3 Add a runtime invariant assertion at mount: throw (or `console.error` + render error UI in development) if both reply props and `realmUnitIds` are present.
- [ ] 6.4 In realm-post mode (`realmUnitIds` non-empty), render a tag picker above or beside the action buttons. Hydrate the picker from `realm.extra.tagTree` of the first realm in `realmUnitIds` (when only one realm is supplied). When multiple realms are supplied, fall back to search-only.
- [ ] 6.5 The tag picker SHALL render `tagTree` leaves as quick-pick chips, group `disabled: true` nodes as section headers, and provide a search input that hits the global tag pool. Selection state lives in the picker; `tagIds` prop only seeds initial state.
- [ ] 6.6 On submit, build the createPost payload with `body`, `realmUnitIds`, and `tagIds` from picker state. Do NOT send `targetUnitId` or `parentPostUnitId` in realm-post mode.
- [ ] 6.7 Add a focus behaviour: in realm-post mode, focus the body input on mount; in expanded reply mode keep existing focus behaviour.
- [ ] 6.8 Add a Storybook story under `package/app/src/post/composer/__stories__/` covering reply mode, realm-post mode with single realm + populated tagTree, realm-post mode with empty tagTree (search-only), and the tagTree disabled-node header rendering.

## 7. Phase A — Realm page entry point + forum surface

- [ ] 7.1 In `package/app/src/realm/pages/RealmPage.tsx` (or equivalent), add a "Post in this realm" button visible to realm members. Clicking opens a modal or navigates to a composer surface with `<ReplyComposer mode="expanded" realmUnitIds={[realmId]} />`. Hide the button for non-members; show a "Join to post" affordance instead.
- [ ] 7.2 Switch `RealmContentFeed` from `byTarget(realmId)` to `byRealm(realmId)`. Wire the `sort` and `tagIds` query params so they flow into the underlying `postQueries.byRealm` call.
- [ ] 7.3 Create `package/app/src/realm/sections/RuleSection.tsx`. Reads `realm.extra.rule`; if set and the referenced Post exists, fetch via `unitDetailQuery` and render title + brief preview. Click opens the same modal used by the join-rule-consent flow (with a "Close" button instead of "Agree and Join" since user is not joining).
- [ ] 7.4 Create `package/app/src/realm/sections/AboutSection.tsx`. Reads `realm.extra.about`; if set, fetch the Post and render in the sidebar. Reuse the pinboard rendering pipeline (work-release self-relation + `getTranslation`) for multi-language.
- [ ] 7.5 Create `package/app/src/realm/sections/BannerSection.tsx`. Reads `realm.extra.banner`. When `kind = "url"`, render `<img src={banner.url}>`. When `kind = "post"`, fetch the Post and render its first image asset (or `extra.coverUrl` if provided), falling back to a textual title-only banner.
- [ ] 7.6 Mount `BannerSection` at the top of `RealmPage`, `RuleSection` in the header or sidebar area, and `AboutSection` in the sidebar. All three sections SHALL render unconditionally hidden when their corresponding extra key is unset.
- [ ] 7.7 Create `package/app/src/realm/sections/RealmFeedSortSwitcher.tsx`. Three options: New / Top / Hot. Reads selected sort from URL `?sort=` query param (default New). Selecting an option updates URL and re-issues `byRealm` with the new sort.
- [ ] 7.8 Create `package/app/src/realm/sections/RealmFeedTagFilter.tsx`. Reads `realm.extra.tagTree`; renders each tag-bearing leaf (excluding `disabled: true` leaves) as a selectable chip. Multi-select with OR semantics. Selected chips appear in URL `?tags=t1,t2`; selecting/deselecting re-issues `byRealm` with `tagIds`.
- [ ] 7.9 Mount `RealmFeedSortSwitcher` and `RealmFeedTagFilter` in the Feed tab. Verify sort + filter compose: selecting `sort=top` and a chip emits `byRealm(realmId, { sort: "top", tagIds: [chip] })`.
- [ ] 7.10 Verify all sections render correctly for: realm with all keys set, realm with only some keys, realm with deleted unit ids in keys (sections should hide), unauthenticated viewer (sections still show, since rule/about/banner are public).

## 8. Phase A — Join rule consent

- [ ] 8.1 In `package/app/src/realm/components/JoinButton.tsx` (or wherever `JoinButton` is defined), check `realm.extra.rule` on click. If unset, call the existing join API directly (zero-step path preserved).
- [ ] 8.2 If `extra.rule` is set, fetch the referenced Post via `unitDetailQuery`. Open a modal that renders the Post body using the pinboard rendering pipeline (work-release self-relation + multi-language).
- [ ] 8.3 The modal SHALL show two buttons: "Cancel" (closes the modal, no join) and "Agree and Join" (calls the existing join API). No backend changes.
- [ ] 8.4 Handle the case where `extra.rule` references a deleted/missing Post: the public read filtering already returns `null`, so `JoinButton` falls back to zero-step join. Add a defensive log if the modal flow ever renders an empty Post.
- [ ] 8.5 Add a Storybook story for `JoinButton` covering: realm with no rule (one-click join), realm with rule + simple body, realm with rule + multi-language releases, realm with rule referencing a deleted Post.
- [ ] 8.6 Reuse the same modal component for `RuleSection` click target (task 7.3), with the only difference being the bottom button: "Close" when not joining, "Agree and Join" when invoked from `JoinButton`.

## 9. Phase A — Realm management page extensions

- [ ] 9.1 In `package/app/src/realm/pages/RealmManagePage.tsx` (or equivalent), add a `tagTree` editor section accessible to admins (realm role admin or above, OR global admin/root). MVP: flat list with optional one level of nesting (drag-reorder, add/remove leaves, toggle `disabled`). Full arbitrary-depth tree editing is a follow-up.
- [ ] 9.2 The tagTree editor SHALL provide: "Add leaf" (search-and-pick from global tag pool), "Add header" (creates `{ disabled: true, label }`), drag-or-arrow reorder, delete, toggle `disabled` on existing nodes.
- [ ] 9.3 The editor's Save button calls `PUT /realms/:realmId/extra/tagTree` with the resulting array. Show validation errors from the server (nonexistent tag id, malformed node) inline.
- [ ] 9.4 Add three slot pickers — one each for `rule`, `about`, `banner`. Each allows search-and-pick from existing Posts (within or outside the realm) by title, plus a "Clear" button. The banner picker additionally allows entering a direct URL (sets `banner.kind = "url"`).
- [ ] 9.5 Each slot picker's Save button calls `PUT /realms/:realmId/extra/:key` with the appropriate payload, or `DELETE /realms/:realmId/extra/:key` when cleared.
- [ ] 9.6 Authorization: hide the management page section entirely for non-admins. Server-side authorization (task 4.5) is the load-bearing check.
- [ ] 9.7 Add a Storybook story for each picker covering: empty state, populated state, search-and-select flow, clear flow.

## 10. Phase A — End-to-end smoke test

- [ ] 10.1 Manual E2E: log in as a realm admin, navigate to manage page, set `tagTree` with a header + three leaves, set `rule` to an existing Post, set `about` to another Post, set `banner` to a URL. Save each.
- [ ] 10.2 Manual E2E: log out, sign up as a new user, navigate to the realm. Verify rule/about/banner all render. Click "Join". Verify the rule modal opens with rule content. Click "Agree and Join". Verify membership.
- [ ] 10.3 Manual E2E: as the new member, click "Post in this realm". Verify composer opens in realm-post mode with body input focused and tag picker showing the three tagTree leaves. Type a body, pick two tags, submit. Verify the post appears in the realm feed.
- [ ] 10.4 Manual E2E: switch sort to Top, then to Hot. Verify the URL updates and the feed reorders. Pick a chip in the tag filter. Verify the feed reduces to matching posts.
- [ ] 10.5 Manual E2E: verify the post appears in Meilisearch search when filtered by the realm's id.
- [ ] 10.6 Run `bun run check:convention` and `bun run typecheck` across affected packages. Fix any failures.

## 11. Phase B — Backfill migration

- [ ] 11.1 Add a Prisma migration file `package/server/prisma/migrations/<timestamp>_realm_unit_backfill/migration.sql` containing `INSERT INTO "RealmUnit" ("realmUnitId", "unitId", "createdAt") SELECT "realmUnitId", "unitId", "createdAt" FROM "Post" WHERE "realmUnitId" IS NOT NULL ON CONFLICT DO NOTHING;`. Verify the SQL matches actual table/column casing.
- [ ] 11.2 Add a one-shot post resync script (`package/server/src/scripts/resync-posts.ts`) that walks every post and partial-updates its Meilisearch document with the now-populated `realmIds`. Idempotent.
- [ ] 11.3 Run Phase B migration in a staging environment first. Verify row counts: `SELECT COUNT(*) FROM "RealmUnit"` should grow by the count of `Post WHERE realmUnitId IS NOT NULL`. No errors.
- [ ] 11.4 Run the post resync script in staging. Spot-check 5 posts in Meilisearch to confirm `realmIds` is populated.
- [ ] 11.5 Promote Phase B to production after staging soak. Document the deploy in the change ledger or PR description.

## 12. Phase C — Switch reads, freeze legacy writes

- [ ] 12.1 In `package/server/src/post/post.service.ts` `createPost`, stop writing `Post.realmUnitId`. Continue accepting and writing `realmUnitIds` to `RealmUnit`.
- [ ] 12.2 Remove the `realmUnitId` (singular) field from `createPostSchema` in `package/contract/src/post/create.ts`. Search the repo for callers (`grep -r "realmUnitId:" --include="*.ts" --include="*.tsx"`) and migrate any stragglers to `realmUnitIds: [id]`.
- [ ] 12.3 Remove the Phase A `byTarget` realm-typed-target fallback in `package/server/src/post/post.service.ts`. `byTarget` is now strictly reply-thread query.
- [ ] 12.4 Remove the deprecation log line added in task 3.6.
- [ ] 12.5 Verify no production code paths reference `Post.realmUnitId` anymore: `grep -r "realmUnitId" package/server/src --include="*.ts"` should return only Prisma-generated types and the migration file. Frontend references should already be gone after composer changes.
- [ ] 12.6 Run `bun run typecheck` across all packages. Fix any compile errors from the contract change.

## 13. Phase D — Drop column

- [ ] 13.1 Update `package/server/prisma/schema.prisma`: remove the `realmUnitId String?` field from `Post`, remove the `realm Unit? @relation("PostRealm", ...)` line, remove the `realmPosts Post[] @relation("PostRealm")` line on `Unit`. Run `bun run prisma:generate`.
- [ ] 13.2 Run `bun run prisma:migrate` to generate the column-drop migration. Inspect the generated SQL: it SHALL drop `Post.realmUnitId` and the corresponding FK constraint. No data loss expected (Phase B already populated `RealmUnit`).
- [ ] 13.3 Run `bun run typecheck` and fix any code paths that referenced `Post.realmUnitId` via the Prisma client (there should be none after Phase C).
- [ ] 13.4 Run a final Meilisearch resync: walk every post document, remove the legacy `realmUnitId` field via partial update, ensure `realmIds` is the only realm-related field. Update `filterableAttributes` to remove `realmUnitId`.
- [ ] 13.5 Deploy Phase D to staging. Verify all realm-related queries still work (`byRealm`, search filtering, composer submission, manage-page reads).
- [ ] 13.6 Promote Phase D to production. This is the irreversible commit point — see `design.md` Migration Plan rollback note.

## 14. Final validation and archive readiness

- [ ] 14.1 Run `bun run check:convention` across the repo. All R-rules pass.
- [ ] 14.2 Run `bun run typecheck` per-package (per CLAUDE.md feedback: per-package, not monorepo-wide). Each package compiles.
- [ ] 14.3 Run `bun test` in `package/server`, `package/contract`, and `package/app`. All targeted tests pass.
- [ ] 14.4 Run `bun run knip` at root. Triage any new unused-export findings.
- [ ] 14.5 Manual regression sweep: realm landing page, realm detail page (all sections), realm manage page, post creation from realm, post creation outside any realm, reply flow on a non-realm post, search filtering by realm.
- [ ] 14.6 Update `openspec/specs/` from change deltas via `openspec apply` (or the equivalent merge command). Archive this change once the realm forum experience is end-to-end on production.
