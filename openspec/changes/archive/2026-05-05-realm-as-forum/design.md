## Context

The realm system has accumulated a comprehensive spec set over many smaller changes (`realm-frontend`, `realm-tag-unit`, `realm-tag-vote`, `realm-extra-pinboard-keys`, `realm-search-index`, `default-realm-*`, `score-realm-field`, etc.) and a broad backend implementation: Prisma models for `Realm`, `RealmMember`, `RealmUnit`, `RealmTagUnit`, `RealmTagVote`, `ScoreEntry`, `ScoreAggregate`, plus realm CRUD/membership APIs, default-realm bootstrap, Meilisearch realm index. Frontend has the realm landing page, search, detail page with three tabs, manage page, create form, `RealmCard`, `JoinButton`, `RealmContentFeed`, `RealmTagManager`, `RealmTagHighlights`, and pinboard/announcement admin UI.

Despite this surface area, realms cannot function as standalone forums today. Three concrete blockers:

1. **Post→Realm linkage is asymmetric and orphaned.** Posts associate with tags through the clean `UnitTag` junction (many-to-many) but with realms through a direct `Post.realmUnitId` foreign key (single-realm). The `RealmUnit` junction exists in schema but is populated only by an admin-only "add unit to realm" endpoint, never by post creation. Worse, `RealmContentFeed` queries via `Post.targetUnitId` (which means "this post replies to that unit") instead of using realm linkage at all — so the feed conflates realm content with replies-to-realm.

2. **No "post to realm" UI.** `ReplyComposer` accepts only `targetUnitId` and `parentPostUnitId`. There is no top-level realm post entry point, no tag picker, no way to write a post that lives in a realm without first replying to something.

3. **Curation slots are anemic.** `Realm.extra` defines `pinboard` and `announcement` (both unitId arrays) but lacks `rule`, `about`, `banner`, and `tagTree` — so realms have no rules surface, no sidebar/about content, no banner, and no curated tag picker. Reddit-style "subreddit feel" is impossible.

The discussion that produced this change converged on four design assertions: (a) Realm and Tag are structurally identical at the schema layer — both are Units, both index Posts via junction tables, the asymmetry is a bug; (b) all curation content (`pin`, `rule`, `announcement`, `about`, `banner`, future `wiki`) is just Posts referenced by id in `Realm.extra`, transparently inheriting Unit's `work-release` self-relation for multi-language; (c) join-time consent removes the need for any acknowledgment table — pressing "join" after seeing the rule modal is the consent event; (d) `extra.tagTree` is a UX hint for the post composer, not a tagging constraint.

## Goals / Non-Goals

**Goals:**

- Make realms work as standalone forums: independent posting, curated tag picker, rule/about/banner/sort/filter surface.
- Correct the schema asymmetry: post-realm membership lives in the `RealmUnit` junction, never on `Post`.
- Add cross-posting capability for free, as a side effect of (1).
- Reuse the `pinboard` curation pattern (extra → unitId list → fetch via `unitDetailQuery` → render with translation) for `rule`/`about`/`banner` so multi-language is solved without new tables or pipelines.
- Solve rule consent with zero new schema and zero new backend endpoints — a frontend-only modal gated on `realm.extra.rule`.
- Keep change scope to a single coherent track: forum capability. Each task in `tasks.md` is independently shippable; the change archives when the forum experience is end-to-end.

**Non-Goals:**

- Mod queue / report system / approval workflow — independent capability with its own data model and UI surface.
- Full wiki experience — the data shape is trivial (`extra.wiki: unitId[]`), but the navigation/editing UX needs separate design.
- Custom CSS/theme upload — file upload + safety review is a much larger scope.
- Scheduled posts / publishing calendar.
- Collapsing or reworking existing realm specs (`realm-tag-unit`, `realm-tag-vote`, `realm-score`, etc.) — they remain authoritative.
- Refactoring `Post.targetUnitId`/`Post.parentPostUnitId` semantics beyond clarification (these stay as reply pointers).
- Composer rich-text/markdown enhancements — this change reuses whatever the composer already supports.

## Decisions

### Decision 1: Drop `Post.realmUnitId`; `RealmUnit` is the single source of truth

**Choice:** Remove the `Post.realmUnitId` column, the `Post.realm` Prisma relation, and the `Unit.realmPosts` relation (`@relation("PostRealm")`). Migrate all rows where `Post.realmUnitId IS NOT NULL` to a corresponding `RealmUnit(realmUnitId, unitId)` row. After migration, all post-realm membership reads/writes go through `RealmUnit`, exactly mirroring how `UnitTag` indexes post-tag membership.

