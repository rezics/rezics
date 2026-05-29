## 1. Schema & Migration

- [ ] 1.1 Add `Post.state String?` to `package/server/prisma/schema.prisma`; document `extra.stateSchemaTag` in the model comment
- [ ] 1.2 Add an index supporting lifecycle filtering (e.g. on `(state)` or a realm/target-scoped composite consistent with existing post indexes)
- [ ] 1.3 Generate the Prisma migration (additive; all existing posts get `state = null`) and run `prisma:generate`

## 2. State Schema Registry

- [ ] 2.1 Define the schema type `{ initial, states[], transitions[] }` with rendering hints but no behavior flags
- [ ] 2.2 Add the code registry keyed by official tag slug, building on `OFFICIAL_QUESTION_TAG_SLUG`
- [ ] 2.3 Add the `question` schema (`open`/`answered`/`closed`, initial `open`)
- [ ] 2.4 Add the `issue` schema (`open`/`closed`, initial `open`) and the close-reason vocabulary (`COMPLETED`/`NOT_PLANNED`/`DUPLICATE`); add the official issue tag slug constant

## 3. Backend Service

- [ ] 3.1 On post create: detect a stateful tag, snapshot `extra.stateSchemaTag`, initialize `state` to the schema's initial state
- [ ] 3.2 Enforce at most one stateful tag (reject applying a second); ensure `stateSchemaTag` does not drift on later tag add/remove
- [ ] 3.3 Implement a state-transition write that validates target state and transition against the schema
- [ ] 3.4 Maintain the `answered` cache: accept → `open`⇒`answered`; unaccept last → `answered`⇒`open`; never overwrite manual `closed` (pin remains source of truth)
- [ ] 3.5 Audit reply-permission and feed-visibility paths to confirm they read only `isLocked` / `Unit.status`, never `state`

## 4. Contract & API

- [ ] 4.1 Add `state` to `PostDTO`; document `extra.stateSchemaTag`; expose the schema shape (states, transitions, rendering hints) for client rendering
- [ ] 4.2 Add `@rezics/api` read of post state + schema and a state-transition mutation with thread/post query invalidation

## 5. Tests

- [ ] 5.1 Create with question tag → `state = open`, `stateSchemaTag` set
- [ ] 5.2 Second stateful tag rejected; snapshot does not drift on tag changes
- [ ] 5.3 Illegal state value and disallowed transition rejected
- [ ] 5.4 Accept → answered; unaccept → open; manual `closed` not overwritten by accept/unaccept
- [ ] 5.5 Closed post with `isLocked = false` still accepts replies; locking is independent of `state`
- [ ] 5.6 Unanswered-questions list filters on `state` (no anti-join)

## 6. Quality

- [ ] 6.1 `bun run format` and `bun run check:convention`
- [ ] 6.2 `bun test` for the post domain
