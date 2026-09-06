# P01 — Catalog identities, typed facts and content relations

Status: native storage foundation implemented; full model and cutover unqualified. Updated: 2026-09-07. Parent: [program and gates](README.md).

**Current critical path:** implement the [source-complete schema milestone](00-source-complete-schema.md).
This is the principal deliverable of the present stage, not a later refinement
after operations or UI work. The [source-to-domain and physical-owner contract](../../report/REZICS-source-complete-catalog-schema-20260906.md#4-physical-schema-contract-to-implement)
is mandatory input to the DDL and mapping inventory. Existing Unit/Book/Media
tables and the repaired merge path do not establish full catalog support.

## Outcome and existing owners

Make each catalog record mean a defined thing, with stable references and a single authoritative writer. Supports U01/U05–U09.
Inspect [Unit](../../../services/main/src/services/database/schema/unit.ts), [Book](../../../services/main/src/services/database/schema/book.ts), [Media](../../../services/main/src/services/database/schema/media.ts), [Entity relations](../../../services/main/src/services/database/schema/entity.ts), [Release](../../../services/main/src/services/database/schema/release.ts), [Series](../../../services/main/src/services/database/schema/series.ts), `services/main/src/services/content-structure`, `units/history.ts`, `units/merge`, `libraries/filter` and generated API consumers.

## Selected contracts

- Unit is the logical identity/reference/capability protocol. Physical identity/lifecycle belongs to publishing, music, program, software, public Entity, grouping and existing platform owners in one PostgreSQL business database, `public` schema. Preserve UUIDs; retire the global `unit` parent in this refactor. Follow the [physical identity and reference contract](../../report/REZICS-source-complete-catalog-schema-20260906.md#41-logical-unit-and-owner-local-physical-identity); do not create future-domain placeholder tables.
- Concrete publications/versions can exist independently. Work is an optional, scoped content identity, not a compulsory empty parent for every legacy Book. A legacy record of uncertain grain remains marked uncertain until evidence resolves it.
- Core queried scalar fields stay typed columns; long-tail values use versioned definitions and typed storage. Fixed structural relations use their domain's constrained records; dynamic semantic relations use governed definitions and identified revisions. Apply the [explicit classification](../../report/REZICS-内容结构关系与查询模型-20260906.md#24-fixed-structural-relations-and-dynamic-semantic-relations) to every source path. Shared descriptors do not create two writable copies.
- Relation instances retain original credit text, participants/roles, context, valid-time precision, scope, evidence and revisions. Names of roles are governed data; reference shape and supported operations are versioned code.
- Content identities and composition occurrences remain separate. A track occurrence references a recording; a disc is not automatically a social Unit. Relation queries can cross declared composition without silently propagating progress.
- One owner maintains formal composition or a specialized fact; general relation reads may project it, but cannot independently edit a duplicate edge.
- Universe/world setting, franchise and series have native identities and shared grouping capabilities in this stage. Preserve distinct membership predicates, continuity/canon/branch and source context, and named ordering profiles. They can be authored without an external source; no mandatory Work, rights inference or automatic score/progress propagation.
- Accepted facts have explicit active, disputed, withdrawn and superseded states with versioned transitions. Withdrawing one source removes only that support; independent accepted support survives. Restore/reactivation requires a new authorized decision, and replay cannot revive a withdrawn fact. Owner deletion and visibility changes propagate through bounded projection jobs; historical revisions remain addressable only where retention and access permit.
- `UnitRef`, `OccurrenceRef`, `RelationRef`, `RelationRevisionRef`, `SourceRevisionRef` and identified named-form references remain distinct.
- Book format uses governed **multi-valued facets** (for example binding and distribution medium), stored as editorial assignments separate from community fit votes. Multiple compatible facets are valid; incompatible choices are rejected per facet definition. Retire opaque `book.format` after evidence-preserving conversion.
- External identifiers are namespace/scoped claims with validation and provenance. An ISBN checksum or source ID is matching evidence, not an unconditional authorization to merge identities.

## Implementation slices

1. Enumerate every required source object/field/relationship from the pinned contracts in `00`, assign native physical owners, then write accepted/rejected fixtures covering single volume, omnibus, serialization/translation updates, uncertain legacy Book, VN work/release/local edition/staff alias/quote, contextual character credit, all MusicBrainz catalog/supporting entities, music work/recording/release group/release/medium/track/TOC, MV and audiobook. A hand-selected happy-path sample is not the coverage denominator.
2. Define owner/reference/definition revisions, source-free manual creation and bounded/rebuildable ID resolution. Name every target family, concrete owner-key FK/checked alternative and deletion/restore rule; inventory existing global-parent consumers. Replace fixed business-role restrictions with validated definitions while retaining database FK and value constraints.
3. Introduce owner-local identities, necessary domain structures, grouping and composition extensions; move heavy localized facts/history by owner. Preserve existing Audio/Video content semantics rather than reinterpreting them as files. Classify every source mapping with its sole writer before DDL acceptance.
4. Replace whole-structure mutation requirements with node commands, parent pagination and segmented immutable checkpoints. Published formal composition uses concurrency-safe acyclicity; drafts may contain diagnosed invalid structures but cannot advertise complete traversal.
5. Migrate variant/series/credit/subject references, history snapshots, restore, merge manifests, indexes, lifecycle triggers, filter AST and SDK in one coordinated contract slice per owner.
6. Coordinate P11 conversion for all catalog and non-catalog consumers, then retire the global identity parent, replaced writes and obsolete fields through new forward migrations after conversion checks. Keep archival evidence separately from current authority.

Required domain scope includes MusicBrainz Area, Place, Event, Instrument, Label,
Series, Genre/Mood and URL semantics, and Bangumi Archive-only person/character
relations and public catalog indices. Their source-required metadata is in this
stage even where older reports called a general-purpose domain a future expansion.

## Acceptance

- The final schema and service paths use owner-local identity without a global `unit` or renamed universal parent. Existing public IDs/slug redirects, private state and references survive; wrong-owner/missing targets and concurrent ownership conflicts are rejected. Locator loss/staleness has bounded repair and a tested rebuild.
- Source coverage names fixed structure versus dynamic relation versus typed value/observation for every required path. Structural edits have one owner; adding a governed role preserves FK/value rules and needs no duplicate edge or hardcoded business enum.
- Source-free universe, franchise and series creation/read/edit/export/history/restore pass. Same-name objects remain distinct; two continuities within one franchise remain distinct; `about` and `set_in_universe` are not conflated.
- Group membership retains multiple sources, disputed/canon/branch context and independent ordering profiles. Withdrawing one support preserves others; memberships do not inherit permissions or move reviews, scores or reading progress.
- A recording appearing on two releases retains two occurrence titles/credits without duplicating recording identity.
- A voice actor/character/version conjunction matches one relation instance; unrelated participants cannot be combined.
- Overlapping omnibus content does not automatically double-count completed progress or transfer scores.
- Definition revision changes revalidate affected new writes; old evidence keeps its original interpretation.
- Withdrawal, owner deletion, restoration and replay preserve independent support and do not resurrect retired facts or expose hidden historical evidence.
- Large structures paginate without truncation, and restore is resumable with an atomic visible head switch.
- Schema replay, backend typecheck, focused domain/history/merge tests, generated SDK typecheck and representative `EXPLAIN (ANALYZE, BUFFERS)` pass.

## Capacity and dependencies

P10 owns the shared resource ledger. Budget identity N, relations rN, participants pR, named forms lN, actual revisions h and evidence eR separately; no corpus-wide graph closure. Owner-first adjacency and reverse-participant indexes must cover both access directions. Test one owner with 1M occurrences/relations and skewed writes through segmented commands; request payload limits are not lifetime object limits.

P02/P03 consume stable identities and revision references. P04 must use these commands, never ad hoc inserts bypassing invariants. Rollback before activation can restore the prior environment; after new writes use P11's journal-aware recovery.

## Implementation evidence

The [current-stage ledger](00-source-complete-schema.md#implementation-ledger--2026-09-07)
records the two native foundation migrations, 87 new tables, 34 actual local
command/constraint assertions and the selective relation-query fixture. The
[native module](../../../services/main/src/services/catalog/README.md) specifies
the current creator-only internal write boundary and remaining integration work.
There is no completed source adapter, full relationship revision/restore system,
public API cutover or retirement of the old global Unit parent yet.
