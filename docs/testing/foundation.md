# Foundation persistence qualification

The [plan](../plan/README.md) owns module progress. These fixtures qualify individual foundation contracts on a fresh disposable PostgreSQL target; they do not establish all of M01 or the backend acceptance gate.

## Disposable domain fixture workflow

The [service Taskfile](../../services/main/Taskfile.yml) can retain a fresh installed target for several domain fixtures. With the default migration port:

~~~sh
task services-main:db:fixture:prepare
DATABASE_ADMIN_URL='postgres://postgres:postgres@localhost:5433/rezics_atlas?sslmode=disable' task services-main:db:participation:check
task services-main:db:fixture:stop
~~~

Use the configured `POSTGRES_MIGRATION_LOCAL_PORT` if it differs from 5433. Preparation resets only the Compose `postgres-migration-test` service, validates/replays the preserved baseline and forward migrations, and leaves the database running. It does not qualify domain behavior by itself. This is the same exclusive lane used by migration generation and `db:check`; finish active domain fixtures before resetting it. The application development database is separate. The full `db:check` remains required for changed migrations/canonical SQL and schema-drift verification.

## Canonical reference values

The executable owner is [check-reference-values.ts](../../services/main/scripts/check-reference-values.ts). `task services-main:db:check` installs the preserved baseline plus forward migrations, runs the reference fixture with the other integrity fixtures and checks canonical SQL and Drizzle drift. To repeat just this fixture against an already installed, isolated `rezics_atlas` database, provide its `DATABASE_ADMIN_URL` and run `task services-main:db:references:check`. The script rejects the development port and non-disposable database names. Its rows are disposable; the full replay task removes the container afterwards.

| Case | Assertion |
| --- | --- |
| Independent identity | An owner can exist and be deleted without allocating a reference value. |
| Valid allocation | Allocate/reuse the same value and decode the exact owner/id; unknown value returns null. |
| Invalid targets | Zero or multiple alternatives fail CHECK; every registered missing owner target fails its concrete FK. |
| Uniqueness and immutability | Duplicate target fails; retarget, rekey and delete fail; referenced owner deletion fails. |
| Lifecycle and routing | Visibility edits preserve identity; temporary locator absence does not alter concrete reference resolution. |
| Concurrent allocation | A second connection demonstrably blocks on the first; commit reuses the winner and rollback allows a new value. |
| Stronger isolation | Repeatable read loses with SQLSTATE 40001; a fresh transaction reuses the winner. |
| Delete/admit race | A deletion that holds the concrete owner lock wins; allocation rejects instead of creating a dangling target. |
| Native identity collision | Two owners cannot concurrently admit the same native UUID. |
| Selective queries | Unforced EXPLAIN ANALYZE chooses target uniqueness and value primary-key indexes. |

The SQL projection also resolves a value inserted by its calling data-modifying CTE. Native-ID lookup and candidate-join predicates use the derived native-ID expression index.

Schema tests separately require one restrictive concrete FK and one partial unique index for every registered owner. No bridge FK targets the routing projection. Internal allocation/resolution is not an authorization API: consumer disclosure, revocation, exact revisions and occurrences require their own executable qualification.

