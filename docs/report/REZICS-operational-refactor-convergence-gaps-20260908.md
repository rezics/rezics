# Operational refactor: convergence boundary and remaining gaps

The maintainer requested convergence on 2026-09-08: retain the implemented native
platform, stop extending complex source capabilities, record the remaining work
separately, and consolidate the task branches and worktrees into a linear `main`.
This document records that boundary. It is **not** a declaration of complete
VNDB, MusicBrainz, Bangumi, production-capacity or recovery qualification.

## Retained implementation

- Eight native catalog owners and twelve platform owners replace the physical
  global Unit parent. References retain concrete foreign keys and checked owner
  alternatives. Public Entity identity and private Auth account state are separate.
- The authorized replacement is one fresh native baseline,
  `20260908000000_operational_target_baseline.sql`. The previous migration chain
  remains in Git history. It must not be replayed before this baseline. Legacy
  record conversion is a separate offline program; the baseline is not an
  in-place upgrade of an occupied development or production database.
- Native resource, name, identifier, definition, fact, relation, source-review,
  domain, grouping and context-measurement APIs are connected to generated SDKs
  and Web routes. Editorial summaries, Portable Text and images have independent
  language revisions and history. Entity fixed profiles remain separate from
  controller-authored public presentation.
- Source editing and target consent are distinct in credit attribution. A
  selected `catalog.edit` grant does not inherit personal `entity.publish`
  authority. Requests and acceptance can use their separately authorized
  contexts; acceptance rechecks the original proposer's current grant.
- Source acquisition, immutable evidence, optimistic updates, compensation,
  outbox admission and worker receipts are implemented. Large MusicBrainz release
  jobs prepare foreign identities before atomically publishing the release graph.
  Foreign reference evidence does not give its containing release ownership of
  the referenced Entity, recording or vocabulary.
- Native Web routes retain the implemented review, score, list, discussion,
  progress, tag, source-review and editing paths. Obsolete physical kinds and
  their unreachable consumers were removed. Rendering acceptance belongs to the
  maintainer; it was not replaced by TypeScript or fixture checks.

## Evidence at convergence

These results have deliberately different scopes. No small fixture is a
500-million-row benchmark.

| Check | Observed result | Boundary |
| --- | --- | --- |
| Fresh database installation | One migration, 15,421 SQL statements, about 5m47s | Isolated PostgreSQL target before final whitespace-only regeneration; not an existing deployment upgrade |
| Canonical PostgreSQL objects and Atlas/Drizzle diff | Both passed before final whitespace-only regeneration | Explicit, separate scratch database used for Atlas normalization; final replay exception recorded below |
| Backend behavior tests | 326 files, 1,772 tests passed | Repository Vitest suite; the new pure source tests now use that runner |
| Web and worker TypeScript; localization policy | Passed | Code integrity only; no browser, screenshot or rendered interaction acceptance |
| OpenAPI and three SDKs | Official generators and their TypeScript checks passed | Generated files were not patched by hand |
| Editorial and fixed-profile API fixture | 805 assertions passed | Eight owners, language bounds, conflict atomicity, history, withdrawal, restore and partitioned lookup plans; image upload/storage lifecycle was not exercised by this fixture |
| Attribution and consent API fixture | 742 assertions passed | Real Auth sessions, selected grants, revocation, separate request/acceptance, pagination and direct POST after 129 accepted credits |
| Native semantic and qualifier privacy fixtures | 2,534 and 228 assertions passed | Includes current versus historical relation scope and qualifier-only facts |
| Grouping API fixture | 332 assertions passed | Classes, independently named orders, exact relations, history, cursor scope and hidden-entry pagination |
| Source update regressions | Open Library intake/review; VNDB VN/release API and dump updates; Bangumi existing update callbacks; MusicBrainz source/supporting updates passed | Selected fixtures and supported callbacks; not every declaration or dump family |
| Music history and structure | Metadata restore, immutable history, TOCs, incomplete candidates, child CAS and reorder compensation passed | Current native commands on a disposable database |
| Platform installation | Fresh installation and factory-bundle check passed with real isolated RustFS storage | Initial credentials suppressed; no external account or deployment was changed |
| Official Rule Realm and native content pack | Owning seed and native pack checks passed | The Rule writer now records the actual private operator separately from its public organization author |

After those checks, four whitespace-only lines in canonical SQL were cleaned and
the baseline was regenerated through the official generator. The strict canonical
checker detects that function-body byte difference against the earlier database.
A final replay of the exact committed baseline into the empty, extension-provisioned
`rezics_atlas_native_diffdev_20260908` target did **not** complete: after 11,968 SQL
statements, the PostgreSQL backend received `SIGILL` while Atlas was writing its
migration receipt. PostgreSQL terminated the other sessions and recovered. A
subsequent read found no application tables and no migration receipts, consistent
with rollback of the file transaction. The crash cause is unqualified; it must not
be attributed to SQL semantics, JIT, hardware or an extension without evidence.
Final-byte replay and canonical verification remain open. No further replay or
database reset was attempted after this failure at convergence.

