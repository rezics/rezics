# P01 — Catalog identities, typed facts and content relations

Status: planned, not implemented. Date: 2026-09-06. Parent: [program and gates](README.md).

## Outcome and existing owners

Make each catalog record mean a defined thing, with stable references and a single authoritative writer. Supports U01/U05–U09.
Inspect [Unit](../../../services/main/src/services/database/schema/unit.ts), [Book](../../../services/main/src/services/database/schema/book.ts), [Media](../../../services/main/src/services/database/schema/media.ts), [Entity relations](../../../services/main/src/services/database/schema/entity.ts), [Release](../../../services/main/src/services/database/schema/release.ts), [Series](../../../services/main/src/services/database/schema/series.ts), `services/main/src/services/content-structure`, `units/history.ts`, `units/merge`, `libraries/filter` and generated API consumers.

## Selected contracts

- Keep Unit IDs as identity. Physical owners are publishing, music, program, software, public entities and platform capabilities; start in one PostgreSQL business database, `public` schema. Do not create future-domain placeholder tables.
- Concrete publications/versions can exist independently. Work is an optional, scoped content identity, not a compulsory empty parent for every legacy Book. A legacy record of uncertain grain remains marked uncertain until evidence resolves it.
- Core queried scalar fields stay typed columns; long-tail values use versioned definitions and typed storage; object relationships use identified versioned relation instances. Shared field descriptors do not create two writable copies.
- Relation instances retain original credit text, participants/roles, context, valid-time precision, scope, evidence and revisions. Names of roles are governed data; reference shape and supported operations are versioned code.
- Content identities and composition occurrences remain separate. A track occurrence references a recording; a disc is not automatically a social Unit. Relation queries can cross declared composition without silently propagating progress.
- One owner maintains formal composition or a specialized fact; general relation reads may project it, but cannot independently edit a duplicate edge.
- Accepted facts have explicit active, disputed, withdrawn and superseded states with versioned transitions. Withdrawing one source removes only that support; independent accepted support survives. Restore/reactivation requires a new authorized decision, and replay cannot revive a withdrawn fact. Owner deletion and visibility changes propagate through bounded projection jobs; historical revisions remain addressable only where retention and access permit.
- `UnitRef`, `OccurrenceRef`, `RelationRef`, `RelationRevisionRef`, `SourceRevisionRef` and identified named-form references remain distinct.
- Book format uses governed **multi-valued facets** (for example binding and distribution medium), stored as editorial assignments separate from community fit votes. Multiple compatible facets are valid; incompatible choices are rejected per facet definition. Retire opaque `book.format` after evidence-preserving conversion.
- External identifiers are namespace/scoped claims with validation and provenance. An ISBN checksum or source ID is matching evidence, not an unconditional authorization to merge identities.

## Implementation slices

1. Write accepted/rejected fixtures covering single volume, omnibus, translation, uncertain legacy Book, VN work/release, character credit, music work/recording/release group/release/disc/track, MV and audiobook.
2. Define owner/reference/definition revisions and source-free manual creation commands. Replace fixed business-role restrictions with validated definitions while retaining database FK and value constraints.
3. Introduce necessary domain structures and composition extensions; move heavy localized facts/history by owner. Preserve existing Audio/Video content semantics rather than reinterpreting them as files.
4. Replace whole-structure mutation requirements with node commands, parent pagination and segmented immutable checkpoints. Published formal composition uses concurrency-safe acyclicity; drafts may contain diagnosed invalid structures but cannot advertise complete traversal.
5. Migrate variant/series/credit/subject references, history snapshots, restore, merge manifests, indexes, lifecycle triggers, filter AST and SDK in one coordinated contract slice per owner.
6. Delete replaced writes and obsolete fields through new forward migrations only after conversion checks. Keep archival evidence separately from current authority.

## Acceptance

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
