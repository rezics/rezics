# Studio workspace and contribution history

Status: Accepted

Owners: Main Service, History, Authorization, and Web

## Decision

Studio has two user-facing lists, selected explicitly in the Web UI:

- **Your workspace** lists resources the current Profile can edit now through
  current ownership, a direct Profile grant, or a current Realm-subject grant.
- **Your contributions** lists currently public and approved resources that the
  Profile created or edited in the past. Current editor access is irrelevant to
  this list.

These lists do not share a relationship table or a query. Studio owns only the
current editor-candidate read model. History owns participation. Authorization
and the Unit row remain authoritative at read time.

The old `studio_work_relation` table mixed historical activity, authorization
targets, scopes, and presentation grouping. It is removed after its historical
facts are projected into `profile_resource_participation`.

## Data ownership

| Relation | Owner | Grain | Purpose |
| --- | --- | --- | --- |
| `studio_profile_editor_candidate` | Studio / Authorization | Profile + Unit | Seek current ownership and direct `unit.update` candidates. |
| `studio_realm_editor_candidate` | Studio / Authorization | Realm + subject relation + Unit | Seek current Realm-delegated `unit.update` candidates without copying every Realm member. |
| `studio_resource_visit` | Studio | Profile + Unit | Optional presentation activity; it is not access evidence. |
| `profile_resource_participation` | History | Profile + top-level resource Unit | Summarize creation and revision activity independently of current access. |

`profile_resource_participation` deliberately stores no publication,
visibility, moderation, localization, title, cover, or permission state. Those
facts change independently and are evaluated from the current Unit during a
read. No History-owned relation is named `studio_*`.

## Authorization invariants

- A candidate row is a seek index, not an authorization cache.
- Every workspace result is checked against live ownership or a live explicit
  `unit.update` grant, grant expiry, applicable Profile/Realm restrictions, the
  current Realm userset, Unit deletion, and current read access.
- Ownership follows the common Unit policy and remains a recovery boundary
  above ordinary restrictions. The set-based read predicate and the point
  authorization decision use the same ordering.
- Authenticated grants and the platform recovery capability may authorize a
  point operation but never seed a personal workspace. They do not express an
  assignment to that Profile.
- Realm membership is not fanned out into Profile candidate rows. A request
  resolves at most 256 current `member` or `access_manager` subjects and seeks
  each corresponding Realm candidate stream. Realm-source de-duplication joins
  back to that same bounded subject set and probes the candidate reverse index;
  it never scans every Realm assignment attached to a Unit.
- `source=delegated` means “has a current Realm assignment,” even if the same
  Profile also owns the Unit or has a direct grant. `source=all` de-duplicates
  the same Unit in favor of the Profile candidate.

## Participation invariants

- Creating a Unit records `created_resource_at` once. Later Unit, Content
  Structure, Collection Structure, and Dock revisions increment contribution
  facts.
- A content Unit inside a current Book Content Structure contributes to its
  top-level Book resource. Other edits contribute to their exact resource.
- One revision transaction performs one multi-row UPSERT. The current Book
  resource fan-out is capped at 32 and exceeding it fails explicitly; ordinary
  data has a fan-out of one. A maintenance rebuild performs a fan-out preflight
  before replacing the projection.
- Unit merges combine participation with `min` creation/first-contribution,
  `max` last-contribution/participation, and summed contribution counts. Studio
  candidates for the merged source are discarded because authoritative access
  rows recreate the target candidates through their triggers.
- Only a Unit that is currently `published`, `public`, approved, and not
  deleted can appear under Your contributions.

## Write paths

Ownership and access-grant triggers refresh only the affected candidate key.
They aggregate multiple active scopes for that key so a scope mutation does not
produce duplicate list rows. A future-expiring candidate carries
`valid_until`; a worker deletes expired rows through partial expiry indexes in
bounded, lock-skipping batches. Revocation and grant changes refresh the row
immediately.

History writes update only the affected `(profile_id, resource_unit_id)` keys
inside the source revision transaction. There is no request-path table lock,
global advisory lock, queue without backpressure, or recurring full-corpus
recomputation. Full rebuild commands are maintenance-only recovery tools:

```text
task services-main:studio:rebuild
task services-main:participation:rebuild
```

