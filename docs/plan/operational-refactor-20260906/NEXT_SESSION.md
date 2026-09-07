# Continuation handoff — 2026-09-07

This handoff was requested by the maintainer after the current integration batch.
It is a continuation of the same product objective, not authorization to declare
the program complete because foundations or isolated parsers exist.

## Goal and authority

Finish `docs/plan/operational-refactor-20260906` to the point that REZICS can
natively carry VNDB, MusicBrainz (including physical albums) and Bangumi. The
existing book-index and provider-independent shared-model requirements remain
part of the plan. Required work includes native create/read/query/edit/export,
source mappings, exact evidence/history, real consumers and operational source
updates. Do not count raw archive preservation as native semantic coverage.

The maintainer explicitly authorizes autonomous research, decisions, document
corrections and commits. Documents are revisable records; old documentation-only
pauses do not block implementation. Use Codex native subagents, primarily
`gpt-6-astra` at `high`; use `xhigh` only for complex research. Prefer independent
owners and worktrees under `D:/rezics-repos`. Run each owner's narrow checks;
coordinate broader affected typechecks and combined migrations centrally.

Read `AGENTS.md`, `CONTRIBUTING.md`, the program README and `00` before changes.
Preserve unrelated user work. No production deployment or legacy-database reset
is implied. No AI browser/visual QA was requested; affected frontend TypeScript
checks remain mandatory. Generated SQL/OpenAPI/SDK must use owning generators.

## Repository and checkpoint

Repository: `D:/rezics-repos/rezics`, main branch. Inspect current `git status`,
`git log` and `git worktree list`; the handoff must not override later user edits.
The previous context/event foundation was committed as `9f510ce7a`; shared
reference contracts were committed as `27cd37c7a`. Subsequent main commits contain
the integrated native/source/event batch. The maintainer's unrelated Codex
configuration commit `9ab974dc8` was preserved.

Validation and the final integration commit are summarized in the current-stage
implementation ledger. Full source qualification and global Unit retirement
remain open. No frontend route or generated public SDK integration is implied
by the internal native command modules.

The batch migration is `20260907082947_catalog_native_source_event_batch.sql`.
Fresh replay passed 47 migrations / 3,884 file statements; canonical definitions,
source/operational partitions and Atlas schema equality were checked. Backend
and script TypeScript checks passed, as did 246 scoped backend/tooling tests and
three shared-reference tests. Nine native/source SQL harnesses and additional
source rollback/context skew checks passed. See the ledger for the evidence
boundary; there was no global test-suite or browser acceptance run.

## Implemented owners to inspect

- `services/main/src/services/catalog/music-domain.ts`, `music-candidates.ts`,
  `music-history.ts`, `musicbrainz-*.ts`: physical releases/media/tracks,
  regional dates, packaging, labels/catalog numbers, identifiers, disc/TOC and
  presentation data, incomplete disc candidates, metadata history and native
  readers. `music-native.md` records exact remaining gaps.
- `catalog/software.ts`, `software-contexts.ts`, `vndb*.ts`: software versions,
  releases/patches, language/media/platform/territory metadata, snapshot-local
  participation contexts, selected taxonomy/quote/association mappings and
  scalar history. `software-capacity.md` records gaps.
- `catalog/program.ts`, `publishing.ts`, `bangumi-*.ts`, `source-adoption.ts`:
  subject-grain selection, episode/constituent models, ordered occurrences,
  serializations/installments, indices, API/Archive relationships and governed
  ordered wiki fields. Ambiguous music/book episodes do not fabricate recordings
  or an unsupported universal Edition chain.
- `catalog/entities.ts`, `references.ts`, `grouping.ts`: people/organizations/
  characters, reference profiles, concepts, web resources and independent
  grouping/order operations. Supporting VNDB/MusicBrainz adapters are separate.
- `catalog/distribution.ts`: optional mixed-media package identity; checked
  repeated occurrences, bounded manifests, immutable heads and restore.
  Distribution is not a mandatory parent of music/software/book releases.
- `catalog/definitions.ts`, `definition-contracts.ts`, `semantic-history.ts`:
  governed properties/predicates/roles, immutable semantic heads, bounded fact
  and relation paging. `SEMANTICS.md` describes limits and acceptance.
- `catalog/names.ts`, `identifiers.ts`, `authority.ts`: identified names,
  identifiers, revisions and exact source name occurrences. Read
  `docs/architecture/catalog-names-and-authority.md`.
- `catalog/source-*.ts`: deterministic source IDs, composite source bindings,
  acquisition generations, subscriptions, proposal state machine, shared rate
  budgets and reopened archived receipts. Read
  `docs/architecture/catalog-source-lifecycle.md`.
- `services/main/src/event-worker.ts`, `services/events/*`: source check and
  fanout task execution, transactional outbox/receipts, bounded relay/checkpoint/
  quarantine behavior. Preferred Debezium relay was tested, including restart
  and lost publish acknowledgments. Read `runtime.md` and
  `debezium-qualification.md` in that module.
- `libraries/reference`: authoritative eight catalog and twelve retained
  platform owner names plus strict `{ owner, id }` references. This is a code
  protocol, not a universal identity parent table or proof of permission.

`catalog/source-export.ts` now exports immutable archived source evidence from
verified receipts. Native domain readers/export pages are distinct. Restore the
meaning of neither "native export" nor coverage by reintroducing per-field raw
JSON wrappers into the canonical fact store.

## Highest-priority unfinished work