Rejected parent deletion asserts `23001` (`restrict_violation`); insertion against a missing target asserts `23503` (`foreign_key_violation`). These are distinct [PostgreSQL error identities](https://www.postgresql.org/docs/18/errcodes-appendix.html), not interchangeable expected results.

## Workload and evidence

The fixture adds 10,000 reference-owner identities derived from MD5 of `reference-value-20260911:` plus integers 1 through 10,000, with UUIDv8 version/variant bits set, and their canonical values. It emits the base Git commit, SHA-256 digests of the actual fixture/allocator/schema/registry/migration-checksum inputs, Node/platform/PostgreSQL settings, EXPLAIN ANALYZE/BUFFERS JSON and measured tuple, heap and index bytes. Source digests identify pre-commit changes rather than implying the base commit includes them. Retain this command output when using the run as acceptance evidence.

The [pinned qualification run](database/reference-values-evidence.json) passed the full fresh database check on PostgreSQL 18.6/Linux, including canonical SQL and schema drift. Its 10,013 identity values averaged 64 tuple bytes, with 712,704 heap bytes and 1,490,944 index bytes in the fresh sample. Both identity point lookups used their expected indexes and three shared buffer hits. These observations do not replace the planning envelope below or establish sustained-load acceptance.

The bridge stores a UUID and 20 nullable concrete target alternatives, exactly one populated. Each row enters its primary-key index, one partial target index and the derived native-ID expression index. Allocation performs at most three selective statements; reuse performs one lookup and zero updates. Lookup complexity is logarithmic in the selected index, with fixed owner-alternative decoding and no graph traversal. Unrelated targets do not share a write lock. Admission of a hot target serializes only competing insertions; bounded caller transaction/statement deadlines handle contention.

The [capacity model](../architecture/database/capacity.md) retains the conservative 112-byte heap plus 216-byte index assumption per identity value: 164 GB at 500,000,000 rows and 984 GB at 3,000,000,000 rows, before its provisioning multiplier. Catalog reference density remains 1.2 values/root. The fixture measures a small fresh sample, not sustained throughput, WAL, bloat, vacuum or restore behavior at either planning scale. Keep the unpartitioned per-target uniqueness contract and the measured-maintenance activation gate in the [architecture](../architecture/database/README.md#32-generic-references-without-a-universal-entity-parent); hash partitioning by value UUID would lose target uniqueness.

## Exact catalog revision values

[check-revision-references.ts](../../services/main/scripts/check-revision-references.ts) runs inside the same disposable fixture and driver connections. It admits named-form and identifier-claim histories for all eight catalog owners, with their complete owner/item/revision keys. The snapshot guards of those histories establish completion before reference admission; Document, asset, association and occurrence families still need their owning contracts and tests.

Cases cover all six incomplete subsets of a composite key, scattered alternatives, multiple complete alternatives, invalid revision ranges, missing/mismatched targets, duplicate exact values, retarget/rekey/delete rejection, item UUID reuse under two parents, retained old revisions after head updates, competing commit/rollback allocations and repeatable-read failure followed by a fresh transaction retry. Exact references can exist without an identity-bridge row; the parent is part of the concrete revision key, not an independently writable cached REF.

The bounded sample adds 10,000 named-form histories under one owner with UUIDv8 keys derived from `revision-reference-20260911:` and sequence numbers, then their exact values. This tests a hot parent with many child keys. The target lookup must choose the complete tuple's partial unique index without forcing planner settings. The existing 112-byte heap/144-byte index planning assumption covers one selected tuple, primary key and null bitmap for the 16 alternatives; retain the independent 500M/3B envelope and the modeled three exact references per catalog root. Record measured widths, index bytes and plans before accepting that estimate for a wider registry. Reads decode one fixed-width reference row, never its potentially large name/identifier payload; consumer batches and disclosure remain separate qualification.

The pinned run's 10,022 exact values averaged 88 tuple bytes, with 966,656 heap bytes and 1,294,336 index bytes. The complete tuple lookup used `revision_reference_reference_named_form_key`. This is evidence for the registered metadata families and sample distribution, not a qualification of all future revision families or retained-corpus workload.

## Selected participation control protocols

`task services-main:db:participation:check` runs [check-participation-authority.ts](../../services/main/scripts/check-participation-authority.ts) against an explicitly supplied disposable `DATABASE_ADMIN_URL`. Email stays in log mode. The fixture uses native domain commands and real PostgreSQL transactions, with a memory archive for controlled source payloads. Its committed dummy identities remain in that isolated target until reset; the larger recovery/source scenario rolls back after its assertions.

| Protocol | Executable evidence |
| --- | --- |
| Self admission | Competing connections produce one self identity/binding; a provider display name equal to a private email stays unpublished. |
| Catalog identity intake | Current self contribution authority admits identities; missing/stale context, actor mismatch, erased accounts, resource/proposal grants and service principals are denied. Approved source scope cannot escape through a new transaction to create a different identity. |
| Delegation and revocation | A protected name edit demonstrably blocks conflicting revocation; after revocation the exact old grant is denied. |
| Attribution and control | Cataloging a person creates no private account binding; absent ambient authority produces the expected catalog denial. |
| Presentation history | Restore selects the exact earlier name revision and summary, including the session's selected presentation. |
| Initial closure and recovery | Account closure removes its binding/PII and suspends an organization losing its final controller; recovery requires current platform authority and does not restore the erased account binding. |
| Exact source approval | Human/service grants bind the approved proposal and native target; allowed native savepoints preserve scope, unrelated targets/transactions are denied, and revocation remains effective. |

The [pinned participation run](database/participation-evidence.json) records source and migration digests, runtime settings and the exact command. This qualifies the listed protocols only. Remaining membership/ownership transitions, generic resource ACL and disclosure fences, full private-data/asset erasure workers and restoration frontiers remain separate work. The catalog resource API fixture separately checks eager route compilation and stateful ordinary/scoped resource behavior; it does not qualify all M01 APIs.

## Favorites reference consumer and private lifecycle

`task services-main:db:private-lifecycle:check` runs
[check-private-account-lifecycle.ts](../../services/main/scripts/check-private-account-lifecycle.ts)
against an explicitly supplied disposable `DATABASE_ADMIN_URL`. The full `db:check`
also runs it after reference qualification. Current entries and private history
reference one immutable value; API targets remain native owner/ID pairs.

| Case | Assertion |
| --- | --- |
| Consumer integrity | Both tables have exactly one target REF FK, no independent native columns, and no duplicate target in history JSON. Missing values, invalid null/delete snapshots, retargeting and premature history deletion fail. |
| Private disclosure | New saves for inaccessible/missing objects share the not-found result and allocate nothing. Saved content stays private to its account; later visibility changes deny refresh and another account's save. |
| Canonical reuse | Two accounts share the same target REF while retaining independent notes and history. Read/list/history do not depend on the locator projection. |
| Concurrent commands | The stale save demonstrably blocks on the winning transaction and then fails CAS; direct grant revocation waits for preview capture; a capture waiting behind a restriction rechecks and is denied. Account closure waits for an admitted save, and closed accounts cannot append another revision. |
| Restoration and erasure | Stored note, preview and order survive restore. Bounded erasure drains multiple history and archive pages, preserves another account and public follows, and retains the shared REF. |
| Bounded reads | Native-ID resolution uses the derived expression index. A 2,000-entry hot-account fixture requires the ordered page query to use the account-position and reference primary-key indexes, without sequential scans. |

The concurrency fixture commits dummy accounts/posts only in the disposable target.
The private lifecycle and query samples roll back. The image archive is an in-memory
implementation with 502 versions/keys; it proves bounded application behavior, not
object-provider or recovery-frontier acceptance. The command emits source/migration
digests, runtime settings, assertion totals, race outcomes and query plans/footprint.
The query sample derives UUIDv8 targets from its generated account ID and integers
1–2,000; each entry contains 200 title, 700 summary and 100 note bytes before JSON
and row overhead. Whole-table heap/index bytes can include other fixture entries.
The [pinned run](database/favorites-evidence.json) records 49 lifecycle assertions and four observed races. Its 2,000-entry sample averaged 1,200 tuple bytes; whole-table heap/index allocation was 2,777,088/344,064 bytes. The 31-row page used 101 shared buffer hits and the two required indexes.

Retain the [private workload estimates](../../services/main/src/services/participation/README.md#private-workload-estimates-and-remaining-qualification)
at both 500M and 3B rows; these samples do not qualify sustained load or restoration.

## Current authorization expiry

`task services-main:db:access-expiry:check` runs
[check-access-expiry.ts](../../services/main/scripts/check-access-expiry.ts); `db:check`
also includes it. Direct resource grants, resource restrictions and platform
capabilities are checked before and after their stored expiry inside the same
open transaction. The fixture waits for the database clock and checks both the
transaction-bound authorization decision and the actual preview reader. Expired
grants deny access; expired restrictions stop denying an otherwise public object.

A separate two-connection case holds a platform grant row without changing it,
observes the authorization query blocked on that exact transaction, waits past
expiry, and releases it. The authorization must reject the expired candidate.
The regressions were observed both with transaction-start expiry and with the
post-lock platform recheck omitted; the corrected paths pass 11 assertions in the [pinned run](database/access-expiry-evidence.json).

Transaction cases roll back; the row-lock case commits only dummy fixture
identities/grants in the disposable target. Output records runtime settings and
source/migration digests. These cases qualify time evaluation for the named
paths, not every ancestor-authority fence, API, erasure frontier or restored
snapshot. The [authorization owner](../../services/main/src/services/authorization/README.md)
describes the current-check protocol and bounded additional query cost.

## Private Tag reference consumer

`task services-main:db:account-tags:check` runs
[check-account-tag-references.ts](../../services/main/scripts/check-account-tag-references.ts),
also included in `db:check`. It allocates references for all eight catalog owners,
then exercises the actual private Tag filter and candidate compiler. The fixture
checks native-ID results, account isolation, anonymous behavior, rejected account
selection in Filter input, duplicate/missing references, self-tagging on insert
and update, category-only/content-label rejection, and closure/erasure without
removing another account's relation or the shared reference.

A separate 10,000-row hot-account sample requires the point predicate and a
native-ID condition pushed through the candidate projection to use
`reference_value_native_id_idx` and a private Tag key. Sample UUIDv8 values derive
from the generated account ID and sequence 1–10,000. Queries remain SQL sets;
only bounded results and EXPLAIN/BUFFERS output reach the process. All rows roll
back. A savepoint temporarily drops the projection index for a bounded comparison, records the resulting plan, then restores it by rollback. Source/migration digests and runtime settings accompany the query evidence.

The [Filter owner](../../services/main/src/services/filter/README.md) records the
120-byte heap/240-byte index estimate for private Tag rows, the independent
500M/3B envelope, amplification assumptions and workload targets. This qualifies
reference storage and the named query paths, not all Tag assertion history,
source conformance, feed ranking or corpus-scale throughput.

The [pinned private Tag run](database/account-tags-evidence.json) passed 30 assertions.
Its 10,000-row sample averaged 104 tuple bytes, with 1,130,496 heap bytes and
1,990,656 index bytes for the private relation. The indexed candidate query used
seven shared buffers. Without the projection index, the same query used 302 and
scanned the private Tag and reference tables; the earlier reference fixture adds
to the reference-table sample in this full run. These are small warm-cache query
observations, not throughput claims at either capacity baseline.

## Scoped resource reads

`task services-main:db:read-scopes:check` runs
[check-unit-read-scopes.ts](../../services/main/scripts/check-unit-read-scopes.ts).
The regression originally admitted a root read from a descendant-only grant,
while the root list predicate denied it. The fixture now covers 16 decisions:
root/ancestor/sibling denial, matching descendants, narrower restrictions,
authenticated audiences, anonymous denial, and explicit root/ownership authority.
The [pinned run](database/read-scopes-evidence.json) uses real PostgreSQL and rolls back its rows. Schema/migration changes are not
required for this policy correction.

[The resource API fixture](../../services/main/scripts/check-catalog-resource-api.ts)
creates a private Collection, grants a descendant scope through the governance
API, verifies the recipient receives 404 for full Collection detail and a denied
root access decision, then grants root read access and verifies both endpoints
allow it. All requests use the ID produced by Collection creation. The expanded
fixture passes 181 assertions alongside its 16 native catalog resources.

## Private account names in access configuration

The resource API fixture changes a grant recipient's private Auth name while
keeping its public Entity name. The access-management response must use the
public name and must not contain the private label. The pre-fix response exposed
the private Auth value. The fixture also rejects concurrent-query warnings from
a single PostgreSQL client; snapshot reads now await their shared-client queries.
The [pinned API run](database/access-snapshot-evidence.json) passes 184 assertions. These checks cover the access
snapshot's label and transaction behavior, not all private-data disclosure paths.

## Controlled organization membership

`task services-main:db:membership:check` runs
[check-organization-membership.ts](../../services/main/scripts/check-organization-membership.ts)
on the retained disposable native target. It uses signed sessions, actual HTTP
responses and PostgreSQL writes, with two connections for each revocation order.
The blocking probe identifies the exact expected transaction. The [pinned run](database/membership-evidence.json) passes 76 assertions and completes private fixture cleanup.

Cases cover exact membership-manager authority, separation from publishing,
security and catalog editing, no automatic controller enrollment, private inboxes,
public recipient identities, repeated pending invitations, recipient-only consent,
stale revisions, removal/rejoin/leave history, decline/cancel/expiry terminal
states, and both accept-before-revoke and revoke-before-accept outcomes. Accepted
membership adds no control grants. Sender erasure preserves another account's
accepted membership; member erasure removes its private membership/event/invitation
state. No invitation email or message is delivered.

The fixture erases its four dummy accounts' private state at completion and retains
only permitted public/operator records in the disposable database. This qualifies
the tested lifecycle protocols; organization-generation recovery/suspension,
invitation-capacity saturation and 500M/3B load remain separate acceptance cases.
The [membership owner](../../services/main/src/services/participation/organization-membership.md)
retains the 1,000-pending limits, storage estimates and workload assumptions.
