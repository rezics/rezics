## Context

The editorial regime is the cluster of mechanisms that govern collaborative Unit edits: `UnitFieldLock` (which fields are protected), `UnitRevision.changedFieldKeys` (what changed), the authority service (does this actor's PATCH intersect any lock?), and the history outbox (durable record of edits). All four currently share a single vocabulary — `UnitFieldKey` — a hand-curated string enum that grew organically as new fields and roles were added.

The enum has three structural problems:

1. **Mixed granularity semantics**. Some keys are JSON paths (`identity.title`, `bibliographic.isbn13`), some are predicate filters over a collection (`credits.authors` means rows where role=author), and some are ad-hoc namespaces (`identity.*` straddles per-translation fields and Unit-level fields). The intersection check has no single mental model.
2. **Enumeration debt**. Every new field, attribution role, or content sub-tree requires adding a `UnitFieldKey` constant before lock or history can describe it. The `introduce-content-doc-schema` change tried to mitigate this by "reserving" `post.content.slots.<slotId>` keys, which is enumeration debt wearing a different hat.
3. **Snapshot bloat**. To keep editorial revisions content-addressable, `loadEditorialSlots` re-loads the full state of translations, extension, credits, subjects, and tags on every edit and packs them into the revision payload. A single title edit re-snapshots the whole bundle; dedup only succeeds when the entire bundle is byte-identical.

Independently, the `tags` slot in the current snapshot is governed by a vote system (`TagVote` for global tags, `RealmTagApplicationVote` for realm-scoped tag applications post-rename), not by editorial actors. Including it in editorial history snapshots is misleading: the vote ledger is the audit trail for tag changes; the editorial regime cannot meaningfully lock tags because tag PATCHes go through dedicated endpoints, not the editorial endpoint.

This change resolves all three problems with a single move: make the PATCH input itself the unit of editorial state. Lock paths, history payloads, and changed-key derivation become structural operations over PATCH sub-trees. The `UnitFieldKey` enum is removed. Externally-governed paths are declared out-of-band so the editorial regime stops pretending it can govern them.

## Goals / Non-Goals

**Goals:**

- Define a PATCH submission protocol for editorial Unit updates with unambiguous merge, null, deletion, and collection semantics.
- Replace `UnitFieldKey` enum with free-form JSON path strings stored in `UnitFieldLock.path`.
- Make lock comparison a bidirectional prefix match between PATCH paths and lock paths.
- Persist editorial revisions as the submitted PATCH sub-tree; derive changed paths from the stored patch.
- Remove `loadEditorialSlots` and the slot vocabulary from the editorial path.
- Declare `EXTERNALLY_GOVERNED_PATHS` exempting `tags` and `realmTagApplications` from editorial PATCH, lock, and history.
- Unblock `introduce-content-doc-schema` by making `post.content.main` a normal PATCH path with no reserved-key special-casing.

**Non-Goals:**

- Real-time collaborative editing, operational transform, or CRDT-style merge resolution.
- Permission model changes beyond replacing the lock vocabulary. Primary owner, collaborator roles, admin override, and the "non-collaborative surfaces skip lock lookup" rule remain as-is.
- Cross-Unit PATCH (a single PATCH targeting multiple Units). Editorial PATCH remains per-Unit.
- API path canonicalization enforced by the contract. The contract describes the lock/history semantics over whatever paths the API uses; consistency across endpoints is an API-design discipline, not a contract-checked invariant.
- A general-purpose JSON merge engine for non-editorial surfaces. The editorial PATCH protocol is scoped to the editorial regime.
- Migration of existing editorial-history revisions to PATCH-shape. Pre-cutover revisions retain their stored `slots`-shape payload; the history reader handles both shapes.

## Decisions

### Decision: Replace `UnitFieldKey` enum with free-form JSON path strings

`UnitFieldKey` and its sub-enums (`UnitCommonFieldKey`, `BookFieldKey`, `EntityFieldKey`, `GameFieldKey`, `MediaFieldKey`, `AttributionFieldKey`, `WikiPostFieldKey`) are removed from `@rezics/contract`. `UnitFieldLock.fieldKey` is renamed to `UnitFieldLock.path` and stores a free-form JSON path string. The `*` sentinel is retained as `UNIT_FIELD_LOCK_ALL` and means "the whole Unit within the editorial regime."

Rationale:

- The enum mixed three different granularity semantics (paths, predicates, namespaces) under one type. None of the consumers (lock, history, authority) need a closed vocabulary — they only need to compare path strings.
- New fields no longer require a contract update before they become lockable or historical. The PATCH path is the lock path.
- `ContentDoc.slots` stops being a naming hazard: the editorial regime never uses the word "slot" again.

Alternatives considered:

- **Enum-with-extension** (keep enum, allow free-form extension strings). Rejected because it preserves the worst part of the current model — having to remember "is this field in the enum?" — without delivering the simplification.
- **Structured lock target** (`{ objectKey: "...", scope?: {...} }`). Rejected as a half-step that still requires enumerating top-level container keys and adds a second representation alongside path strings without simplifying any consumer.

### Decision: Editorial PATCH uses sparse merge

PATCH input is interpreted as a sparse JSON sub-tree. Each path present in the sub-tree is set on the Unit; paths absent from the sub-tree are left untouched. Object values are recursively merged into the current state. Array values replace the array whole.

Concretely:

```json
PATCH { "translations": { "en": { "description": "..." } } }
```

means "set `translations.en.description`; leave `translations.en.title`, `translations.de.*`, `credits.*`, etc. untouched."

```json
PATCH { "credits": { "authors": [{ "targetUnitId": "u-1" }] } }
```

means "set `credits.authors` to the array `[{targetUnitId:"u-1"}]`; leave `credits.translators`, `credits.publishers`, etc. untouched."

Rationale:

- Matches the user's stated requirement that updates "submit the update content, not full overwrite."
- Avoids forcing clients to re-send large unchanged sub-trees (especially `ContentDoc`).
- The "trust problem" — server claims to change less than it did — is structurally impossible because what is submitted IS what is recorded.

Alternatives considered:

- **Full overwrite PATCH** (RFC 7396 reversed). Rejected: defeats the whole point of moving away from full snapshots.
- **JSON Patch RFC 6902** (`{ op: "replace", path: "/translations/en/description", value: "..." }`). Rejected for editorial use as overly verbose for the common case. The sparse sub-tree representation is more natural and round-trips with PATCH bodies that already look this way.

### Decision: `null` writes SQL NULL; deletion requires explicit directive

A PATCH leaf value of `null` writes SQL `NULL` to the corresponding column. Removing a key from the stored object requires an explicit deletion directive (initial form: `{ $unset: ["credits.authors"] }` at the PATCH root). The protocol SHALL NOT use the RFC 7396 convention that `null` deletes a key.

Rationale:

- Postgres `NULL` is a first-class value in the schema. Conflating it with "delete this key" would prevent PATCH from ever explicitly writing NULL — a common operation (e.g., clearing a description back to NULL).
- Explicit deletion is rare in editorial flows; making it loud avoids accidental data loss.

### Decision: Collections replace whole; no array-index PATCH

Array-valued PATCH leaves replace the entire array. The protocol SHALL NOT support index-based patching (`credits.authors[2]`), index-based locks, or index-based history references.

If a future feature needs per-entry editing of a collection, the editing surface SHALL re-shape the collection into an object keyed by a logical id (e.g., `credits.authors.byTargetUnitId.<targetUnitId>`) rather than introduce array-index semantics into the protocol.

Rationale:

- Array indices shift as items move; index-based locks would silently fail to protect the intended entry.
- Object-keyed sub-trees give every entry a stable address and play naturally with sparse merge.
- Collections are typically small in practice (a handful of authors, a handful of credits), so whole-array replacement is not a real bandwidth concern.

### Decision: Lock comparison is bidirectional prefix match

A PATCH path `P` is blocked by a lock path `L` if and only if `P` and `L` are mutual prefixes — that is, `P == L`, `P` is a strict prefix of `L`, or `L` is a strict prefix of `P`. The whole-Unit sentinel `*` matches every editorial path.

Concretely:

- Lock `credits.authors`, PATCH `credits.authors[*]` content → blocked (equality).
- Lock `credits.authors`, PATCH `credits` (replaces the whole credits sub-tree) → blocked (lock is inside patch).
- Lock `credits`, PATCH `credits.translators` → blocked (patch is inside lock).
- Lock `credits.authors`, PATCH `credits.translators` → not blocked (disjoint paths).
- Lock `*`, PATCH `translations.en.title` → blocked (whole-Unit sentinel).

Implementation may use a sorted prefix-trie of lock paths for O(depth) lookup per PATCH leaf.

Rationale:

- The bidirectional rule captures both "lock is inside the patched area" and "patch is inside the locked area." Either direction means the patch necessarily touches locked state.
- The rule is a pure structural property; it has no domain knowledge.
- Rejection is per-PATCH (the whole PATCH is rejected, not partially applied) so that atomicity matches the request's atomicity.

### Decision: `EXTERNALLY_GOVERNED_PATHS` exempts vote- and owner-governed surfaces

`@rezics/contract` exports a closed list of path prefixes that are governed by external systems:

```ts
export const EXTERNALLY_GOVERNED_PATHS = [
  "tags",                    // governed by TagVote
  "realmTagApplications",    // governed by RealmTagApplicationVote (post-rename)
] as const;
```

The editorial regime SHALL:

- Reject editorial PATCH requests whose paths intersect `EXTERNALLY_GOVERNED_PATHS` with an error that points to the dedicated governance API.
- NOT write history outbox rows for these paths (they have their own audit ledger).
- NOT honor `UnitFieldLock` rows whose `path` intersects `EXTERNALLY_GOVERNED_PATHS`. Even `*` does not extend into externally-governed paths.

Externally-governed paths are still allowed on the Unit's JSON projection for read purposes; they simply do not participate in the editorial protocol.

Rationale:

- Tags are vote-applied and have their own audit trail; mirroring them into editorial revisions creates two competing histories.
- An editorial lock on `tags` would never trigger because tag PATCHes go through dedicated endpoints, misleading the operator who set it.
- `*` lock means "freeze the editorial surface," not "freeze every byte on the Unit." External governance retains its own gating.

Alternatives considered:

- **Hard-coded `tags` skip only**. Rejected as too narrow; the realm tag system needs the same treatment, and future external-governance surfaces will too.
- **Runtime configuration table**. Rejected as over-engineering; the set changes rarely and is best in source where review is automatic.

### Decision: `changedFieldKeys` becomes a derived projection

`UnitRevision.changedFieldKeys` is no longer a stored column. The history service derives it on read by walking the stored PATCH sub-tree and emitting one entry per leaf path. The derivation is deterministic and cheap (single tree walk per revision).

Read DTOs continue to expose `changedFieldKeys` (now an array of free-form path strings instead of enum values) for timeline display and indexed lookups. The derived list is computed lazily and may be cached in the response, but is not persisted.

Rationale:

- The patch IS the change set; storing a derived projection alongside it is redundant and risks drift.
- Free-form path strings are sufficient for UI display. Translation to human-readable labels is a UI-layer concern.

### Decision: Revision content hash is the patch hash

`UnitRevision.contentHash` is computed from the canonical serialization of the stored PATCH sub-tree. Two revisions with identical PATCH payloads share a `RevisionContent` row, regardless of actor, sequence, or message.

The canonical serializer is the same one used today (`canonicalSerialize` in `package/server/src/unit/history-outbox.ts`): sorted keys, Date → ISO string, bigint → string, no undefined.

Rationale:

- Preserves the dedup property of the current model at the patch level.
- "Restore previous revision" naturally re-applies the same patch and produces the same hash.
- No new hashing primitive needed.

### Decision: Remove `loadEditorialSlots` and slot vocabulary

`package/server/src/unit/collaborative-metadata.ts::loadEditorialSlots` is removed. Editorial history writers no longer re-load full Unit state before writing the outbox row. The outbox payload carries the PATCH sub-tree directly under a new `patch` field.

`revisionSlotName`, `revisionSlotNameSchema`, and `EditorialRevisionPayload.slots` are removed from `@rezics/contract`. `EditorialRevisionPayload.patch: Record<string, unknown>` takes their place.

Rationale:

- The full re-snapshot existed to make content addressing work; with patch-level addressing, it is unnecessary.
- The slot vocabulary was already on the chopping block because of `ContentDoc.slots` overload; this completes the removal.

### Decision: Pre-cutover revisions retain their stored shape

The history service does not migrate pre-cutover revisions in place. `RevisionContent` rows written before this change retain their `slots`-shape payload; rows written after carry `patch`-shape payloads. The history reader detects shape from the payload structure and renders both.

`changedFieldKeys` for pre-cutover revisions is read from the stored column (which is preserved on those rows even after the column is dropped from the schema; the data migration leaves the values in place via a one-shot copy into the payload). For post-cutover revisions, it is derived from the patch.

Rationale:

- In-place rewrite of history payloads would defeat their evidentiary purpose.
- The shape detection is a small switch in the reader; the cost of running two readers indefinitely is negligible.

Alternatives considered:

- **Forward migration** that re-derives `patch` from `slots` by comparing each revision against the previous. Rejected because cross-revision derivation is fragile (gaps in the sequence, schema evolution between revisions) and the benefit is purely cosmetic.

### Decision: API path consistency is a design discipline, not a contract invariant

The contract does not enforce that "the english title is always patched at `translations.en.title`." Two endpoints submitting different paths for the same logical field would create lock fragmentation (a lock on `translations.en.title` would not block a patch on `i18n.en.title`).

This is treated as an API-design discipline: every editable field has one canonical PATCH path defined by `@rezics/contract` input schemas. Reviewers SHALL check new editorial endpoints against this discipline. The convention is not contract-enforced because:

- The contract cannot generally tell whether two paths refer to the same logical field.
- Enforcement would require a registry of valid paths, reintroducing the enumeration debt this change removes.

This is recorded as an explicit risk in the next section.

## Risks / Trade-offs

- **[Risk] Path inconsistency across endpoints.** Two PATCH endpoints submitting `{ author: "..." }` and `{ credits: { authors: [...] } }` for the same logical field would split lock targets. Mitigation: editorial PATCH input schemas live in `@rezics/contract` and reviewers enforce canonical paths; lint or test can be added if drift appears.
- **[Risk] Free-form lock paths bypass enum validation.** A misspelled lock path (`crdits.authors`) would silently never trigger. Mitigation: lock creation UI offers a path picker derived from canonical PATCH input schemas rather than a free-text field; CLI tooling can validate against known canonical paths emitted by `@rezics/contract`.
- **[Risk] Bidirectional prefix matching can reject patches operators do not realize they are issuing.** PATCH `credits` to "merge in one new author" would be blocked by lock `credits.authors` even if the intent was only to add a translator. Mitigation: editorial UI submits the narrowest PATCH possible (one sub-tree per field); error messages name the offending lock path so the editor can narrow their PATCH.
- **[Risk] `loadEditorialSlots` removal changes the dedup surface.** Previously, two revisions that happened to produce identical full-state snapshots deduped; now only revisions with identical PATCH payloads dedup. In practice this is fine (different patches mean different intents), but it changes the dedup rate. Mitigation: accepted; the previous rate was an artifact of full snapshotting, not a design goal.
- **[Risk] Pre-cutover history reader must handle two payload shapes indefinitely.** Mitigation: the shape switch is one branch on `"patch" in payload`; the cost is negligible. Future cleanup can rewrite legacy payloads once the cost of dual-format support exceeds the cost of rewriting.
- **[Risk] `EXTERNALLY_GOVERNED_PATHS` masks legitimate editorial PATCH if a path collides.** A future field actually editable through editorial PATCH that happens to start with `tags.` (e.g., `tagSummary`) would be wrongly rejected. Mitigation: prefix match uses `path === entry || path.startsWith(entry + "/")` (path separator boundary), not raw `startsWith`, so `tagSummary` is not treated as a prefix of `tags`.

## Migration Plan

1. **Precondition (Task #1).** Confirm `rename-realm-tag-application` is archived. If not, stop and complete that change first.
2. **Contract update.** Remove `UnitFieldKey` family and `revisionSlotName` vocabulary from `@rezics/contract`. Add `EXTERNALLY_GOVERNED_PATHS`, `editorialPatchSchema`, `unitFieldLockSchema` with `path: string`, and `editorialRevisionPayloadSchema` with `patch` instead of `slots`.
3. **Database migration.**
   - Rename `UnitFieldLock.fieldKey` → `UnitFieldLock.path` (text column, no enum constraint).
   - Drop `UnitRevision.changedFieldKeys` after copying values into a one-shot `UnitRevisionLegacyChangedKeys` column on legacy revisions only (or into the payload itself if simpler), so legacy rendering still has the data.
   - Map existing `UnitFieldLock` rows: each enum value translates to a path. The mapping (`identity.title` → `translations` container lock; `bibliographic.isbn13` → `extension.isbn13`; `credits.authors` → `credits.authors`; `post.body` → `post.body`; `tags` → drop row, log warning; etc.) lives in the migration script. Operators are notified by log that `tags` locks were dropped because tags are now externally governed.
4. **Server.**
   - Delete `loadEditorialSlots`.
   - Update every editorial PATCH endpoint to accept a sparse JSON sub-tree.
   - Replace authority field-key intersection with bidirectional prefix matching over PATCH paths.
   - Update `writeHistoryOutbox` callers to pass `patch` instead of `slots`.
   - Reject editorial PATCH whose paths intersect `EXTERNALLY_GOVERNED_PATHS` with a 4xx pointing at the dedicated governance API.
5. **History service.**
   - Update outbox consumer to recognize both `slots`-shape and `patch`-shape payloads.
   - Compute `changedFieldKeys` from `patch` at read time for post-cutover revisions; read from preserved legacy data for pre-cutover revisions.
   - Hash the patch sub-tree for `contentHash`.
6. **API + app.**
   - Update lock UI: lock target is a path string; the picker offers canonical paths from `@rezics/contract` input schemas.
   - Update history timeline: `changedFieldKeys` displays free-form path strings; UI layer translates common paths to localized labels.
   - Update editorial save flows to submit sparse PATCH bodies.
7. **Tests, convention checks, knip, format, prisma generate.** Full suite green before merge.

Rollback strategy:

- Before any durable environment data exists in `patch`-shape: reverse migration restores `fieldKey` column, restores `changedFieldKeys` column, restores enum constraint. Any newly written `patch`-shape payloads in non-prod environments are dropped or re-formed into legacy shape (development-stage acceptable).
- After durable environment data exists: rollback is no longer simple because new payloads cannot round-trip to the old `slots`-shape. Treat this change as a one-way migration after the first production deploy.

## Open Questions

None. All semantics fixed in Decisions above.
