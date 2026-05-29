## 1. Schema & Migration

- [x] 1.1 Add `Post.state String?` to `package/server/prisma/schema.prisma`; document in the model comment that it is a kebab-case slug and that `extra.stateSchemaTag` snapshots the governing tag slug
- [x] 1.2 Add an index supporting bucket filtering (e.g. on `(state)` or a realm/target-scoped composite consistent with existing post indexes)
- [x] 1.3 Generate the Prisma migration (additive; all existing posts get `state = null`) and run `prisma:generate`

## 2. State Schema Registry

- [x] 2.1 Define the schema type `{ initial, values: { slug, bucket: 'active' | 'closed', tagSlug? }[], transitions[] }` — no behavior flags; `tagSlug` defaults to the value slug
- [x] 2.2 Add the code registry keyed by official tag slug, building on `OFFICIAL_QUESTION_TAG_SLUG`; add the official issue tag slug constant alongside `SEED_TAG_SLUGS`
- [x] 2.3 Add the `question` schema: `open`(active) · `solved`(closed) · `not-planned`(closed) · `duplicate`(closed) · `off-topic`(closed), initial `open`, with reopen transitions
- [x] 2.4 Add the `issue` schema: `open`(active) · `completed`(closed) · `not-planned`(closed) · `duplicate`(closed), initial `open`, with reopen transitions
- [x] 2.5 Add helpers: bucket slug sets (`activeSlugs`/`closedSlugs`) for filter queries, and slug normalization (lowercase + `_`→`-`) at the write boundary

## 3. Backend Service

- [x] 3.1 On post create: detect a stateful tag, snapshot `extra.stateSchemaTag`, initialize `state` to the schema's initial state
- [x] 3.2 Enforce at most one stateful tag (reject applying a second); ensure `stateSchemaTag` does not drift on later tag add/remove
- [x] 3.3 Implement a state-transition write that validates target value and transition against the schema (write-strict); normalize and reject illegal values/transitions
- [x] 3.4 Maintain the `solved` cache: accept → `open`⇒`solved`; unaccept last → `solved`⇒`open`; never overwrite a manual closed reason (pin remains source of truth)
- [x] 3.5 Audit reply-permission and feed-visibility paths to confirm they read only `isLocked` / `Unit.status`, never `state`
- [x] 3.6 Provide bucket filtering for listings (`active`/`closed` via the slug sets), with no anti-join

## 4. Contract & API

- [x] 4.1 Add `state` to `PostDTO` typed as a generic string (read-lenient — no enum rejection on read); document `extra.stateSchemaTag`; expose the schema shape (values, buckets, transitions, per-value tag slug) for client rendering
- [x] 4.2 Add `@rezics/api` read of post state + schema, a state-transition mutation (gated by schema transitions) with thread/post query invalidation, and bucket filter params

## 5. Tests

- [x] 5.1 Create with question tag → `state = open`, `stateSchemaTag` set
- [x] 5.2 Second stateful tag rejected; snapshot does not drift on tag changes
- [x] 5.3 Illegal value and disallowed transition rejected on write; unknown value tolerated on read
- [x] 5.4 Accept → `solved`; unaccept → `open`; manual closed reason not overwritten by accept/unaccept
- [x] 5.5 Closed-bucket post with `isLocked = false` still accepts replies; locking is independent of `state`
- [x] 5.6 Unsolved-questions list filters on `state` active bucket (no anti-join); `closed` bucket filter matches all closed reason values
- [x] 5.7 Closing requires a reason (no bare `closed`); reopen returns to `open`
- [x] 5.8 Value renders via mapped tag; missing tag falls back to the raw slug

## 6. Quality

- [x] 6.1 `bun run format` and `bun run check:convention`
- [x] 6.2 `bun test` for the post domain
</content>
