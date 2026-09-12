# Native Studio workspace

Catalog creation has its own `catalog_creator_since` candidate source. It is
neither a platform ownership row nor proof of current edit authority. The eight
catalog identity tables maintain it after creation, creator change, retirement
and restoration through `zz_studio_catalog_creator_candidate`. Its trigger runs
after owner routing publication. Existing platform ownership/direct-grant and
Realm delegation sources retain their independent authority models.

The `created` filter selects native entries entered by the current account.
`owned` continues to mean actual platform ownership. A selected catalog-edit
Participation grant contributes one exact, currently selected target to `direct`
or `all`; unselected grants are never activated by listing. Native rows require
both current read access and a fresh `catalogAccessDecisions(..., true)` result.
They are presented as `catalog_creator` or `catalog_grant`, never as `owner`.
The public DTO exposes `resourceOwner`, `resourceShape`, and nullable BCP 47 name
language; no fabricated localization, creator account ID or routing field leaves
the response.

Request work is bounded by 4,096 consumed candidate rows, batches of at most 256,
at most 128 native permission decisions per batch, and at most 100 returned
resources. Source, section, status, visibility and permission rejection advance
the consumed cursor. Expired assignment projections are also consumed instead
of being skipped before a scan limit. The selected native grant is an exact PK
lookup. Names are hydrated only for authorized bounded rows.

Realm userset discovery has a separate 256 source-candidate control budget. Each
input stream stops at 257; overflow fails explicitly rather than treating the
clipped userset as complete. Multiple or expired raw assignment candidates can
consume that budget and require authority cleanup. Only concrete Realm-target
ownership/grants enter the stream, using three partial indexes. At most 257
membership sources each seek 257 delegated Realm targets before the final
257-candidate cap; this is a fixed control bound, not a corpus scan or a promise
of low latency for its worst skew. Raising these limits requires qualification.

The existing Studio candidate table and Auth/recent indexes remain the listing
owner. At 500 million native creator entries, an illustrative 128-byte row plus
four 48-byte index entries is about 160 GB before PostgreSQL page slack, replicas,
WAL and backups; at 3 billion entries it is about 960 GB. These estimates are
planning assumptions, not measurements. One creator source adds one row and its
PK, Auth/recent, reverse-resource and unique-creator index entries. It creates no
per-Realm-member or per-resource-consumer fan-out. The extra three access indexes
cover only concrete Realm control assignments, not all catalog rows.

`repair_studio_catalog_creator_candidates(owner, after_id, batch_limit)` repairs
one owner-local PK page of at most 512 rows. The TypeScript maintenance entry
`repairStudioCatalogCreatorProjection` commits one such page and returns the next
cursor. Operators persist the owner and cursor between calls; a full rebuild is
an explicit maintenance process, never request-path work. Rebuilding 500 million
entries needs at least 976,563 maximum-size pages; 3 billion needs 5,859,375 pages.
Identity-trigger writes and refreshes serialize per resource; current authority
is always checked at read time even if a projection is stale. The SQL resides in
the existing `participation-studio.sql` manifest entry.

Fresh baseline replay, actual HTTP/SQL fixtures, representative EXPLAIN plans,
hot-account latency, WAL throughput and deployment storage remain the integrated
qualification gates. The calculations above do not replace those measurements.

The trigger ordering and transactional rollback assumptions follow PostgreSQL's
[trigger behavior](https://www.postgresql.org/docs/current/trigger-definition.html).
Selective leading keys follow its
[multicolumn index rules](https://www.postgresql.org/docs/current/indexes-multicolumn.html).

## Private visit authority

`recordStudioVisit` records one account's latest visit to one currently readable
resource. The command validates the human account, active Self binding and its
authorization revision inside the write transaction. Selecting an organization
never transfers ownership of this private state. Suspended/closed accounts and
active bans/suspensions cannot write; silence still permits private visits.

Lock order is the Auth row, Self binding, shared target-access fence, native
target row and visit row. The target must remain readable, and a merged source
cannot receive a new visit. Read authority and account write enforcement are
checked again after the upsert, because grants can expire and scheduled account
restrictions can start during a row wait. Rejection rolls back the visit.
The database completion clock advances the timestamp monotonically; delayed
requests and a backward clock adjustment cannot replace a later stored value.

A visit is private presentation metadata, never an editor assignment or evidence
of target ownership. Listing still obtains candidates and ordering from its
existing sources, independently checks current access and joins only the current
account's visit. Each visit command addresses one resource and one account/target
key; it creates no history row or per-reader fan-out. Repeated writes contend on
that exact private key. Auth and target shared locks also serialize the command
with authority changes; this point-operation qualification does not establish
hot-account throughput or the integrated capacity gates above.

## Canonical visit storage and workload

Visits store `(auth_user_id, target_reference_id, last_visited_at)`. The target is
one restrictive `reference_value` FK, allocated only after current authority is
established. The command returns the native ID it validated. Listing finds the
existing REF with the canonical native-ID expression index and seeks the
compound account/REF index; missing visits remain null and never allocate references.
The source cursor and editor-candidate projections keep their existing ownership.
Merge canonicalization retains the original private REF; new visits to a merged
source are rejected. Erasure removes account visits through the Auth-leading key
without deleting shared references or another account's metadata.

Budget the account/target relation independently of catalog cardinality. A visit
is one latest-state row per distinct pair; frequent revisits rewrite that row.
Reserve 96 bytes of heap and 160 bytes across the PK, Auth/recent and reverse-REF
indexes (48 + 64 + 48): 128 GB at 500,000,000 visit pairs and 768 GB at
3,000,000,000, before WAL, replicas, backups, bloat and page slack. If 10% of pairs
introduce previously unreferenced native targets, the shared 328-byte REF allowance
adds 16.4 GB/98.4 GB, producing a standalone 144.4 GB/866.4 GB attribution. References
already allocated by Following, Favorites or other consumers must not be counted
again. The independent shared-REF planning envelope remains 164 GB/984 GB for
500M/3B mappings; the 10% attribution is an explicit workload assumption.

One new visit writes one heap tuple and three visit index entries, plus allocation
when required. A timestamp update changes an indexed field, so HOT updates cannot
be assumed; reserve new entries in all three indexes and vacuum the old versions.
Repeated visits from different accounts share read locks and the immutable REF;
only the same account/target pair contends on the visit write. Hot accounts also
concentrate Auth/recent index pages. Client concurrency and request quotas provide
admission control; statement timeouts bound individual lock waits. Do not retry
denied writes as throughput backpressure. Qualify p95/p99 write/lookup latency,
wait time, WAL rate, dead tuples, index growth and vacuum lag under representative
revisit skew before claiming capacity acceptance.

The executable fixture uses 10,000 visit pairs for natural point, reverse and
recent-keyset EXPLAIN plans, with fixed-width responses and no corpus-sized
request memory. It is not a sustained-load result. At deployment growth thresholds,
Auth-key hash partitioning/sharding can colocate private visits and erasure; the
reference-leading reverse maintenance path then needs bounded partition fan-out
or its own routing index. Preserve cross-shard REF existence enforcement and
account/target uniqueness in that design. A deployment-specific threshold and
partition qualification remain part of M09's integrated capacity work.

The `created` query specializes candidate eligibility to native catalog creation.
It omits generic ownership/direct/Realm permission expressions, which cannot
admit a creator candidate; bounded current native read/edit decisions still run
before presentation. This avoids compiling unused generic permission branches
for every creator page. Other source filters and mixed-source workloads retain
their separate capacity qualification.
