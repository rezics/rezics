# Platform bootstrap

Bootstrap owns the reserved identity graph, not live content. The ensure command is safe to
rerun: it inserts missing reserved IDs and writes starter copy only for identities created in
that run. After first write, ordinary product services own mutable fields and online history.
Deployment verify checks only permanent identities through `core.ts`. An occupied database
(application rows with no reserved IDs) is refused. Revoked platform capability grants are
not restored. Existing Units do not receive starter localizations even when they have none.

## Module boundaries

- `data/` contains immutable identities, localized copy, and pure document constructors. It must
  not import the database, storage, or service modules.
- `manifest-validation.ts` proves cross-manifest invariants before a write starts: reserved UUIDs
  are unique and use the bootstrap epoch, and embedded documents satisfy their runtime schemas.
- `installation/` contains side-effecting, transaction-scoped installers grouped by domain.
  `common.ts` owns only shared installation primitives whose invariants are reused by multiple
  domains.
- `readiness-inspection.ts` performs bounded reads of persisted factory state; `readiness.ts`
  compares that typed snapshot with factory constructors. That comparison is a fresh-install
  snapshot check, not an operational deploy gate, and must not turn online product state into
  repository-owned configuration.
- `service.ts` is the public facade and orchestration root. It owns the advisory lock, transaction,
  installation order, and result contract; domain SQL and manifest data do not belong there.

Add factory data to its owning `data/` module, add the corresponding write and read verification to
the owning installation/readiness code, and extend `ReservedBootstrapUuidv7s`. Do not add a
compatibility re-export when an internal module moves; update its callers together.

## Workload and capacity

The current manifest is a strictly bounded control dataset: 5 slug namespaces, 4 platform
Profiles and Favorites Collections, 7 curated Tag Collections, 4 content-label Tags, 3 Realms,
5 Zones, 5 Wiki Posts, and 5 home Pages (42 Unit identities total). It also reserves 4 auth users,
4 accounts, 5 page structures, 5 navigations, and 2 avatar identities. Manifest values and
expected projections are
well below 1 MiB of process memory.

Ensure writes at most the missing identity subset under one PostgreSQL advisory lock and one
transaction. Concurrent attempts serialize on the installation key; there is no queue, fan-out,
or recurring writer. A newly created reserved avatar is written to the object store once; an
existing avatar identity is left untouched. A failed attempt is retried from the same manifest.

Fresh-install readiness performs fixed-ID primary-key, unique-key, or selective-index probes and
returns only manifest-bounded rows. The one check against mutable follow ordering reads the first
ordinary follow for each of the four platform Profiles through
`unit_follow_follower_favorite_position_idx`; it does not materialize a Profile's sequence. Thus the
work remains `O(B log N)` for fixed bootstrap bound `B`, with bounded memory and network results,
at both 500,000,000 and 3,000,000,000 corpus rows. Corpus growth changes index depth and storage,
not result cardinality or application fan-out. No bootstrap-specific partition is required; if the
owning corpus tables shard, these identity probes route by the same primary/profile/zone keys.

Any future change that scans all Profiles, Units, Zone Pages, follows, or localizations is a design
regression. A manifest expansion must record its new fixed bound, statement/write amplification,
lock duration, object-store cost, and migration or cutover plan before it is accepted.