**Why over alternatives:**
- *Keep both* (leave the FK, also write `RealmUnit`): doubles the source of truth, requires consistency invariants, and re-introduces the asymmetry every time a future contributor wonders "should I write the FK or the junction?".
- *Drop `RealmUnit`, keep the FK*: forecloses cross-posting (one post cannot live in multiple realms with a single FK column) and breaks the symmetry with `UnitTag`.
- *Drop the FK, keep `RealmUnit`* (chosen): symmetric with tags, cross-posting natural, no consistency invariants.

**Trade-offs:**
- Migration is destructive and must run with no in-flight writes to `Post.realmUnitId`.
- Existing API callers passing `realmUnitId` (singular) break — internal callers updated atomically; external callers (none known) need contract migration.
- Query cost: `byRealm(realmId)` does a junction join instead of a single column scan. With `RealmUnit (realmUnitId, unitId)` PK and indexes on both columns, the cost is negligible relative to the rest of the query plan.

### Decision 2: All curation content is Post-referenced via `Realm.extra`

**Choice:** Extend `realmExtraSchema` with `rule: unitId` (single), `about: unitId` (single), `banner: unitId | { url }`, and `tagTree: Node[]`. Existing `pinboard: unitId[]` and `announcement: unitId[]` remain unchanged. All unitId references are to `Post` Units. The frontend pinboard pattern (`package/app/src/pinboard/hooks/usePinboard.ts`) is the canonical pipeline for resolving these references — fetch via `unitDetailQuery`, resolve translation via `getTranslation(unit.translations, language, defaultLanguage)`, render. For full body rendering, a Post that has releases (other Posts pointing to it as `workUnitId`) lets the frontend pick the release matching `user.language` and fall back to the work itself.

**Why over alternatives:**
- *Dedicated tables* (`RealmRule`, `RealmAbout`, `RealmBanner`): each duplicates the Post lifecycle (multi-language, edit history, translations). Triples the schema for zero capability gain.
- *String body in `extra`* (`extra.rule: { content: string, language: string }`): single-language, no edit history, can't be cross-linked, can't be pinned to a realm post if both are needed. Loses everything Unit/Post already provides.
- *Post reference in `extra`* (chosen): zero new tables, automatic multi-language via Unit's existing work-release self-relation, edit history is just Post edit history, translation is just `UnitTranslation`.

**Implication:** Writing a rule means writing a Post (in any realm — typically the realm in question, but not required) and dropping its id into `extra.rule`. The Post can have releases in other languages by writing more Posts with `workUnitId = ruleSourcePost.unitId`. The pinboard rendering pipeline handles all of this transparently.

### Decision 3: Rule consent is gated at join time, no acknowledgment table

**Choice:** When a user clicks "Join" on a realm with `realm.extra.rule` set, the frontend fetches the referenced Post via `unitDetailQuery`, opens a modal showing the rule content (with multi-language rendering as in Decision 2), and renders an "agree and join" button that calls the existing join endpoint. If `extra.rule` is unset, joining stays one-click. No backend changes. No `RuleAcknowledgement` table.

**Why over alternatives:**
- *Per-user-per-version ack table* (track which release of which rule each user has acknowledged): solves "user joined before rule v2 was published — make them re-acknowledge". But: requires a new table, migration logic when a Post release is added, modal interruptions on existing users which is hostile UX. Not worth it.
- *Mandatory rule reading on every visit*: hostile UX, not a real consent model.
- *Join is consent* (chosen): clean. If rules change materially, owners use the existing `pinboard` + notify mechanism to surface the update. Membership remaining is implicit ongoing consent.

