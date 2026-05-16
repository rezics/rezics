# Postgres Canonical Model Risk Report

**Status**: Exploratory report  
**Date**: 2026-05-06  
**Scope**: PostgreSQL source-of-truth model for the Rezics canonical catalog  
**Report type**: Risk assessment, not an implementation plan or OpenSpec proposal

---

## 1. Executive Summary

The current direction of using PostgreSQL as the canonical source of truth is
sound. The core shape:

- `Unit` as the global identity and lifecycle spine.
- Type-specific extension tables such as `Book`, `Game`, `Media`, `Link`.
- `UnitTranslation` for language-dependent display fields.
- Junction tables for tags, attributions, realms, progress, and other shared
  relations.
- JSON fields only as extensibility pockets, not as the primary schema.

This is a defensible relational model for a large catalog/knowledge system. It
is not an accidental EAV model. It is closer to a supertype/subtype catalog
model, where shared platform behavior lives on the supertype and type-specific
facts live in extension tables.

The highest risks are not caused by using SQL or by abstracting through `Unit`.
The main risks are:

1. Letting dynamic metadata erode the canonical schema boundary.
2. Treating high-cardinality junction tables as small tables.
3. Using hard deletes and cascading deletes on canonical data paths.
4. Keeping high-frequency structures such as `BookIndex` as a single mutable
   JSON blob.
5. Allowing generic list/count/filter APIs to become high-traffic serving
   paths.
6. Relying only on application discipline for critical invariants such as
   type-extension consistency and work/release validity.

Search engines, crawler source deduplication, and raw crawl storage are outside
this report. They are treated as external ingestion/projection concerns. This
report evaluates whether the PostgreSQL canonical layer can remain sustainable
as the stable data source behind those systems.

---

## 2. Scope and Non-Scope

### In Scope

- PostgreSQL schema shape for canonical entities.
- Metadata boundaries and schema governance.
- Type-specific extension tables.
- Translation and language modeling.
- Work/release modeling.
- High-cardinality junction tables.
- Deletion semantics.
- JSON/JSONB usage inside the canonical database.
- Query and index risks inside PostgreSQL.
- Long-term schema evolution.

### Out of Scope

- Crawler source deduplication.
- Raw crawler payload storage.
- Search index topology.
- Meilisearch or Elasticsearch scaling strategy.
- CDC/search projection durability.
- Ranking, search relevance, or search denormalization.
- Exact production sizing, because this report does not inspect production
  database statistics.

---

## 3. Architectural Position

The core data model should keep a strong separation between four different
classes of data:

```text
Raw source payload
  External crawler/raw data, provenance, source-specific fields.
  Not the canonical product model.

Canonical metadata
  Fixed schema, stable type, validated semantics.
  Used by API contracts, filters, sorting, permissions, imports, and reports.

Community classification
  Tags, genres, tropes, moods, warnings, realm-scoped classification.
  Subject to voting, disagreement, local community policy, and moderation.

Wiki / knowledge notes
  Extensible human-authored descriptions, infoboxes, references, version notes,
  background, and other narrative or semi-structured knowledge.
```

Canonical metadata should not be community-voted dynamic fields. If a field
drives platform behavior, it belongs in a typed schema. If a field is community
interpretation, it belongs in tags, realm-scoped classification, or wiki
content.

---

## 4. Risk Register

