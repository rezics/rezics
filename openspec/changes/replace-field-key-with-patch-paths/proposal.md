## Why

The editorial regime (lock, history, collaborative authority) currently shares a hand-curated `UnitFieldKey` enum that mixes JSON paths (`identity.title`, `bibliographic.isbn13`), predicate filters (`credits.authors`, `credits.translators`), and ad-hoc namespaces (`identity.*` straddles translations and unit metadata). The enum is consumed by `UnitFieldLock`, `UnitRevision.changedFieldKeys`, and the authority intersection check.

This shape forces every new editable field, attribution role, and content sub-tree to be enumerated in the contract before lock and history can operate on it. It also forces history writers to load the full current state of all editorial slots (`loadEditorialSlots`) on every change, so that the snapshot remains content-addressed — re-snapshotting `translations`, `extension`, `credits`, `subjects`, and `tags` on every title edit even though those slots are unchanged. The slot vocabulary itself is overloaded by `ContentDoc.slots` in the in-flight `introduce-content-doc-schema` change, blocking the introduction of structured content without further confusion.

This change replaces the enum with a path-based editorial PATCH protocol: clients submit sparse JSON sub-trees describing what they intend to change, the server validates the submission against path-based locks, and history records the submitted patch itself. Lock paths, history payloads, and changed-key derivation all become structural operations over the PATCH input. A list of externally-governed paths (`tags`, `realmTagApplications`) is declared off-limits to the editorial regime entirely so that vote-governed and owner-governed surfaces do not pollute editorial history or invite ineffective locks.

## What Changes

- **BREAKING** Remove `UnitFieldKey`, `UnitCommonFieldKey`, `BookFieldKey`, `EntityFieldKey`, `GameFieldKey`, `MediaFieldKey`, `AttributionFieldKey`, `WikiPostFieldKey`, `UNIT_FIELD_KEYS`, `unitFieldKeySchema`, and `lockFieldKeySchema` from `@rezics/contract`.
- **BREAKING** Replace `UnitFieldLock.fieldKey` with `UnitFieldLock.path`. The column remains a string, but loses the enum constraint and becomes a free-form JSON path. `UNIT_FIELD_LOCK_ALL = "*"` is retained as a sentinel meaning "whole Unit" within the editorial regime.
- **BREAKING** Replace `UnitRevision.changedFieldKeys` with a derived path list computed from the stored PATCH sub-tree at read time. The column is dropped from `UnitRevision`.
- **BREAKING** Replace `EditorialRevisionPayload.slots` with `EditorialRevisionPayload.patch` — the sparse JSON sub-tree containing exactly what the client submitted. Remove `revisionSlotName` vocabulary entirely.
- Introduce a new capability `editorial-patch-protocol` that fixes PATCH submission semantics: sparse merge, `null` writes SQL NULL, deletion requires an explicit `$unset` directive, collection (array) values replace whole (no array-index PATCH).
- Introduce `EXTERNALLY_GOVERNED_PATHS` in `@rezics/contract` listing path prefixes (`tags`, `realmTagApplications`) that are governed by external systems (vote ledgers, owner approval). The editorial regime SHALL reject these paths at the PATCH boundary, SHALL NOT write outbox rows for them, and SHALL NOT honor locks for them — including `*`.
- Replace lock comparison with **bidirectional prefix matching** between PATCH paths and stored lock paths. A PATCH is rejected if any of its leaf paths and any lock path are mutual prefixes (one contains the other, or they are equal).
- Remove the `loadEditorialSlots` re-snapshot pattern from `package/server`. History outbox writers persist the patch sub-tree directly; content-address dedup hashes the patch.
- Replace `post.body` lock vocabulary with PATCH path `post.body` (no enum). The same path becomes `post.content.main.source` after the `introduce-content-doc-schema` change lands; no contract update is required for that transition because the path is dynamic.

## Capabilities

### New Capabilities

- `editorial-patch-protocol`: PATCH submission semantics for editorial Unit updates, including sparse merge, `null` handling, explicit deletion, collection replacement, bidirectional prefix-match lock comparison, externally-governed paths exemption, and path canonicalization rules.

### Modified Capabilities

- `content-authority`: Lock vocabulary changes from `UnitFieldKey` enum to free-form JSON path strings. Lock comparison becomes bidirectional prefix match. `EXTERNALLY_GOVERNED_PATHS` cannot be locked and are not affected by `*`.
- `content-history-service`: Editorial revision payload changes from slot-based snapshot to PATCH sub-tree. `changedFieldKeys` becomes a derived projection over the stored patch. Externally-governed paths produce no outbox rows. The `loadEditorialSlots` full re-snapshot pattern is removed.

## Impact

- Affected packages: `package/contract`, `package/server` (every editorial PATCH endpoint, `collaborative-metadata`, `authority.service`, `history-outbox`, post / book / entity / unit services), `package/history` (revision payload type, hash computation, `changedFieldKeys` derivation), `package/api`, `package/app` (lock UI, history timeline render, PATCH submission wiring).
- API contracts: editorial PATCH endpoints accept sparse JSON sub-trees. `UnitFieldLock` DTO loses `fieldKey`, gains `path`. `UnitRevision` DTO loses `changedFieldKeys` as a stored field but retains it as a derived field computed by the history service.
- Database: `UnitFieldLock.fieldKey` column renamed to `path`; enum constraint dropped. `UnitRevision.changedFieldKeys` column dropped. `HistoryOutbox.payload` shape changes (now carries `patch` instead of `slots`). A development migration converts existing lock rows from old `UnitFieldKey` values to equivalent path strings (`identity.title` → `translations` container lock; `bibliographic.isbn13` → `extension.isbn13`; `credits.authors` → `credits.authors`; etc.) using a hand-curated mapping.
- This change is intentionally breaking for internal callsites in the development stage. Spec deltas for `content-authority` and `content-history-service` previously included in `introduce-content-doc-schema` are removed from that change and consolidated here.
- Depends on `rename-realm-tag-application` being archived first so `EXTERNALLY_GOVERNED_PATHS` can reference the post-rename `realmTagApplications` name. The first task in this change verifies that precondition.
- `introduce-content-doc-schema` SHALL be sequenced after this change. Its remaining scope (ContentDoc shape, storage cut-over, Meilisearch projection) becomes simpler because lock and history are already path-based.