The participation rebuild first takes `NOWAIT SHARE` locks on all five source
ledgers, then locks and replaces the projection. This prevents an event from
being included in the rebuild and incremented again by a previously blocked
writer. Pause API and worker writers before invoking it; if any source writer is
already active, the command fails immediately rather than accepting an
ambiguous snapshot.

## Read paths

Both endpoints use descending keyset pagination and bind the filter scope into
an opaque cursor:

```text
GET /api/v1/users/me/studio
  -> (relevant_at, unit_id, source_key)

GET /api/v1/history/contribution-resources/me
  -> (selected participation timestamp, resource_unit_id)
```

`section` is optional. A section page binds one exact section into its cursor;
the Studio overview omits it and issues exactly two aggregate requests—one per
endpoint—instead of fanning out across all sections. Aggregate rows derive
their response section from the validated Unit kind plus the joined Post kind.
Unsupported Unit/Post kinds are rejected inside the bounded candidate batch.
Zones are excluded unless the current Profile has the development-preview
capability; an explicit Zone query still requires that capability.

The request limit defaults to 30 and is capped at 100. Each database batch is
at most 256 candidates and each request examines at most 4,096 candidates.
Filtering deleted, inaccessible, or no-longer-public rows therefore cannot turn
one request into a full scan. A page that reaches the scan budget returns a
continuation cursor even when it contains fewer requested items.

The overview requests four results per list and groups all creation/navigation
actions in four bounded product groups. Section pages give the two endpoints
independent TanStack Query keys, cursors, and enabled states. Switching the
selector does not reinterpret one response shape as the other. Workspace-only
status and visibility controls are hidden for contributions because public
contribution visibility is an invariant, not a user filter.

## Index-to-query mapping

| Access pattern | Index |
| --- | --- |
| Profile workspace keyset | `studio_profile_editor_candidate_profile_recent_idx (profile_id, relevant_at DESC, unit_id DESC)` |
| Realm-subject workspace keyset | `studio_realm_editor_candidate_subject_recent_idx (realm_id, realm_relation, relevant_at DESC, unit_id DESC)` |
| Candidate removal during Unit merge | Candidate `unit_id` reverse indexes |
| Expired candidate cleanup | Partial candidate `valid_until` indexes |
| All contributions keyset | `profile_resource_participation_profile_recent_idx` |
| Created contributions keyset | Partial `profile_resource_participation_profile_created_idx` |
| Edited contributions keyset | Partial `profile_resource_participation_profile_contributed_idx` |
| Participation combination during Unit merge | `profile_resource_participation_resource_idx (resource_unit_id, profile_id)` |

Live authorization probes use the existing active ownership, Profile grant,
Realm grant, Profile restriction, and Realm restriction indexes by Unit and
subject. Localization and cover resolution are limited to the selected
candidate batch; there is no per-item application round trip. Aggregate reads
add one primary-key Post extension join per scanned candidate so Post, Wiki,
and Review sections can be discriminated without a second query or unbounded
fan-out.

## Capacity plan

### Workload envelope

The design is evaluated independently for 500,000,000 rows in each
corpus-scale projection and estimated at 3,000,000,000 rows. Planning assumes:

- 10,000 revision events/second globally at peak, with median participation
  resource fan-out 1, p99 1, and an enforced maximum of 32;
- 1,000 ownership/access mutations/second globally at peak;
- 2,000 combined workspace/contribution list requests/second globally, 30
  results normally and 100 maximum;
- median two Realm subjects per Profile, p99 32, hard maximum 256;
- 80% of participation rows include edits, 30% include creation, and 20% of
  editor candidates have an expiry timestamp;
- warm-cache p95 target below 200 ms for the normal first 256-candidate batch;
  the 4,096 scan budget is a safety bound, not the normal latency target.

The Realm stream merge examines at most `subjects × batch size` index entries
per database batch: 512 at the median, 8,192 at p99, and 65,536 at the hard
subject cap. Profiles near the cap are observable skew cases. If their p95
exceeds the target, reduce the accepted subject bound or move Realm stream
merging to the sharded query tier; do not fan out Realm membership on every
grant write.

### Approximate storage

These are capacity estimates, not measured tuple sizes. They include heap,
listed B-tree indexes, partial-index selectivity assumptions above, and 25%
free-space/bloat headroom. Verify production values with `pgstattuple`.

| Relation | Approx. bytes/row including indexes | 500M rows | 3B rows |
| --- | ---: | ---: | ---: |
| `profile_resource_participation` | 410 B | 205 GB | 1.23 TB |
| `studio_profile_editor_candidate` | 350 B | 175 GB | 1.05 TB |
| `studio_realm_editor_candidate` | 360 B | 180 GB | 1.08 TB |

