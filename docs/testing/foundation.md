# Foundation persistence qualification

The [plan](../plan/README.md) owns module progress. These fixtures qualify individual foundation contracts on a fresh disposable PostgreSQL target; they do not establish all of M01 or the backend acceptance gate.

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

The fixture adds 10,000 reference-owner identities derived from MD5 of `reference-value-20260911:` plus integers 1 through 10,000, and their canonical values. It emits the base Git commit, SHA-256 digests of the actual fixture/allocator/schema/registry/migration-checksum inputs, Node/platform/PostgreSQL settings, EXPLAIN ANALYZE/BUFFERS JSON and measured tuple, heap and index bytes. Source digests identify pre-commit changes rather than implying the base commit includes them. Retain this command output when using the run as acceptance evidence.

The [pinned qualification run](database/reference-values-evidence.json) passed the full fresh database check on PostgreSQL 18.6/Linux, including canonical SQL and schema drift. Its 10,012 values averaged 64 tuple bytes, with 712,704 heap bytes and 1,081,344 index bytes in the fresh sample. Both point lookups used their expected indexes and three shared buffer hits. These observations do not replace the planning envelope below or establish sustained-load acceptance.

The bridge stores a UUID and 20 nullable concrete target alternatives, exactly one populated. Each row enters its primary-key index and one partial target index. Allocation performs at most three selective statements; reuse performs one lookup and zero updates. Lookup complexity is logarithmic in the selected index, with fixed owner-alternative decoding and no graph traversal. Unrelated targets do not share a write lock. Admission of a hot target serializes only competing insertions; bounded caller transaction/statement deadlines handle contention.

The [capacity model](../architecture/database/capacity.md) retains the conservative 112-byte heap plus 144-byte index assumption per value: 128 GB at 500,000,000 rows and 768 GB at 3,000,000,000 rows, before its provisioning multiplier. Catalog reference density remains 1.2 values/root. The fixture measures a small fresh sample, not sustained throughput, WAL, bloat, vacuum or restore behavior at either planning scale. Keep the unpartitioned per-target uniqueness contract and the measured-maintenance activation gate in the [architecture](../architecture/database/README.md#32-generic-references-without-a-universal-entity-parent); hash partitioning by value UUID would lose target uniqueness.
