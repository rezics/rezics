# Participation ownership and cutover

This is the P02 source checkpoint for the replacement target. It is not a claim
that the whole operational program, generated migration, or Web cutover is done.
The stopped legacy database is an offline conversion input; these modules neither
read the old Profile table nor provide compatibility routes.

`users` is private authentication identity. `auth_entity` binds one human account
to one newly created public person Entity. Cataloging a person or organization
does not create a binding or grant control. `ensureSelfEntityInTransaction` locks
the account exclusively only when admission may create an identity; established
bindings use a shared account lock. Identity, canonical named form, presentation,
private preferences and the self binding are committed together. Interactive
admission additionally initializes the required account resources. Fixture
constructors can use the same identity admission without requiring the platform
content bundle. Provider names equal to the private email are not published.

The request context keeps `user`, its public self `entity`, and selected
`participation` separate. The optional `X-Rezics-Participation` header contains
only an acting Entity ID and exact grant ID/revision. It cannot replace the
authenticated principal or authorization revision. Personal account APIs always
use Auth ownership, regardless of the selected organization. A service principal
has a separate non-interactive Auth identity and public service actor; only a
random credential's SHA-256 digest is persisted. Service accounts cannot obtain
interactive sessions or use personal API-key admission.

`requireParticipation` checks the current account, binding/service revision,
acting-identity state, grant principal, capability, owner target, expiry and
revision in the transaction that performs the effect. Its row locks serialize
revocation with that effect. Catalog editing implies reading the same target,
but never publishing as another identity, membership/security control, or source
proposal adoption. Missing ambient authority does not fall back to a creator ID.
Resource ACL subjects are private Auth accounts; resource ownership and public
authorship remain Entity references. Transactional resource decisions also take
the shared form of the ACL mutation advisory lock, including absent deny rows.

Human source decisions can use direct self-account catalog authority. An
autonomous service/delegate uses an exact `proposal.adopt` grant with a concrete
composite FK to the approved source proposal. Issuing that grant is human
approval of that proposal, not a standing source-wide approval. The source owner
must check binding, policy, snapshot and native revisions before invoking
`runWithApprovedSourceProposal`. Its callback is limited to the same transaction
and exact native reference. Additional native dependencies need their own
authorized intake stage. `catalogAccessDecisions` accepts at most 128 targets and
checks the selected authority once for the batch; selected grants never fall
back to creator rights.

The bootstrap administrator is the initial human login. Community, editorial and
moderation are native organizations with explicit grants to that operator,
rather than shared interactive accounts. Public presentation has its own
language variant and revision. A selected name points to an immutable named-form
revision, so a catalog name edit cannot silently change a participant's selected
public name. Presentation and grant histories retain the actual private operator.

Account erasure first closes the Auth identity, clears login PII and removes its
self binding. It revokes the bounded outstanding grants and suspends public
identities that lose their last human controller. A currently authorized platform
security manager can resolve a recovery with recorded evidence and a new explicit
grant. Public authorship survives; recovering public identity does not recover
the previous account's journal, inbox or credentials. Private deletion uses a
durable job and 500-row transactions. A batch cannot advance past rows merely
because `SKIP LOCKED` skipped them. Database guards prevent new private rows for
erased accounts. Auth rows remain PII-free audit identities, rather than breaking
immutable source/operator foreign keys by cascading account deletion.

The native/source integration calls are:

```ts
const self = await ensureSelfEntityInTransaction(tx, authUser);
const authority = {
  principal: { kind: "auth" as const, authUserId: authUser.id },
  actingEntityId: self.id,
  authorizationRevision: self.authorizationRevision,
};
await runWithParticipationAuthority(authority, () => nativeWork(tx));

await runWithApprovedSourceProposal(
  tx,
  serviceAuthority,
  { sourceRecordId, proposalId, reference },
  () => approvedNativeWriter(tx),
);
```

## Workload and capacity assumptions