| ID | Risk | Severity | Main Failure Mode |
|----|------|----------|-------------------|
| R1 | Dynamic metadata becomes canonical metadata | Critical | Schema drift, API instability, unqueryable facts |
| R2 | `extra` JSON becomes a shadow schema | High | Important data escapes validation and indexing policy |
| R3 | Hard delete/cascade on canonical `Unit` paths | High | Lock/WAL/autovacuum spikes, accidental fanout deletion |
| R4 | High-cardinality junction tables outgrow index assumptions | High | Large indexes, slow writes, poor vacuum behavior |
| R5 | `BookIndex.index` remains a single mutable JSON blob | High | TOAST/WAL bloat, write amplification, poor history semantics |
| R6 | Generic list/filter/count APIs become serving APIs | High | Expensive counts, broad scans, unstable latency |
| R7 | Type-extension invariants are not database-enforced | High | `Book` rows attached to non-BOOK Units, orphan semantics |
| R8 | Work/release invariants are under-constrained | High | Cycles, type mismatch, invalid release trees |
| R9 | Community classification is mistaken for metadata | High | Conflicting facts treated as platform truth |
| R10 | Junction vote aggregation scans grow with popularity | Medium-High | Hot associations become expensive to update |
| R11 | Soft-delete uniqueness policy is undefined | Medium | Deleted slugs/identifiers block or leak future reuse decisions |
| R12 | Translation invariants drift | Medium | Missing default translations, invalid language availability |
| R13 | Partitioning is delayed until tables are already painful | Medium | Expensive online migration later |
| R14 | Over-partitioning is introduced too early or by the wrong key | Medium | Planner overhead and operational complexity |
| R15 | Schema evolution lacks an online migration discipline | Medium | Backfills and type changes become risky at scale |
| R16 | Bot/system writes are not operationally bounded | Medium | Bulk writes overwhelm shared paths |
| R17 | JSON-based wiki/infobox content leaks into product filters | Medium | Dynamic content becomes an accidental query surface |
| R18 | Counts and offsets remain default pagination tools | Medium | Poor latency as tables grow |
| R19 | Index budget is not treated as a product decision | Medium | Every feature adds indexes until write cost dominates |
| R20 | Postgres is treated as both OLTP source and analytics store | Medium | Reporting scans interfere with serving workload |

---

## 5. Detailed Findings

### R1. Dynamic Metadata Becomes Canonical Metadata

**Severity**: Critical

The most important design risk is allowing dynamic metadata to act as canonical
metadata.

For the same type of work, metadata should be a stable schema. A `Book` should
have typed metadata such as `isbn13`, `publicationDate`, `pageCount`,
`textLength`, `formatKey`, and `isLicensed`. These fields have platform
semantics: they may drive filtering, sorting, validation, imports, permissions,
API contracts, and reporting.

If canonical metadata becomes dynamic, the system will accumulate multiple
representations of the same concept:

```text
publisher
publishers
publishing_house
press
出版社
```

It will also accumulate type drift:

```text
releaseDate: "2024"
releaseDate: "2024-03-01"
releaseDate: { "year": 2024, "month": 3 }
release_date: 1710000000
```

At small scale, this looks flexible. At catalog scale, it becomes schema debt
that must be paid on every query, every API boundary, every migration, and
every downstream projection.

**Recommended boundary**

- Canonical metadata: fixed schema.
- Tags: community classification.
- Wiki: human-extensible interpretation and notes.
- Raw crawler/source fields: external ingestion payload or source-specific
  storage.

### R2. `extra` JSON Becomes a Shadow Schema

**Severity**: High

The schema includes `extra Json?` fields on `Unit` and extension tables. This is
useful, but it is also a common path to accidental schema bypass.

`extra` is safe for:

- Rarely queried display hints.
- Source-specific payload fragments.
- Feature flags or small extension data.
- Experimental fields before promotion.

`extra` is unsafe for:

- Fields used in filters.
- Fields used in sorting.
- Fields used in permissions.
- Fields required by public API contracts.
- Fields used for identity, deduplication, or merge decisions.
- Fields that need validation across records.

**Rule**

If a field becomes product behavior, promote it out of JSON into a typed column
or side table.

### R3. Hard Delete and Cascading Delete on Canonical Paths

**Severity**: High

The schema uses many cascading relations. Services also call hard delete on
`Unit` rows. This is dangerous for a large canonical catalog.

Hard-deleting a high-fanout Unit can affect many tables:

- Type extension row.
- Translations.
- Support languages.
- Tags and tag votes.
- Attributions.
- Realm membership.
- Realm tag rows and votes.
- User progress.
- Shelf references.
- Posts targeting the Unit, depending on relation behavior.

Large cascades can produce lock contention, WAL spikes, autovacuum pressure, and
hard-to-predict latency. They also make accidental deletion more severe.

**Recommended boundary**

- User/product delete path should be soft delete: `Unit.status = DELETED`.
- Hard delete should be a controlled maintenance/compliance path.
- High-fanout cleanup should be asynchronous and observable.
- Cascades remain useful as final cleanup safety, not as the default product
  deletion mechanism.

### R4. High-Cardinality Junction Tables

**Severity**: High

The main scale pressure is unlikely to be `Book` itself. It will be junction
tables:

- `UnitTag`
- `TagVote`
- `Attribution`
- `RealmUnit`
- `RealmTagUnit`
- `RealmTagVote`
- `ShelfUnit`
- `UserUnitProgress`

If 30 million books average 20 tags, `UnitTag` alone reaches 600 million rows.
If popular Units receive many tag votes, `TagVote` can be much larger.

