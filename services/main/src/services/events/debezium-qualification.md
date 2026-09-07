# Debezium outbox relay qualification

The [focused harness](../../../scripts/check-debezium-relay.ts) qualifies Debezium
Server 3.6.2.Final against PostgreSQL 18 and NATS 2.14.6 on a disposable Docker
Desktop Linux engine, driven by Bun 1.4.0 on Windows. This is local R1 relay
evidence, not production activation or canonical database migration acceptance.

Run from the repository root with Docker already available and these images
already pulled:

```powershell
$env:REZICS_DISPOSABLE_EVENT_FIXTURE = '1'
bun services/main/scripts/check-debezium-relay.ts
```

The command never accepts an existing database endpoint. It creates uniquely
named containers and a network; binds PostgreSQL at `127.0.0.1:25432`, NATS at
`127.0.0.1:44222`, an ACK fault proxy at `127.0.0.1:44223`, and Debezium at
`127.0.0.1:48080`; and removes its containers, anonymous volumes, network and
`.temp/runtime-debezium/<run-id>` in `finally`. The proxy relies on Docker
Desktop's `host.docker.internal` reaching a host loopback service. A port conflict
fails the run. It does not stop or reset normal development services. Image cache
entries remain reusable.

## Pinned inputs

| Image | Qualified digest |
| --- | --- |
| `postgres:18-alpine` | `sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2` |
| `nats:2.14.6` | `sha256:d4a8980c1ee558257f196f86693ec919c7a8b8095dd678e2cb5ff1adcfe03ecb` |
| `quay.io/debezium/server:3.6.2.Final` | `sha256:190ad95cf6820dc3ee2fd8bb58d11d96bc32f98bc75a1ddf804d4339f7926a79` |

The harness uses tag-plus-digest references. NATS uses file storage and
`sync_interval: always`, with a precreated stream from the transport owner's
configuration: R1, reject new messages at capacity, 64 KiB maximum message,
100 messages/1 MiB limits, and a 120-second deduplication window. Debezium's
automatic stream creation is disabled. Its container has a 1 GiB memory limit,
two CPUs, a 16-record batch, 32-record queue and 2 MiB queue byte limit. These
are bounded fixture resources, not a measured production sizing recommendation.

## Mapping that preserves the contract

The fixture has the same eleven outbox columns and a composite
`(routing_bucket, message_id)` key, with two range partitions. It deliberately
does not recreate canonical admission, immutable-row triggers or every canonical
partition; those remain covered by the database owner tests.

The publication is restricted to committed inserts from the parent:

```sql
CREATE PUBLICATION rezics_qualification
FOR TABLE public.operational_outbox
WITH (publish = 'insert', publish_via_partition_root = true);
```

The connector uses `pgoutput`, this existing publication, and an exact
`public.operational_outbox` include list. The following essential mapping is
part of the executable harness:

```properties
debezium.format.value=simplestring
debezium.format.key=simplestring
debezium.format.header=json
debezium.format.header.class=org.apache.kafka.connect.storage.SimpleHeaderConverter
debezium.transforms=outbox
debezium.transforms.outbox.type=io.debezium.transforms.outbox.EventRouter
debezium.transforms.outbox.table.field.event.id=message_id
debezium.transforms.outbox.table.field.event.key=aggregate_key
debezium.transforms.outbox.table.field.event.payload=serialized_envelope
debezium.transforms.outbox.table.fields.additional.placement=message_id:header:Nats-Msg-Id
debezium.transforms.outbox.route.by.field=subject
debezium.transforms.outbox.route.topic.replacement=$${routedByValue}
```

The serialized text column and string value converter preserve exact UTF-8
bytes instead of reconstructing the envelope from JSONB. The explicit
`SimpleHeaderConverter` preserves the UUID header's string value, matching
`publishEnvelope` rather than JSON-quoting it; `json` selects the engine's string
header representation, while the converter class controls its encoding. The
server accepts a `connect` format token but the embedded converter rejects it at
startup, so that token alone does not prove a working raw-header path. Requalify
the converter override when upgrading. Quarkus requires the
doubled dollar sign in this properties file. The body still carries the event
ID, and application receipts remain authoritative after broker deduplication
expires.