Participation is sparse relative to imported catalog Entities, but its storage
and audit relations are evaluated at 500 million rows and at 3 billion rows.
The following are design estimates, not measurements from a database of that
size. Auth admission and selected-grant reads use unique/primary-key seeks;
grant lists use `(auth_user_id, id)` keyset pagination with a 100-row page.
Public author cards use at most 512 identities and at most 32 presentation
variants per identity, projecting small summaries rather than biography bodies.
One complete biography is limited to 1 MiB. The targeted warm-database budget is
50 ms for admission/selected authority and 100 ms for a bounded author-card page;
real target measurements and P10 production throughput qualification remain gates.

| Relation/workload | Bound or estimate | 500M / 3B consequence |
| --- | --- | --- |
| Self binding | One per human Auth, about 150–200 bytes including its two indexes | About 75–100 GB / 450–600 GB |
| Scoped grants | About 400–550 bytes per row including current/list/target indexes, depending on principal mix and active state | About 200–275 GB / 1.2–1.65 TB |
| Grant evidence | About 180–240 bytes per event including PK and grant/revision key; issue plus revoke normally creates two events | About 90–120 GB / 540–720 GB per 500M/3B events |
| Presentation history | A 2 KiB mean snapshot is a workload assumption; the 1 MiB limit is an input bound, not a mean | About 1 TB / 6 TB before indexes, compression and replication; large-value skew must be monitored |
| Control admission | At most 1,000 outstanding grants per principal, 100 active service principals per creator, 32 security controllers per Entity | Bounded account erasure/control scans, independent of corpus size |
| Private erasure | 500 source rows per transaction, one locked job per worker poll, explicit stage progress and fair rescheduling | No account-sized transaction or in-memory corpus; add workers/partitions as queue age grows |

Grant mutation writes its current row and one immutable event, plus the relevant
indexes. Name/presentation changes also append their exact revision records.
WAL, replica traffic and storage must budget this amplification rather than only
heap row size. At 1,000 grant mutations/second, the logical input alone is roughly
0.6–0.8 MB/second before WAL/page/replica overhead. A 1 MiB biography write is a
separate high-cost case and must be charged/limited by the surrounding API policy.
For erasure, 500 rows averaging 1 KiB imply about 0.5 MiB of logical data per
batch, excluding indexes, WAL and cascades. Child cleanup stages must precede any
potentially unbounded cascade; coverage is audited as private owners are converted.

Hot accounts serialize only their control mutations, while established session
reads share the account lock. Hot Entity security operations serialize on their
control row; unrelated principals and identities remain independent. Job row
locks and bounded transaction retries provide backpressure without an unbounded
process queue. Observe lock wait, p95/p99 admission time, erasure oldest-job age,
WAL bytes, dead tuples and biography tail size. A sustained five-minute erasure
queue or the latency targets above triggers worker/storage review. Hash
partitioning by Auth/Entity ownership and independently routed owner shards are
the growth direction; preserving concrete FKs across a shard cutover is an
explicit P10 migration gate, not an unchecked polymorphic-reference shortcut.

PostgreSQL's [row locking rules](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)
and [Read Committed conflict behavior](https://www.postgresql.org/docs/current/transaction-iso.html)
inform the admission/revocation protocol. A missing row cannot be locked, which
is why first admission and ACL deny insertion use their owning account/advisory
serialization point. `ON CONFLICT` is followed by a fresh read where its losing
insertion needs to observe another committed transaction.

## Checkpoint verification boundary

The affected backend TypeScript check and focused Auth/self-Entity, grant policy,
session admission and platform-authority tests run against the current source.
SQL race, erasure/recovery and complete API lifecycle qualification must run on
the generated fresh replacement target. The coordinator owns migration generation,
OpenAPI/SDK generation, Web consumers and the final combined checks. No frontend
browser or visual acceptance is implied.

Remaining coordinated work at this checkpoint includes public actor column/name
cleanup, favorites/upload and personal projection ownership, full private erasure
stage coverage (including messages), public presentation restore/history APIs,
and SQL qualification of the final generated DDL. Baseline-only PostgreSQL
functions must be audited when their owner columns change: Atlas and a canonical
manifest limited to newer functions cannot prove those old bodies still execute.