These tables need an explicit capacity model:

- Expected average fanout.
- Expected maximum fanout.
- Which side is queried most often.
- Which indexes are required for product behavior.
- Which indexes are only admin/debug convenience.
- Which tables need partitioning.
- Which operations are write-hot.

**Risk pattern**

Small-table assumptions hide in join tables because each individual relation
looks simple. At catalog scale, these become the physical database.

### R5. `BookIndex.index` as a Single Mutable JSON Blob

**Severity**: High

`BookIndex` currently stores the chapter/tree index as a single JSON value. This
is acceptable for low-frequency whole-tree reads and writes. It is not ideal for
high-frequency chapter synchronization or collaborative editing.

Risks:

- Every small chapter update rewrites the whole JSON value.
- Large JSON values can create TOAST and WAL amplification.
- Concurrent edits are hard to merge.
- History is hard to model correctly from whole-state overwrites.
- Partial indexing/querying inside the tree remains limited.

The existing history infrastructure discussion already identifies a better
direction: treat `BookIndex` as a distinct aggregate with event-sourced changes
and periodic snapshots.

### R6. Generic List/Filter/Count APIs as Serving Paths

**Severity**: High

Generic list APIs are useful for admin, tools, and low-traffic surfaces. They
are dangerous as high-traffic discovery APIs.

Problem patterns:

- Broad filter combinations.
- Text `contains` over translation fields.
- Offset pagination.
- Exact `count()` on large filtered sets.
- Joins across translations/tags/attributions.
- Sorting on fields that do not match the leading index path.

The canonical Postgres model should expose specialized, product-owned query
paths for high-traffic reads. Generic list endpoints should remain bounded,
admin-oriented, or backed by explicit indexes and keyset pagination.

### R7. Type-Extension Invariants

**Severity**: High

The model relies on a convention:

```text
Unit.type = BOOK  <=>  Book row exists
Unit.type = GAME  <=>  Game row exists
Unit.type = MEDIA <=>  Media row exists
```

PostgreSQL foreign keys ensure the extension row references a Unit, but they do
not automatically ensure the Unit has the matching `type`. Without enforcement,
bad writes can produce semantically invalid rows.

Possible mitigations:

- Keep all writes behind typed service methods.
- Add database triggers for critical type-extension checks.
- Add periodic invariant checks for existing data.
- Add migration tests that detect invalid type-extension combinations.

At small scale, application discipline can be enough. At large scale and with
bot/import writes, invariant checks become much more important.

### R8. Work/Release Invariants

**Severity**: High

The `Unit.workUnitId` relation is central to the work/release model. It should
have explicit invariants:

- A Unit should not point to itself as its work.
- Work/release chains should not form cycles.
- Release type should match work type, unless a specific cross-type rule exists.
- A canonical work should have clear rules for whether `workUnitId` is null.
- A translated release should not accidentally become a second-level release
  unless that is intentional.
- `UnitTranslation.sourceReleaseUnitId` should only reference valid releases of
  the same work.

Some of this is hard to express with plain constraints. It may require service
validation, triggers, or scheduled consistency checks.

### R9. Community Classification Mistaken for Metadata

**Severity**: High

Tags and realm-scoped tags are community classification. They can be voted on,
disputed, hidden below thresholds, or scoped to a community.

They should not be treated as canonical metadata.

Examples:

- "Psychological horror"
- "Slow burn"
- "Female protagonist"
- "Contains gore"
- "Good beginner novel"
- "Steam Deck playable"

Some of these may eventually become product fields, but only after the platform
decides on a stable meaning, type, validation rule, and source of truth.

Until then, they belong in tag systems or wiki content.

### R10. Vote Aggregation on Popular Associations

**Severity**: Medium-High

The current tag vote pattern recomputes aggregate score/count from the vote
table for a `(unitId, tagUnitId)` pair. This is clean and correct, but it can
become expensive for extremely popular associations.

For most catalog rows, this is fine. The risk is hot rows:

- A popular book.
- A controversial tag.
- A major realm-scoped tag.
- A bot or migration touching many votes.

Potential mitigations:

- Incremental counter updates under transaction.
- Periodic reconciliation jobs.
- Hot association detection.
- Write rate limits.
- Separate moderation/batch paths for bulk vote operations.

### R11. Soft-Delete and Uniqueness Policy

**Severity**: Medium

`Unit.slug` is globally unique. If Units are soft-deleted, the system must decide
whether deleted slugs remain reserved forever or can be reused.

