# Bounded event transport

This module implements the transport boundary from [event streaming](../../../../../docs/architecture/event-streaming.md).
It is not wired into the shared email worker. Business owners supply a runtime
payload parser and transactional application/failure callbacks. An envelope's
UUID, owner reference, revision, routing epoch and occurrence time prove neither
current authority nor execution order. Validate those facts against current
domain state at the final application transaction.

`encodeEnvelope`/`decodeEnvelope` enforce the strict v1 shape and a 64 KiB UTF-8
limit. `aggregateRoutingBucket` hashes UTF-8 `owner:key` with SHA-256, reads the
first two bytes big endian and takes modulo 1024. Owner tokens cannot contain
the separator. Encoding and decoding reject another bucket; epochs change
placement, never identity. The database must enforce the same routing function.
Canonical aggregate selection and immutable operation fingerprints are still
domain responsibilities: changing an aggregate key is not a safe retry.

`provisionTransport` creates explicit file-backed event `LimitsPolicy` or task
`WorkQueuePolicy` streams and durable pull consumers. Existing configured-field
drift is an error; provisioning does not migrate progress. Events expire after
72 hours; tasks have no age expiry. Both reject new writes at configured byte or
message capacity. Task kinds have exact nonoverlapping consumer filters. Event
consumers are independent by purpose. Production configuration requests R3;
qualification requests R1. Server fsync, endpoint security and independent
failure domains require separate host configuration.

`publishEnvelope` waits for a JetStream publish ACK with expected stream and
stable body message ID as broker deduplication ID. It has a five-second timeout
and one client attempt. The caller persists/retries outbox progress only after
ACK; losing that ACK can safely resend only with the same durable identity.
It does not commit a database transaction or implement a CDC relay.

`consumeBatch` pulls at most 32 messages and runs four callbacks concurrently;
consumer outstanding ACKs cap at 64. NATS client 3.4 rejects simultaneous
`max_messages`/`max_bytes` fetch options. With the stream's 64 KiB maximum
message size, the selected 32-message pull bounds encoded payload bytes to
2 MiB per batch. Client objects, decoded JSON, headers and network buffers add
overhead and need measurement. Pull expiration is one second, ACK wait is
60 seconds, and callbacks receive a cooperative 30-second cancellation signal.
The batch drains started callbacks before returning; it never races a timeout
against an uncancelled business mutation. Owners must honor the signal and use
bounded database/network timeouts. This does not forcibly terminate arbitrary
JavaScript that ignores cancellation.

Callback outcomes form the durable boundary:

- `committed`, `duplicate`, or `terminal` with a persisted receipt ID permit a
  confirmed ACK. Domain mutation, continuation, receipt and next outbox records
  must already be committed atomically. Additional owner outcome metadata is
  allowed but does not strengthen this transport's proof.
- `lease_lost` leaves the delivery untouched. Adapt an owner's lease-lost
  exception into this result before it reaches the transport; a generic thrown
  exception requests retry and cannot convey fencing semantics.
- `retry` carries a 1–900,000 ms delay committed by the owner. Generic failures
  use bounded exponential delay/jitter (at most 60 seconds). At delivery 10,
  both paths invoke durable failure disposition instead of another NAK.

Malformed data is identified by broker stream/sequence plus payload SHA-256;
failure details use fixed classifications rather than arbitrary source-bearing
exception text. The failure callback must persist a replay disposition before
ACK. If storage is unavailable or the final disposition still asks to retry,
the batch fails without ACK and the caller must alarm. MaxDeliver alone cannot
guarantee final disposition: crashes, missed ACKs and lease loss can exhaust it
without executing the last handler. An advisory/reconciliation owner and
checkpointed replay remain required before unattended production activation.
Task deadlines/retry elapsed time belong to persisted task state; publication
age is deliberately not used to expire otherwise replayable events.

## Capacity and activation boundary

Topology is operator-bounded: at most 1024 buckets, two stream families and 64
consumers per provisioned stream. This slice maps a bucket to one stream; fully
provisioning all buckets would create 2048 streams. Do not precreate that fleet
without measuring resource cost or introducing reviewed bucket grouping and
checkpointed placement. No broker resource is created per Unit/subscription.
Each shard requires explicit byte/message limits. Those configuration limits
bound admission; they are not throughput qualification.

At 500M/3B logical objects, the accepted planning model (two bindings, 1% daily
changes, six messages/change) gives roughly 694/4,167 messages/s. A 1 KiB message,
72-hour retention and R3 produce about 553 GB/3.32 TB of replicated message
bytes, excluding task lifetime, indexes, broker overhead, backups and reserve.
Each independent consumer adds delivery bandwidth; 4,167 messages/s at 1 KiB is
about 4.27 MB/s per consumer before framing. This code stores no corpus-wide map
and performs constant work per envelope, but it does not establish fsync cost,
hot-key throughput, shard catch-up or total node memory. Measure 1k/5k/10k
profiles, payload p99, replica bandwidth and rebuild reserve before activation.

Unqualified: Debezium/PostgreSQL offset recovery, real business receipts,
retention-floor recovery, exhausted-delivery reconciliation, external effect
idempotency, broker quorum/disk faults, restore, production credentials/TLS and
deployment. Retention loss must fail the owning consumer's health gate; this
isolated batch adapter has no stored business checkpoint from which to infer it.

## Focused checks

Run `yarn exec vitest run --project main services/main/src/services/events/transport.test.ts`.
Run `bun services/main/scripts/check-event-transport.ts` against a disposable
loopback NATS endpoint with `REZICS_DISPOSABLE_EVENT_FIXTURE=1` and `NATS_URL` set.
The harness creates unique streams and removes them in `finally`; it verifies
real broker ACK/dedup, independent event retention, task removal/redelivery,
poison disposition, nonoverlapping filters, bounded concurrency, configuration
drift and capacity rejection. Receipt callbacks are explicitly synthetic.

Verified 2026-09-07 with Bun 1.4.0, official `@nats-io/transport-node` and
`@nats-io/jetstream` 3.4.0, NATS 2.14.6 image
`nats@sha256:d4a8980c1ee558257f196f86693ec919c7a8b8095dd678e2cb5ff1adcfe03ecb`,
R1 and `sync_interval: always`. Local transport evidence is not production HA.

Primary client references: [official Node/Bun transport](https://github.com/nats-io/nats.js/tree/main/transport-node),
[pull consumers](https://docs.nats.io/learn/jetstream/pull-consumers),
[stream retention](https://docs.nats.io/nats-concepts/jetstream/streams).