A contribution UPSERT rewrites one heap tuple and normally the recent and
contributed indexes; creation also touches the created partial index. An access
mutation reads the active scopes for one candidate key and writes one candidate
row. The default expiry worker can remove 5,000 rows per relation every 10
seconds: 500 rows/second even if all expiry is concentrated in one candidate
relation, versus the assumed 200 expiring candidates/second. WAL and replicas
must therefore be provisioned for roughly three to five index/heap records per
logical write, plus vacuum traffic. Monitor WAL bytes, replica lag, dead tuples,
expiry backlog, buffer hit ratio, scanned/returned candidate ratio, query
latency by Realm-subject count, and the fan-out-limit exception.

The `(profile_id, resource_unit_id)` participation row is the write hot key. If
one key sustains more than 100 revisions/second or its p95 row-lock wait exceeds
20 ms, switch that key to an idempotent, partitioned event outbox with bounded
consumer batches and a persisted watermark; do not add an unbounded in-memory
queue or serialize all Profiles through a global lock.

At 500M rows, these relations remain index-seekable on one sufficiently sized
PostgreSQL cluster, but storage, vacuum, and replay bandwidth—not query
complexity—become the likely limits. Before any relation approaches 3B rows,
shard participation and Profile candidates by `hash(profile_id)` and Realm
candidates by `hash(realm_id, realm_relation)`. The query tier merges only the
bounded shard responses. Unit-merge reverse-index work becomes an explicit
cross-shard maintenance workflow. Archive is not valid for participation while
the product promises complete lifetime contributions.

## Migration and cutover

Migration `20260811000003_studio_workspace_contributions.sql` is a breaking
persisted-contract cutover:

1. Pause API and worker writes.
2. Create the History projection and the two Studio candidate tables.
3. Install candidate-maintenance triggers before copying access state.
4. Backfill participation from the old compact relation and candidates from
   current ownership/grants.
5. Create the selective indexes and merged-Unit guards.
6. Drop `studio_work_relation`, deploy the API/worker/Web release together, and
   resume traffic.
7. Compare row counts and sampled source facts. The two rebuild commands remain
   the recovery path.

The migration performs full reads of the old projection and active access
ledgers once. At 100,000 copied rows/second, 500M source rows require about 83
minutes before index construction and validation; at 3B they require about 8.3
hours. This cutover is intended to occur now, before those cardinalities. If a
deployment has more than 25M old relation rows or cannot fit the maintenance
window and temporary WAL/disk headroom, do not run the one-step cutover.
Instead use a reviewed multi-release shadow-table rollout: create and dual-write
the new tables, resumably backfill key ranges with checkpoints, verify parity,
switch reads, then drop the old table in a later release.

## Validation gates

The 2026-08-11 local plan-shape check used one million rows in each projection,
a single hot Profile with one million rows, 32 Realm subjects, and 100,000
expired candidates at the head of the Profile stream. PostgreSQL selected:

- `studio_profile_editor_candidate_profile_recent_idx` for the workspace seek;
- `studio_realm_editor_candidate_subject_recent_idx` once per bounded Realm
  stream;
- the recent, created, and contributed participation indexes for their
  corresponding cursor queries; and
- `studio_profile_editor_candidate_expiry_idx` for a 2,000-row lock-skipping
  cleanup batch.

The ordered queries state `DESC NULLS LAST` explicitly. Omitting that clause
does not match the committed descending indexes and produced sequential scans
in this fixture, so it is a tested part of the query contract. The observed
local timings are intentionally not used as 500M-row latency projections.

- Replay the full migration directory and compare Atlas to the Drizzle schema.
- Use representative skewed fixtures to verify that all three keyset queries
  use their corresponding ordered indexes, and that expiry cleanup uses its
  partial indexes.
- Run `EXPLAIN (ANALYZE, BUFFERS, WAL)` for the first and cursor pages, with
  public/inaccessible filtering ratios near production values.
- Reject sequential scans of a corpus-scale projection, deep offset
  pagination, unbounded Realm/profile fan-out, or an application N+1 query.
- Load-test normal and p99 Realm-subject counts separately. Toy-fixture latency
  is evidence for plan shape only and must not be extrapolated to 500M rows.
