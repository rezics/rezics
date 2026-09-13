# Distribution composition

`distribution` owns an optional native `package` identity. It describes an actual
jointly distributed selection, such as a visual novel, printed art book and
soundtrack in one box. A standalone publication, game release or music release
does not require a package parent. Franchise/series membership remains governed
grouping semantics, not containment. Composition does not copy reviews, progress,
licenses, officialness, access grants or entitlements.

The independent source qualification is grounded in the MusicBrainz
[release definition](https://musicbrainz.org/doc/Release), which distinguishes an
issued product and its ordered audio media, and
[packaging definition](https://musicbrainz.org/doc/Release/Packaging), which places
the outer box at release scope. This owner covers mixed-domain composition;
music media and tracks remain solely writable through the music owner. A package
is not a replacement universal Edition and not an ecosystem package coordinate.

## Identity and revisions

Package identity is `{ owner: 'distribution', id }`. A manifest belongs to exactly
one package. Each occurrence has a stable UUID, a zero-based ordinal, independent
original numbering, and positive integral quantity or null for unknown quantity.
The same target can occur several times in a manifest. Retained occurrences keep
their UUID when a complete replacement manifest is staged. Occurrence UUIDs are
scoped to the manifest; an exact occurrence reference includes package ID,
manifest ID and occurrence ID. Package/content is never a uniqueness key.

Each occurrence has exactly one concrete FK to publication, text version,
software content, software release, music release, recording, program version or
episode. A Work role, musical composition, franchise or package identity alone
does not establish one of these eligible concrete targets. The [native Work/release contract](database/native-work.md)
does not itself provide a pinned distributable selection; its eligible content
or publication must be identified explicitly. The absence of package targets
proves acyclicity without recursive corpus scans.
All target FKs restrict deletion; removing or revising a package cannot delete
its independently owned content.

This concrete target inventory describes the current package implementation.
The selected [composition protocol](database/content-composition.md) also requires
exact published inputs, local import correspondence and refresh behavior. Apply
those requirements through qualified domain adapters rather than interpreting
every Work identity as a distributable content version.

Authoring creates a source-free private draft and stages 1–128 occurrences per
append. An expected prefix rejects stale retries. A database statement trigger
checks the inserted ordinal range and updates the prefix once per batch; primary
keys exclude duplicate positions, while a separate scoped key excludes duplicate
occurrence IDs. Publication seals the manifest, appends an immutable complete
revision and advances the package head in the same transaction. Expected head
revision rejects stale edits. Deferred triggers prohibit unpublished history and
missing heads. Restoring a historical revision creates a new revision pointing to
its existing sealed manifest, requiring no member copies. Old revisions remain
available; no source observation is required for any operation.

Each operation enforces the native owner's creator/read policy. Every member
export page checks the current visibility of each distinct target in at most four
owner-batched reads; an inaccessible target rejects that page. An old snapshot
does not resurrect deleted/retired content or transfer rights. Manifest counts and
package revision labels are package-owned metadata, not target details. A package
may be readable while member export is denied.

## Capacity and operational envelope

The corpus relation is `distribution_member`, including historical manifests.
Planning assumes 500M rows initially and 3B rows at the upper estimate, median
8–32 members/package, a long tail to millions, up to 128 rows/write batch,
1,000 export pages/s and 100 append batches/s distributed across owners. One hot
manifest has exactly one writer; stale prefixes fail and queueing belongs to a
bounded caller queue. Suggested initial admission is 16 concurrent append
transactions/DB shard, 2 pending writes/package, 128 rows and roughly 180 KiB
maximum member input/batch (including UTF-8 original numbering and framing).
These are deployment sizing assumptions, not an enforced service rate limiter.

At 320 bytes/heap row including average numbering, 500M/3B rows require roughly
160 GB/960 GB heap. The PK, occurrence key and exactly one non-null partial target
index at approximately 80/80/96 bytes add 128 GB/768 GB before fillfactor, WAL,
replication, vacuum and bloat. Budget 2x heap/index footprint: approximately
576 GB/3.46 TB live provisioned storage, plus retention and backups. Worst-case
1024-byte numbering adds about 480 GB/2.88 TB over the assumed average.
The upper bound must use observed row-width distribution, not these averages.

One new member writes one heap row and three indexes. The eight nullable target
indexes are partial: only its selected target index is populated. Prefix updates
occur once per batch and can be HOT; sealing/head publication is constant-sized.
New full edits cost O(M) writes for M members, but each transaction remains bounded
to 128 rows. Historical retention amplifies storage by revisions; restore is O(1).
No automatic full-manifest rewrite, recursive traversal or corpus-sized worker is
scheduled. Explicit cancellation/retention of abandoned staging is future operator
maintenance; do not run automatic unbounded cleanup. Observe staged bytes and age.

Read/export uses `(package_id, manifest_id, position)` keysets: O(log N + 128),
independent of manifest size. History uses `(package_id, revision)`. Reverse lookup
first selects at most 128 indexed target occurrences, then checks their current
package heads in one bounded query. Its continuation advances even when a page
contains only historical occurrences; clients must continue on the cursor rather
than treating an empty page as completion. Cursor values are service-level
bookmarks and must be made opaque at any external transport boundary. A hot target
never causes an unbounded scan to fill one response. No count(*) is on a request
path. Per-page target permission reads deduplicate IDs and batch by owner.

Partition/shard by package ID once the primary/replica data volume or p95 page
latency exceeds the deployment envelope (initial alerts: 70% disk, 100 ms p95
read, 250 ms p95 append, 1 s oldest pending hot-package write). Owner-local keys
preserve package placement; exact-target reverse indexing needs a separate
incremental target-partitioned projection when crossing DB shards. Initial
single-DB concrete FKs require target routing and validation to be redesigned
before cross-shard activation; no distributed FK support is claimed. At 3B rows
the model is disk-backed and bounded, but hardware throughput is not certified.

`check-distribution.ts` validates source-free mixed-domain authoring, repeated
occurrences, paged export, restore, stale writers, access isolation and SQL guard
failures on an explicitly disposable PostgreSQL target. A 16,384-member hot
manifest checks tail keyset index access and bounded historical reverse scans.
Its EXPLAIN does not claim 500M-row latency from toy data. Unit
tests cover target alternatives, UTF-8 bounds, quantity and batch invariants.
