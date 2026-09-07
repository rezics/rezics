# Native software catalog workload and delivery boundary

The native owner distinguishes content, evidenced versions, releases, contextual
staff groupings, and release occurrences. A VNDB local `eid` cannot identify a
version. Native release queries are anchored to one readable content identity;
language, machine translation, platform and medium predicates correlate to the
same release. Date/territory occurrences and patch applicability remain separate.

Commands admit 128 components or 512 KiB per batch, one scalar record at up to
1 MiB, and return at most 100 occurrences with keyset pagination. Source documents
are bounded to 8 MB before parsing; complete corpus acquisition must stream records
and pause rather than enlarge these limits. Five animation contexts are a proven
per-release bound. Definition registries are bounded control data.

## Capacity assumptions

Plan for 500 million occurrence rows and a 3 billion row estimate independently
of the smaller release population. At a planning allowance of 160 bytes per hot
row plus 160 bytes of primary/reverse index entries, live occurrence storage is
160 GB / 960 GB before replicas, WAL and free-space reserve. Two immutable history
rows per live row averaging 512 bytes add 512 GB / 3.072 TB; long translated titles
can increase this substantially and are capped by byte budget. A 3x allocation
for replicas and 30% operational reserve yields approximately 2.62 TB / 15.73 TB.
These are explicit planning estimates, not measured production allocations.

Assume a read-heavy workload of 1,000 requests/s, 100 native mutations/s, hot
objects up to one million occurrences and a 100-row response at approximately
64 KiB. Read egress is approximately 64 MB/s before protocol overhead. One mutation
writes current data, a catalog change/revision and immutable history, so sustained
ingestion needs WAL and history capacity in addition to current-row throughput.
Each lookup seeks its owner prefix and an ID/revision cursor; reverse navigation
uses content/release or vocabulary/release indexes. No corpus scan or transitive
closure occurs on this request path. Actor visibility checks occur in SQL before
release pagination. Historical snapshots are restricted to the owner to avoid
revealing formerly private references.

Owner revision updates serialize writes to one release. At 10 ms/transaction a
single hot release cannot exceed approximately 100 serialized mutations/s; batch
ingestion, bounded worker concurrency and backpressure are required. If observed
lock wait p95 exceeds 100 ms or pending batches exceed the bounded scheduler
capacity, pause that owner and repartition workload. Owner-key routing can shard
current occurrences and their history together. The shared schema exporter owns
physical partition creation; this slice does not claim a 500M-row single-node
deployment, latency qualification, or demonstrated history maintenance throughput.

## Verified and unfinished scope

Deterministic contracts cover native version evidence, release carriers and
languages, partial dates, resolution and animation distinctions, source vocabulary
mapping, taxonomy/media/link semantic plans and dump row normalization. The
software-native PostgreSQL harness verifies identity/version ownership, correlated
filters, stale writes, immutable snapshots and scalar restoration on the integrated
disposable target. Its execution must be reported separately from unit tests.

Current unfinished boundaries are explicit: VN staff/voice credits do not yet
bind alias revisions and participation context revisions; software occurrence
history can be read and removals recorded but occurrence restore/edit commands are
not complete; dump release `supersedes`, legacy animation fields/background/face
flags, producer membership, DRM notes and technology links still need full native
adoption; dump VN/title and full field conformance is not complete. The safe source
stub initialization path is implemented, but reviewed source-update callbacks for
complete native graph replacement are not. No full VNDB/plan completion claim is
made by this batch.
