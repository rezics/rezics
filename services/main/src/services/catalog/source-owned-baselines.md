# Source-owned numeric baselines

Every baseline is a current indexed correspondence between an immutable source
occurrence and an exact native head. It is finalized after the source application
journal in the same transaction. Its last proposal/action FK and native journal
lookup prove the mutation that advanced it; native and originating-source history
FKs remain concrete for each owner. PostgreSQL verifies the exact source pointer,
originating revision and actual current head. A baseline cannot be deleted by an
ordinary command, moved to another key, or advanced without its native journal.

The eight catalog owners share a factory, but each has a physical table with
separate semantic/name/authority history FKs and a checked exclusive alternative.
Software has four additional baseline tables for scalar records, release
components, contexts and participation. Software scalar/component source
occurrences are immutable, exact native history references. These are correspondence
and evidence structures; they are not identity parents or raw payload stores.

Entity and Reference additionally retain their own fixed-profile source baselines
and numeric history FKs. See [fixed-profile source ownership](./profile-source.md)
for their native commands, inverse behavior and capacity assumptions.

A resolver seeks `(source_record_id, mapping_key, owner_id, kind, component_key)`.
It maps the original occurrence revision directly to the latest compensated native
head, irrespective of how many apply/withdraw cycles precede it. There is no
recursive history walk, fixed recursion depth, whole-owner reconstruction or
lifetime update limit. Baselines describe authority continuity; canonical writers
still check the actual child head and reject conflicting local edits.

The current application admits 128 native changes. Larger source records require
the centrally owned staged application protocol. Raising this cap or treating an
oversized whole-record callback as complete is not a supported fallback. All
baseline finalization and source occurrence reads remain scoped to one source
record, snapshot, native owner and bounded change list. Source-support queries use
the shared `(source_record_id,snapshot_id,owner_id,id)` index; named source
occurrences require the equivalent source snapshot and native-name index.

For each growing baseline relation, allow 480 bytes per row including its primary
index at a typical 96-byte source pointer. 500M rows require about 240 GB and 3B
about 1.44 TB before replication, WAL and free space. The nullable alternatives add
modest row overhead but avoid multiplying physical tables for each owner family.
Two native occurrence families at approximately 256 bytes/row each add 128 GB /
768 GB per family. Three replicas plus 30% reserve multiply live storage by 3.9;
actual notes, path length, WAL and index bloat must be measured independently.

At 100 native source changes/s, each change adds one source occurrence, immutable
journal row and one baseline insert/update in addition to native history/WAL.
The same source mapping remains serialized by its source lock; unrelated mappings
are independently routed. Use source-record hash partitions with a source-record
shard cutover to colocate correspondence and source applications. Native history
may reside in another owner shard after a future split, which requires an explicit
validated reference protocol rather than removing current database FKs. At 500M
or 3B rows a single-node unpartitioned baseline is not qualified. Pause source work
on its existing bounded queue/byte admission thresholds or when lock-wait p95
exceeds 100 ms; benchmark production write amplification and pruning before
accepting a deployment. The provided narrow fixtures are integrity evidence.