**Trade-offs:**
- Cannot prove a specific user agreed to a specific rule version. For a forum, this is acceptable (Reddit doesn't either). For regulated contexts (legal compliance), would need re-design. Out of scope.

### Decision 4: `tagTree` is UX hint, not constraint

**Choice:** `tagTree: Node[]` where `Node = { tagId?: string, label?: string, disabled?: boolean, children?: Node[] }`. The composer's tag picker uses this tree to render quick-pick chips/sections, but the picker also supports free search across the global tag pool. `disabled: true` nodes render as section headers (non-selectable). `tagId` and `children` are not mutually exclusive — a node can be both selectable and a parent. Realms cannot create tags; they only reference existing global tag ids.

**Why over alternatives:**
- *Constraint mode* (only tags in tagTree are valid in this realm): rigid, contradicts global tag system, requires server-side validation.
- *Flat list only*: works but limits curation expressiveness.
- *Tree with disabled flag* (chosen): supports both flat ("just give me 5 quick-pick tags") and grouped ("Genre / Demographic / Studio") realm curation styles in one schema.

### Decision 5: `byRealm` query path replaces `byTarget` for realm content

**Choice:** Add `postQueries.byRealm(realmId, opts)` and the corresponding `GET /post/list?realmUnitId=...` server route to filter via `RealmUnit` junction. `RealmContentFeed` switches to this query. `byTarget(unitId)` retains its true semantic: "posts that reply to or directly target this unit" (book discussion threads, etc.). `Post.targetUnitId` no longer carries realm-content meaning.

**Why this matters:**
- The current dual use of `targetUnitId` was a load-bearing accident. Untangling it makes both queries explicit about their purpose.
- `byTarget` continues to work for reply-thread queries (book discussion, post-reply trees).

**Sort modes:** `byRealm` supports `sort: "new" | "top" | "hot"`. `new` orders by `createdAt DESC`. `top` orders by post score DESC (score sourced from `ScoreEntry` linked to the post if present, else 0). `hot` is `score / (age_in_hours + 2)^1.5` — Reddit's classic decay formula, computable in SQL via a generated expression or computed in the index layer. For phase 1, `hot` MAY be implemented as `top` filtered to last 7 days; full decay can be a follow-up.

**Tag filter:** `byRealm(realmId, { tagIds: [t1, t2] })` joins through `RealmTagUnit` (preferred — realm-scoped tagging) with fallback to `UnitTag` if no `RealmTagUnit` rows exist for the unit. Multiple tags use OR semantics (union) by default.

### Decision 6: Composer reuses `ReplyComposer` with new props

**Choice:** Extend `ReplyComposer` to accept optional `realmUnitIds: string[]` and `tagIds: string[]` props. When `realmUnitIds` is non-empty, the composer is in "top-level realm post" mode — it does not require `targetUnitId`/`parentPostUnitId`, it surfaces a tag picker hydrated from `realm.extra.tagTree` of the first realm in `realmUnitIds`, and submission writes Post + RealmUnit rows + UnitTag rows in one transaction.

**Why over alternatives:**
- *New `TopLevelPostComposer` component*: code duplication, two composer code paths to maintain.
- *Extend existing* (chosen): single composer, mode-driven by props. Matches existing `mode: "progressive" | "expanded"` pattern.

**Trade-off:** `ReplyComposer` becomes overloaded ("reply or top-level realm post"). Mitigated by clear prop semantics: presence of `realmUnitIds` selects realm-post mode; presence of `targetUnitId`/`parentPostUnitId` selects reply mode; the modes are mutually exclusive and validated at the prop level.

### Decision 7: Search index post documents gain `realmIds: string[]` facet

**Choice:** Add a `realmIds: string[]` field to the post Meilisearch document, sourced from `RealmUnit` rows for that post at sync time. Add `realmIds` to the index's `filterableAttributes`. Sync triggers fire on `RealmUnit` insert/delete (in addition to existing post create/update/delete triggers) — when a post is added to or removed from a realm, its document re-syncs with the updated `realmIds` array. Replaces the existing single-valued `realmUnitId` facet on the post document, which is no longer accurate after Decision 1.

**Trade-off:** Sync fan-out on `RealmUnit` write — but `RealmUnit` writes are infrequent compared to post writes, and the sync is fire-and-forget.

## Risks / Trade-offs

**[Migration ordering risk]** Dropping `Post.realmUnitId` while in-flight requests still write to it produces silent data loss. → Mitigation: phased deploy. Phase A — dual-write (server writes both `Post.realmUnitId` and `RealmUnit`, reads from `RealmUnit`). Phase B — backfill historical rows. Phase C — remove dual-write, drop column. Phase D — cleanup. Each phase ships as a separate PR within the change.

**[Composer prop overload]** `ReplyComposer` taking on realm-post mode complicates the component contract. → Mitigation: type-level prop discrimination (TypeScript discriminated union); runtime assertion that reply-mode props and realm-post-mode props are not mixed; clear component-level JSDoc.

**[`hot` sort initial implementation is approximate]** Full Reddit-style decay needs either a computed column or in-process sort. The phase-1 "top within last 7 days" approximation may surface mediocre-but-recent content over genuinely hot content. → Mitigation: ship phase 1, capture user feedback, replace with proper decay if needed. Document the approximation in the spec scenario.

**[`tagTree` editing UX is non-trivial]** Drag-reorder + add/remove + disabled toggle for an arbitrary-depth tree is real frontend work. → Mitigation: ship a minimal editor first (flat list with optional one level of nesting), expand later. The schema supports arbitrary depth so the data model is forward-compatible.

**[Rule modal blocks the join button]** Users who skim past rule content lose time. → Mitigation: rule content should be terse by realm-owner convention (no enforcement); rendering is read-only and includes a clear "agree and join" CTA. No retry friction — if user closes modal without agreeing, "Join" remains available for another try.

**[`extra.banner` shape ambiguity]** `unitId | { url }` is a union, requiring discriminated handling in renderer and editor. → Mitigation: contract-level discriminant (`{ kind: "post"; unitId: string } | { kind: "url"; url: string }`); render layer branches on `kind`.

**[Search facet cardinality]** A post in many realms produces a long `realmIds` array. With cross-posting unconstrained, a popular cross-post could have 50+ entries. → Mitigation: Meilisearch handles array facets up to thousands of values per document without performance hit. No cap needed at this scale.

## Migration Plan

The migration ships in four phases, each as a separate PR within this change:

**Phase A — Dual-write and dual-read fallback (non-breaking).**
1. Add server logic: when `createPost` receives `realmUnitId` (legacy) or `realmUnitIds[]` (new), write the corresponding `RealmUnit` rows.
2. Add server logic: `byRealm(realmId)` query reads from `RealmUnit`. `byTarget(realmId)` falls back to `RealmUnit` for any realm-typed target unit, logging a deprecation warning.
3. Add server logic: when an admin uses the existing "add unit to realm" endpoint, no behaviour change.
4. Keep `Post.realmUnitId` column populated for any new post that specifies it.
5. Frontend: `RealmContentFeed` switches to `byRealm`. Composer changes are gated behind a feature flag for testing.

**Phase B — Backfill.**
1. One-shot migration script: `INSERT INTO RealmUnit (realmUnitId, unitId, createdAt) SELECT realmUnitId, unitId, createdAt FROM Post WHERE realmUnitId IS NOT NULL ON CONFLICT DO NOTHING;`
2. Re-trigger Meilisearch full reindex for posts so `realmIds` facet populates from the now-complete junction.

**Phase C — Switch reads, freeze writes to FK.**
1. Server: stop writing `Post.realmUnitId` on new posts. Update `createPost` contract: `realmUnitId` field accepted but ignored; `realmUnitIds[]` is canonical.
2. Server: remove the `byTarget` fallback for realm units. `byTarget` is now strictly reply-thread query.
3. Frontend: enable composer flag for general use.

**Phase D — Drop column.**
1. Prisma schema migration: drop `Post.realmUnitId`, drop `@relation("PostRealm")`.
2. Update all server code paths that referenced `Post.realmUnitId` to use `RealmUnit`.
3. Final Meilisearch resync to remove any lingering `realmUnitId` field on documents.

**Rollback:**
- Phases A–C are reversible. Phase D is irreversible after the column drop migration runs in production.
- If a rollback is needed after Phase D, the recovery path is: re-add the column, run a backfill from `RealmUnit` selecting one realm per post (most-recent or first), and accept that any post in multiple realms loses all but one association. This is intentional pressure to validate Phase D before shipping.

## Open Questions

- **`extra.banner` discriminated shape:** the proposal lists `unitId | { url }` — should we adopt `{ kind: "post"; unitId } | { kind: "url"; url }` from day one to avoid runtime ambiguity? Recommendation: yes, ship the discriminated form. This decision is captured in tasks but not yet validated against any concrete renderer needs.
- **`hot` sort fidelity:** phase-1 approximation acceptable, or block on full decay formula? Recommendation: ship approximation, iterate. Captured as a follow-up task.
- **Whether `tagTree` editor needs nested drag-and-drop in v1:** flat-list-with-one-level-nesting MVP is enough to deliver the curation feel. Full tree editing can be a follow-up. Captured as task scope notes.
- **Whether to also expose `extra.wiki: unitId[]` in this change** even without the wiki experience (since the data shape is free): inclined to defer — adding a key without rendering it is dead schema. Will leave for a future wiki change.