The real MusicBrainz Bach 333 capture used release
`d996abaa-ce14-45c7-944a-9c62adee19fe`: **223 media, 5,532 track occurrences and
5,587 distinct prepared dependencies**. The four stored parts total 17,958,770
bytes. The raw tracks profile is 7,895,936 bytes; the derived native view is
7,593,521 bytes. Every part and the manifest were checked against their recorded
SHA-256 values.

The existing job was resumed through its actual task intents. No release root
was exposed during dependency preparation. A 128-dependency transaction exceeded
the 25-second deadline, so source-job preparation was reduced to 64 items. Final
publication initially exceeded the same deadline while repeatedly reading child
heads through a large OR predicate. Parameterized exact-key lookups removed that
cost. The subsequent atomic publication committed in **20.602 seconds**, with
one root, the expected media/tracks, current source binding and all four evidence
parts retained. The deadline was not raised. This proves that captured example;
it is not a general p95/p99, object-store-throughput or worst-case guarantee.
The job fixture used an in-memory archive adapter reconstructed from the captured
bytes. Real RustFS qualification above concerns platform installation storage.

## Remaining work

| Gap | Current boundary | Required closure |
| --- | --- | --- |
| **Bangumi fixed profiles and elected wiki semantics** | Names, descriptions, episode structures and existing archive relation callbacks are implemented. Complete gender/blood vocabulary, person lifecycle, fictional birthday, additional dates and elected infobox facts are not integrated and SQL-qualified. | Use reviewed native meanings; keep fictional birthday distinct from Entity existence lifecycle. Verify exact support, repeated apply/withdraw/reapply and preservation of unrelated human edits. Unknown or ambiguous wiki labels must remain explicit unresolved evidence. Generic JSON nodes do not establish semantic mapping. |
| **Source classification and effective NSFW updates** | Initial source classification/rating handling does not establish reversible ongoing access-rating updates. A source NSFW fact alone does not change effective `contentRating`. | Add a generic per-field source journal and revision fence, including detection of same-value human override. Test source changes, withdrawal, reapplication and human precedence before enabling automatic rating changes. This generic journal was explicitly deferred. |
| **Bangumi remaining API relations and grain refinement** | Existing nine-family archive execution is not proof of every API-only relationship, index/member update or music/publishing classification. | Complete the elected callbacks and their compensation, with reviewed owner/shape decisions and private endpoint tests. |
| **VNDB dump assembly** | Selected VN/release/supporting dump joins work. `tags_vn` aggregation and the complete `wikidata` table assembly remain open. External-link URL formatting is not the Wikidata dump join. | Implement bounded streaming/partitioned assembly and exact source-qualified output. Do not import source user votes as REZICS votes. Treat image moderation dispersion and provider scheduling/statistical fields according to explicit dispositions. |
| **VNDB aggregate reads and source-surface transitions** | Native releases contain language, platform, developer and date inputs. Dedicated VN-level aggregate completeness and API↔dump combined projection are not qualified. Narrower observations currently fail safely rather than erase unobserved values. | Supply bounded aggregate queries and a reviewed combined projection; prove source-surface changes, missing data, independent edits and compensation. |
| **MusicBrainz secondary SQL families** | Physical releases and the implemented WS/2 families work. Alternative tracklists and incomplete candidates have initial/native read capabilities without complete source update/withdraw callbacks. Some medium merge/split and dump-only fields, including FreeDB inputs, need further work. | Complete joined dump acquisition and source callbacks with stable correspondence, exact child revisions, repeated compensation and explicit overflow handling. Preserve shared recordings and printed occurrence credits. |
| **Source redirects** | `musicbrainz-redirects.ts` validates/plans joined redirect rows. The shared persisted redirect writer and complete query/runtime integration are absent. | Persist checked source edges and immutable evidence, bound chain/cycle handling and expose current resolution. A provider redirect must not silently merge native identities, move journal entries or replace a reviewed binding. |
| **Cover Art Archive and Event Art Archive** | These are distinct sources; their contract/adoption/query paths are not implemented. Native user-authored editorial images are not a substitute for those adapters. | Elect the source scope explicitly, implement typed resource associations and variants, and verify acquisition, source rights/provenance, updates and withdrawal. Do not count this as a missing WS/2 `release.title` field or as already delivered artwork ingestion. |
| **Book-specific conformance beyond Open Library types** | Work, text version, publication, serialization and their native APIs are present. The Open Library type inventory does not qualify every required translation/serialization scenario. | Add source-free and cross-source fixtures for the elected cases, with versioned contribution, coverage, language and installment semantics. |
| **Complete semantic export and coverage ledger** | Native JSON readers and archived-source export exist. A complete, reproducible native semantic export and its five-role evidence chain are not qualified. `coverage.json` still has 22 reviewed dispositions: 15 native entries, 3 source-only entries and 4 exclusions. | Review the remaining 8,390 of 8,412 declarations, separating wrappers, repeated vocabularies, provider statistics and private data from native facts. Pin schema/write/query/export/fixture evidence to current code. Several old “no implementation” descriptions are stale; do not convert them to qualified merely by counting files or declarations. |
| **Ordinary large source applications** | Ordinary journals remain bounded to 128 changes; the larger staged path is specific to supported Music release work. | Introduce and qualify a staged protocol for other genuinely large owners before raising their admission bounds. Preserve rollback, replay, fencing and compensation semantics. |
| **Personal Entity address workflow** | Public resolution and privileged address control remain. The former first-party Profile slug assignment route was retired; an ordinary controller-facing Entity replacement is not completed. | Implement the native authority/namespace flow and UI, then verify canonical address, redirect, collision and API-token restrictions. Do not restore the old Profile route as a compatibility alias. |