## Observed checks, 2026-09-07

The focused run checks all of the following against actual processes:

- A preexisting row is captured by the initial snapshot; a later insert into a
  leaf partition is captured through the parent publication.
- Subject and envelope match the committed row, including nested null values,
  Chinese, accented Latin characters and emoji. Both strict runtime decoding
  and byte-for-byte comparison pass; `Nats-Msg-Id` equals the body message ID.
  Republishing that envelope through the existing Bun publisher receives a
  duplicate ACK rather than adding another stored message.
- A rolled-back insertion never appears in the stream.
- An offset file is persisted on the host mount. After a graceful stop, removal
  and recreation of the Debezium container, a row written while it was offline
  arrives, the connector reports loading the prior offset, and the file advances.
- A frame-aware TCP proxy drops one real JetStream publish ACK. The broker
  already has the event when the harness sends `SIGKILL` to Debezium. The offset
  bytes remain unchanged. Recreating the relay from that file resends the stable
  ID and receives a duplicate publish ACK; the stream retains one stored copy.
  A subsequent new event still arrives.

The run ends with five stored messages, one discarded ACK and one duplicate ACK.
It emits exact image digests plus the replication slot's `restart_lsn`,
`confirmed_flush_lsn` and retained WAL bytes. These positions and byte counts
are run-specific evidence, not thresholds. TypeScript and Biome checks apply
only to this harness and its imported transport contracts.

## Remaining operational boundary

This evidence covers a retained slot, intact local offset file, intact R1
broker, one synchronous publisher, and a replay within the broker's duplicate
window. It does not qualify async sink mode, broker restart/disk/quorum faults,
slot recreation, missing WAL, corrupted offsets, another relay taking over,
failover slots, TLS/credentials, or production throughput. The fixture uses a
disposable superuser and must not become a production credential template.

Offset retention and slot identity must travel together. Do not change the
connector prefix, reset offsets, advance/drop the slot or enable concurrent
readers as a recovery shortcut. Slot/offset mismatch handling and a
checkpointed resnapshot must be deliberately qualified; this test does not
turn the connector's default mismatch behavior into a data-loss detector.
Likewise, receipt/consumer replay and durable outbox cleanup require their own
business checkpoints. A successful sink ACK is not an application receipt.

The fixture caps retained WAL with `max_slot_wal_keep_size=128MB`; reaching that
limit can invalidate a stalled slot and require recovery. Production needs
alerts and admission before the configured WAL reserve is consumed, plus a
heartbeat strategy whose messages cannot leak into the outbox envelope path.
No heartbeat/table-wide maintenance scheme is inferred from this short run.

At the existing 500M/3B corpus planning inputs, expected flow is approximately
694/4,167 messages per second; the 72-hour, 1 KiB, R3 retention estimate is about
553 GB/3.32 TB before indexes, WAL, protocol overhead and reserve. This harness
does constant work per event and retains at most the bounded fixture stream and
16 diagnostic ACKs. Five messages cannot establish connector throughput,
fsync latency, slot catch-up, hot partitions or 500M/3B outbox maintenance cost.
Use the [event capacity plan](../../../../../docs/architecture/event-streaming.md#capacity-model)
and qualify sharded placement and recovery before treating those rates as
supported. The passed body/ACK contract removes a connector compatibility
uncertainty; it does not close the production capacity gate.

Primary references: [pinned NATS sink implementation](https://github.com/debezium/debezium-server/blob/v3.6.2.Final/debezium-server-nats-jetstream/src/main/java/io/debezium/server/nats/jetstream/NatsJetStreamChangeConsumer.java),
[pinned format selection](https://github.com/debezium/debezium-server/blob/v3.6.2.Final/debezium-server-core/src/main/java/io/debezium/server/DebeziumServer.java),
[pinned converter implementation](https://github.com/debezium/debezium/blob/v3.6.2.Final/debezium-embedded/src/main/java/io/debezium/embedded/ConverterBuilder.java),
[Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html),
[PostgreSQL publication semantics](https://www.postgresql.org/docs/18/sql-createpublication.html),
and [PostgreSQL connector operations](https://debezium.io/documentation/reference/stable/connectors/postgresql.html).