1. **Complete source semantic coverage and native updates.** Reconcile actual
   API plus public dump/Archive/definition contracts, not just the original
   declaration count. VNDB staff/voice alias and edition-context joins, remaining
   dump associations, complete language/title evidence and component restore are
   unfinished. MusicBrainz remaining SQL import/redirect/artwork metadata,
   structural update/restore and some alternate presentations remain open.
   Bangumi Archive Subject entry, all native index/member comments, fixed-field
   program/publishing history and runtime registration need completion.
2. **Use genuine native update callbacks for proposal application.**
   `decideCatalogSourceProposal` supplies exact source/snapshot/target and
   preconditions. Recalling a first-adoption function merely queues review again.
   Each mapper needs a structural update/withdraw/compensation writer that
   preserves unrelated local edits and checks exact child revisions, not only
   the aggregate identity revision.
3. **Complete acquisition and runtime registration.** Current acquisition
   registry is selected VNDB VN/release, MusicBrainz release and Bangumi subject.
   Supporting families and full-corpus continuation still need registration,
   admission, recovery and conformance. Source-private transport sharing is not
   implemented. Destructive receipt/outbox cleanup remains disabled until a
   proved archive/rebuild and replay frontier exists.
4. **Retire global Unit and Profile consumers.** The baseline audit found
   104 direct `unit` FK declarations across 36 files/93 tables. There are twenty
   target physical owners. Profile public identity becomes Entity; private state
   belongs to Auth. Zone Page is a Post capability. Slug namespace is address
   configuration. Preserve standalone Audio/Video content identity. No universal
   replacement entity/reference parent, compatibility view or unchecked
   polymorphic FK is acceptable.
5. **Wire the real product.** Native owner APIs, shared authorization, generated
   OpenAPI/SDK and retained Web flows still require coordinated conversion.
   Preserve reviews/lists/scoring, journal/private progress, tags, follows,
   slugs, history/restore, themes and content structures. Adding native tables
   alone does not connect these existing product paths.
6. **Complete exact authority and recovery.** Language-channel support and
   release/content-version authority need immutable referenced revisions.
   Account erasure, immutable audit/source history, revoked support and safe
   restoration must be reconciled. Production HA/recovery/throughput is not
   certified by local indexed fixture timings.

## Preserved P02 draft — do not merge blindly

Branch `codex/delivery-participation-20260907`, checkpoint
`acdf5a5c5618f0d20d19a8281dbf7c38887050ea`, deliberately not merged into this batch.
It contains `ensureSelfEntity`, SessionEntity/principal/actingEntity context,
Auth/Entity bindings, service principals, scoped grants, account preferences
and an unmounted participation API plugin. Nineteen focused tests passed.

At that checkpoint, the broader backend check still reported 310 downstream
Profile/session/preference diagnostics across fifty files. Inspect current code
before applying; those numbers are historical diagnostics, not a current check.
`Authorization(entity.id)` still depends on old Profile behavior, private
preferences must use Auth rather than an acting organization, service-actor
shape needs integration, no-context creator fallback remains, and account
erasure/last-controller recovery is unresolved. No SQL race or complete API
lifecycle acceptance was claimed for that draft.

Recommended remaining ownership split: participation/ACL; community roots and
interactions; tags/expressions; structures/documents/themes; history/merge/
governance; addressing/bootstrap; search/progress/projections; native API and
Web integration. One coordinator owns shared schema/API indexes, manifests,
generated clients, migration generation and final integration.

## Source pins and tooling cautions

The original 8,412 declarations are a superset containing private/editorial/
transport material and omit some dump/wiki contracts. The coverage gate does
not yet prove full native mappings. The committed VNDB compound dump manifest is
`catalog/source-contracts/vndb-dump-contract.json`, revision
`514f2391cc12aa94ce420354863c52538641d9b1`, SHA-256
`d3bd70446cd39cc5bf0bfb0a3c3c2fd8031ab0ffc897a28da4b64001a77a5b31`.
It covers schema, export filtering and Types.pm; API-only inventory is insufficient.
MusicBrainz art archive and Bangumi common wiki/Archive declarations also belong
in the reviewed semantic inventory. Unseen freeform wiki keys require reviewed
typed definitions; retaining them as unresolved source evidence is not a claim
that they have already been adopted.

Use `task services-main:db:generate -- <snake_case_name>`. Source partition
replacement requires the reviewed pre-overlay; PostgreSQL cannot turn an
ordinary table into a partitioned table in place. Atlas Community omits child
partitions from inspection. The before-canonical overlay creates physical
children before leaf constraint triggers, and explicit checkers verify them.
Read the source-partition tooling README before changing that ordering.
The migration targets a fresh replacement database; separate legacy conversion
does not run in application runtime. Never infer permission to reset normal dev.

The generation environment's Atlas dev URL uses port 5433. Give its Compose
project a task-specific name so the replay reset cannot hit someone else's
fixture. Parent checks in this batch used a separate loopback PostgreSQL port
25434; actual availability must be inspected again. Ordinary dev uses 15432.

Windows worktrees may have `node_modules` junctions to main. Verify their target,
then detach only their reparse metadata with `fsutil reparsepoint delete <exact
worktree/node_modules>` before native Git worktree removal. Never recursively
traverse the junction into main dependencies. Keep unmerged draft branches;
remove only task-created worktrees after integration or verified committed
handoff. Use precise file cleanup rather than broad recursive deletion.

Resume from current evidence and code. Do not rerun every repository suite for
each worker or rediscover already pinned sources without a concrete uncertainty.
Do run all deterministic checks affected by the final integrated changes, and
report source/model/product/production qualification as separate outcomes.
