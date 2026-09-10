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

Schema tests separately require one restrictive concrete FK and one partial unique index for every registered owner. No bridge FK targets the routing projection. Internal allocation/resolution is not an authorization API: consumer disclosure, revocation, exact revisions and occurrences require their own executable qualification.

Rejected parent deletion asserts `23001` (`restrict_violation`); insertion against a missing target asserts `23503` (`foreign_key_violation`). These are distinct [PostgreSQL error identities](https://www.postgresql.org/docs/18/errcodes-appendix.html), not interchangeable expected results.

## Workload and evidence

The fixture adds 10,000 reference-owner identities derived from MD5 of `reference-value-20260911:` plus integers 1 through 10,000, with UUIDv8 version/variant bits set, and their canonical values. It emits the base Git commit, SHA-256 digests of the actual fixture/allocator/schema/registry/migration-checksum inputs, Node/platform/PostgreSQL settings, EXPLAIN ANALYZE/BUFFERS JSON and measured tuple, heap and index bytes. Source digests identify pre-commit changes rather than implying the base commit includes them. Retain this command output when using the run as acceptance evidence.

The [pinned qualification run](database/reference-values-evidence.json) passed the full fresh database check on PostgreSQL 18.6/Linux, including canonical SQL and schema drift. Its 10,012 identity values averaged 64 tuple bytes, with 712,704 heap bytes and 1,089,536 index bytes in the fresh sample. Both identity point lookups used their expected indexes and three shared buffer hits. These observations do not replace the planning envelope below or establish sustained-load acceptance.

The bridge stores a UUID and 20 nullable concrete target alternatives, exactly one populated. Each row enters its primary-key index and one partial target index. Allocation performs at most three selective statements; reuse performs one lookup and zero updates. Lookup complexity is logarithmic in the selected index, with fixed owner-alternative decoding and no graph traversal. Unrelated targets do not share a write lock. Admission of a hot target serializes only competing insertions; bounded caller transaction/statement deadlines handle contention.

The [capacity model](../architecture/database/capacity.md) retains the conservative 112-byte heap plus 144-byte index assumption per value: 128 GB at 500,000,000 rows and 768 GB at 3,000,000,000 rows, before its provisioning multiplier. Catalog reference density remains 1.2 values/root. The fixture measures a small fresh sample, not sustained throughput, WAL, bloat, vacuum or restore behavior at either planning scale. Keep the unpartitioned per-target uniqueness contract and the measured-maintenance activation gate in the [architecture](../architecture/database/README.md#32-generic-references-without-a-universal-entity-parent); hash partitioning by value UUID would lose target uniqueness.

## Exact catalog revision values

[check-revision-references.ts](../../services/main/scripts/check-revision-references.ts) runs inside the same disposable fixture and driver connections. It admits named-form and identifier-claim histories for all eight catalog owners, with their complete owner/item/revision keys. The snapshot guards of those histories establish completion before reference admission; Document, asset, association and occurrence families still need their owning contracts and tests.

Cases cover all six incomplete subsets of a composite key, scattered alternatives, multiple complete alternatives, invalid revision ranges, missing/mismatched targets, duplicate exact values, retarget/rekey/delete rejection, item UUID reuse under two parents, retained old revisions after head updates, competing commit/rollback allocations and repeatable-read failure followed by a fresh transaction retry. Exact references can exist without an identity-bridge row; the parent is part of the concrete revision key, not an independently writable cached REF.

The bounded sample adds 10,000 named-form histories under one owner with UUIDv8 keys derived from `revision-reference-20260911:` and sequence numbers, then their exact values. This tests a hot parent with many child keys. The target lookup must choose the complete tuple's partial unique index without forcing planner settings. The existing 112-byte heap/144-byte index planning assumption covers one selected tuple, primary key and null bitmap for the 16 alternatives; retain the independent 500M/3B envelope and the modeled three exact references per catalog root. Record measured widths, index bytes and plans before accepting that estimate for a wider registry. Reads decode one fixed-width reference row, never its potentially large name/identifier payload; consumer batches and disclosure remain separate qualification.

The pinned run's 10,022 exact values averaged 88 tuple bytes, with 966,656 heap bytes and 1,351,680 index bytes. The complete tuple lookup used `revision_reference_reference_named_form_key`. This is evidence for the registered metadata families and sample distribution, not a qualification of all future revision families or retained-corpus workload.

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