Both choices are valid, but the choice must be explicit.

Permanent reservation:

- Safer for links, audit, and anti-impersonation.
- Prevents reuse of old public identity.

Reuse after deletion:

- Better namespace availability.
- Requires partial uniqueness or additional slug history.
- Can confuse old links and audit trails.

For canonical catalog identity, permanent reservation is usually safer unless
there is strong product pressure for reuse.

### R12. Translation Invariants

**Severity**: Medium

The translation layer is a strong design choice, but it needs invariants:

- `defaultLanguage`, if set, should have a corresponding `UnitTranslation`
  unless the Unit is intentionally language-neutral.
- `isLanguageNeutral` should have clear rules for translations and language
  filters.
- Language codes should be normalized before persistence.
- Work translation `sourceReleaseUnitId` should not be used outside the
  work/release model.
- Release Units and work Units should have distinct translation semantics.

Without these rules, language filtering and rendering will drift over time.

### R13. Delayed Partitioning

**Severity**: Medium

Postgres can handle very large tables, but the tables that are likely to need
partitioning should be identified before they are painful to migrate.

Candidates:

- `TagVote`
- `RealmTagVote`
- `UserUnitProgress`
- Future history/event tables.
- Future audit/outbox tables.

Partitioning should be based on access patterns, not table size alone. A table
queried mostly by `unitId` may need a different partition key than one queried
mostly by `userId` or time.

### R14. Wrong or Premature Partitioning

**Severity**: Medium

Partitioning is not free. The wrong partition key can make queries worse and
increase operational complexity.

Risks:

- Too many partitions.
- Partition key not present in common filters.
- Queries that touch many partitions.
- More complex uniqueness constraints.
- Harder migrations and backups.

Partition only after the access pattern is clear, but before table size makes
the migration operationally dangerous.

### R15. Online Schema Evolution

**Severity**: Medium

Large canonical databases need disciplined schema evolution.

Avoid:

- Large blocking rewrites.
- Required columns without phased backfill.
- Semantic type changes in place.
- Renaming fields without dual-read/dual-write periods.

Prefer:

- Add nullable column.
- Backfill in batches.
- Dual-write where needed.
- Switch reads.
- Enforce not-null/check later.
- Remove old field after observation.

This matters more for SQL than document stores because the schema is explicit,
but that explicitness is also what makes safe migration reviewable.

### R16. Bot/System Write Volume

**Severity**: Medium

The "bot is user" model is good. It keeps audit, permission, and moderation
uniform.

The operational risk is write volume. Bot writes can be much more bursty than
human writes.

Required controls:

- Bot identity.
- Bot scopes and quotas.
- Bulk-write lanes.
- Rate limiting.
- Batch size limits.
- Observability for write amplification and failed writes.

### R17. Wiki/Infobox Leakage into Product Filters

**Severity**: Medium

Wiki content can be flexible. But once wiki fields are used as product filters,
sort keys, or API contract fields, they become metadata.

Risk:

```text
Wiki infobox says "publisher = X"
Product later filters by publisher
Now wiki content is silently canonical metadata
```

If a wiki field becomes important enough to query as platform behavior, it
should go through a promotion process into typed schema or a governed side
table.

### R18. Counts and Offset Pagination

**Severity**: Medium

Exact counts and offset pagination are acceptable for small result sets and
admin tools. They are not ideal for high-volume catalog traversal.

Preferred pattern:

- Keyset pagination for stable large lists.
- Approximate counts for broad catalog pages.
- Cached counts for common product surfaces.
- Exact counts only when the query is bounded or explicitly admin/debug.

### R19. Index Budget as Product Decision

**Severity**: Medium

Every index improves some reads and taxes writes, storage, vacuum, and memory.
At large scale, indexes are not implementation details; they are product
commitments.

Each index should answer:

- Which query owns this index?
- Is that query product-critical?
- What is the expected cardinality?
- What is the expected write amplification?
- Can the query be served by a projection instead?
- Is the index still used?

### R20. Postgres as OLTP and Analytics Store

**Severity**: Medium

The canonical Postgres database should not become the default analytics engine.

Large scans for reporting, dashboards, or offline analysis can interfere with
serving traffic through IO, cache churn, and locks. Analytics should eventually
move to a separate read replica, warehouse, column store, or exported event
stream.

---

## 6. SQL vs NoSQL Assessment

The discussion clarified an important point:

NoSQL does not eliminate schema. It moves schema into application code, document
shape conventions, migrations, and human discipline.

For raw source payloads, flexible document storage can be appropriate. For a
canonical catalog, the source of truth needs stronger guarantees:

- Stable identity.
- Valid references.
- Explicit uniqueness.
- Transactional multi-row writes.
- Auditable schema evolution.
- Reliable joins across shared concepts such as works, releases, entities,
  tags, realms, translations, and users.

Large companies often use NoSQL-style systems for scale, logs, raw events,
caches, and projections, but mission-critical canonical models frequently move
back toward relational semantics. Google's F1 and Spanner papers are examples
of this direction: distributed storage and sharding combined with SQL,
transactions, schema, indexing, and change tracking.

The right conclusion is not "never use NoSQL." The right conclusion is:

```text
Raw payload and external projections can be flexible.
Canonical facts should be governed.
```

---

## 7. Metadata Governance Boundary

Canonical metadata should meet all of these criteria:

- The platform defines the meaning.
- The type is stable.
- The field is used by APIs, filtering, sorting, permissions, import/export, or
  reporting.
- The value has validation rules.
- The field has a clear source of truth.
- Changes are auditable.

Community classification should meet different criteria:

- The community can disagree.
- The value can be voted on.
- The value can vary by realm/community.
- The value can be hidden or moderated.
- The value may be fuzzy or interpretive.

Wiki content should be broader:

- It can be narrative.
- It can cite sources.
- It can contain infobox-like semi-structured data.
- It can evolve without becoming a platform API.

**Hard rule**

If a dynamic field becomes necessary for product behavior, it should be promoted
into canonical schema through a reviewed migration.

---

## 8. Recommended Guardrails

These are guardrails, not an implementation plan.

1. Keep `Unit` thin.
2. Keep type-specific metadata in typed extension tables.
3. Use `extra` only for non-contractual, rarely queried data.
4. Treat tags and realm tags as community classification, not canonical facts.
5. Treat wiki/infobox content as descriptive content, not product metadata.
6. Use soft delete as the default deletion path for canonical Units.
7. Reserve hard delete for controlled maintenance or compliance paths.
8. Define capacity models for high-cardinality junction tables.
9. Add invariant checks for type-extension and work/release consistency.
10. Use specialized query paths for product traffic.
11. Avoid exact counts and offset pagination on broad catalog queries.
12. Plan partitioning for vote/progress/history-style tables before they become
    operationally painful.
13. Govern schema evolution with phased online migration patterns.
14. Treat indexes as product-owned read paths with explicit justification.
15. Keep analytics/reporting scans off the primary OLTP workload.

---

## 9. Suggested Future OpenSpec Topics

This report does not create proposals, but the following topics are strong
candidates for future OpenSpec changes:

- `canonical-metadata-governance`
- `unit-soft-delete-policy`
- `type-extension-invariant-checks`
- `work-release-invariant-checks`
- `junction-table-scale-strategy`
- `book-index-event-model`
- `postgres-query-surface-hardening`
- `json-extra-usage-policy`

---

## 10. External References

- MongoDB polymorphic data pattern:
  https://www.mongodb.com/docs/manual/data-modeling/design-patterns/polymorphic-data/
- Google F1: The Fault-Tolerant Distributed RDBMS Supporting Google's Ad
  Business:
  https://research.google/pubs/pub38125
- Google F1: A Distributed SQL Database That Scales:
  https://research.google/pubs/f1-a-distributed-sql-database-that-scales/
- Google Spanner: Becoming a SQL System:
  https://research.google/pubs/spanner-becoming-a-sql-system/
- Google Spanner: Google's Globally-Distributed Database:
  https://research.google/pubs/spanner-googles-globally-distributed-database-2/
- PostgreSQL table partitioning:
  https://www.postgresql.org/docs/current/ddl-partitioning.html

---

## 11. Final Position

The PostgreSQL canonical model is a good foundation if its boundaries are kept
strict.

The system should not chase dynamic metadata inside the canonical layer.
Dynamic metadata is attractive because it reduces short-term schema work, but it
pushes semantic cost into every future query, migration, API, and data cleanup.

For Rezics, the sustainable split is:

```text
Fixed schema for canonical facts.
Tags for community classification.
Wiki for open-ended knowledge.
External/raw storage for crawler-specific payloads.
Search projections for discovery.
```

The abstraction work in PostgreSQL is therefore not wasted. It is the cost of
making the catalog governable over years of growth.