## Remaining integration and activation gates

1. **Private merge review and full reconciliation.** Native read/edit separation,
   human-only review, freeze and current binding handling are implemented. The
   complete real merge fixture did not finish at convergence: current private
   read authority still rejected a later manifest path. Earlier interrupted runs
   also left admitted jobs, so queue isolation matters. Reproduce with explicit
   request/grant identities, qualify both reviewers' access and all reconciliation
   choices, and verify restart/revocation behavior before production activation.
   Do not infer completion from the merge UI or passing TypeScript.
2. **Recommendation build recovery qualification.** The real fixture exercised
   partitioned writes, rollback/fencing and initial activation, but did not finish
   its second snapshot. Its assumption that every partition finishes in one call
   was corrected to allow bounded repeated batches; its inherited-trigger cleanup
   order was corrected as well. Complete the full fresh-run/recovery proof,
   including the previous active snapshot and terminal activation, before claiming
   this gate passed.
3. **Production load, recovery and retention.** The 500-million-row baseline and
   3-billion-row estimates remain design inputs, not measured certification.
   Qualify representative skew, p95/p99, WAL, memory, network, queue occupancy,
   retention, restored databases and replay frontiers. The smaller Music prepare
   page increases the conservative two-epoch archive reread ceiling to about
   8.26 GB per admitted maximum-sized update; account for that cost explicitly.
4. **Rendered product acceptance.** No AI browser or screenshot QA was performed.
   Human acceptance still needs the real reader, editing/history, source-review,
   grouping, progress, attribution, keyboard and error-recovery paths.

These gates are retained as open work, not bypassed by compatibility adapters,
relaxed constraints, default grants or weakened CI.

## Integration and retained research

A read-only audit covered all 23 local task branches and four auxiliary
worktrees. It found no unique unpublished product implementation outside the
current Main work. Meaningful changes were already integrated through focused
commits or reviewed patches; several branch heads differ by dependency snapshots,
amended integration or line endings. The old `acdf5a5c5` participation draft is
superseded by the native participation/Web implementation and must not be restored.
The three untracked VNDB measurement modules were integrated into Main. Incidental
worktree formatting and copied SDK baselines are not additional implementations.

The unfinished Bangumi attempt is retained solely as an
[unapplied research patch (gzip)](operational-refactor-20260908/bangumi-fixed-facts.unapplied.patch.gz).
It is not runtime code and is not acceptance evidence. Thirteen pure tests passed
before its final fixture edits; the complete draft has no final TypeScript/SQL
qualification. Any future use must be reviewed against current source semantics
and the missing NSFW journal. Its decompressed SHA-256 is
`6864ff1f60409f37705f5488536e091f9344562c44de21cf0b094c9603b2ef30`.

All database verification used named isolated loopback targets on port 25435;
the development database on 15432 was not reset. During storage setup, a first
short-lived test container inherited Compose's fixed `rezics-rustfs-data` volume
name. It was stopped and removed before S3 requests were issued; the original
volume was not deleted. Startup-level metadata changes were not independently
audited. Subsequent installation used a separately named, verified test volume.

Continuation entry points: the [native catalog module](../../services/main/src/services/catalog/README.md),
[Music job contract](../../services/main/src/services/catalog/music-release-jobs.md),
[editorial capacity contract](../architecture/catalog-editorial-capacity.md), and
the [source-complete milestone](../plan/operational-refactor-20260906/00-source-complete-schema.md).
