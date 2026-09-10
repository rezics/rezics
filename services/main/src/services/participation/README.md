# Participation and authority

This owner defines private account control, public acting identities and scoped
delegation. The [current plan](../../../../../docs/plan/README.md) owns remaining
qualification; no legacy database or compatibility route is a dependency.

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

Independent catalog identity intake requires current human self authority, a
matching private operator and account contribution eligibility. Missing/stale
authority, a mismatched actor UUID, an erased account, a selected resource or
proposal grant, and a service principal cannot authorize this intake path.
Source proposal approval mutates its exact admitted target; prepare additional
native identities in a separately authorized intake stage before entering that
scope. A future service-intake capability requires its own explicit contract.

Account/signup and managed-persona constructors prove their account/controller
authority before calling the internal identity storage primitive. That primitive
only writes the identity and initial provenance; it does not create a binding or
grant. Keeping this path separate avoids requiring an existing self binding in
the transaction that first creates it. Ordinary catalog commands cannot select
this constructor through a client-supplied flag or classification.

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

Catalog intake adds a fixed number of account/binding/participation primary-key
reads and the existing account-enforcement lookup before writing the new owner
row and its change record. Shared authority locks remain held through commit;
there is no owner-corpus scan or rewrite. The estimates above remain planning
assumptions, not new load measurements from the intake-denial fixture.

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

Remaining coordinated work includes public actor column/name cleanup, retained
owner replacement of global Unit references and SQL qualification of the final
generated DDL. Baseline-only PostgreSQL functions must be audited when their owner
columns change: Atlas and a canonical manifest limited to newer functions cannot
prove those old bodies still execute.

## Private Favorites, uploads and complete deletion ownership

Personal Following stores ordering, favorite and delivery settings in
`account_follow_preference`, keyed by Auth and target. A concrete composite FK
keeps its public Entity follow present, with at most one private row per follow.
The database requires an active account and active self binding; organization
selection never transfers those preferences. Erasure drains preference rows in
500-row batches while retaining the public relation. Follow listings scan at most
512 indexed private candidates, then apply visibility and return at most 100;
the continuation cursor advances over filtered candidates even for empty pages.
The default workload assumes 128-192 bytes of heap plus roughly 160-240 bytes
across four indexes per preference: approximately 144-216 GB at 500M rows and
864 GB-1.30 TB at 3B, before WAL, replication and bloat. One follow writes two
rows; preference changes affect only the private row and relevant indexes.
These are storage estimates, with the existing latency and shard-cutover gates
above still requiring production qualification. The referencing indexes also
bound follow deletion to its single preference, consistent with PostgreSQL's
[foreign-key indexing guidance](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK).

`scripts/check-private-account-lifecycle.ts` passed 32 assertions on the generated
60-migration disposable target. It uses the real service commands and PostgreSQL:
515 public follows with 512 invisible candidates, cursor continuation, wrong
Auth/self and missing-follow FK denial, exact Favorites lookup, stale revision
denial, save/delete/restore/history, immutable private history before erasure,
all durable cleanup stages and unrelated-account survival. Every fixture row
rolls back. Its 502-object versioned archive is an in-memory test double: it
proves orchestration and retained-empty-fence behavior, not live S3/R2 races or
retention qualification. The independently tested missing/nonempty/truncated
fence and oversized-page failures leave erasure incomplete.

## Current Web consumers

The Web application consumes generated account/Entity/Favorites contracts, with
Auth-scoped preferences and caches. Public Entity pages do not infer account
membership from an identity creation date. Self presentation settings and the
organization access page use native versioned presentation writes and exact
history previews/restoration. Unsupported native Entity slug controls no longer
call global Unit language/address editors.

`/settings/participation` lists named organizations, admits an explicit current
security grant, inspects its bounded recipient grant page and issues/revokes
public-identity-addressed publication/security grants. Each delegated operation
uses an isolated generated client with its exact grant revision; account requests
are never given a global acting-identity header. Service creation shows a secret
once and supports revocation; the account page starts the actual erasure job.
Favorites has a separate private page with notes, preview refresh, ordering and
history. A removed entry can still be inspected/restored from the target's Save
dialog, where the exact stored snapshot is shown before restoration.

Web and localization TypeScript, localization policy and 42 non-rendering Web
checks passed for this checkpoint. These are code-integrity results, not browser
or visual acceptance. Native Catalog/Entity follow and Favorites targets still
depend on the coordinated global Unit interaction cutover. Organization roster
membership is a separate lifecycle; no publication/security privilege is inferred
from that future relation or from a sourced catalog membership.

Favorites now has its own `/favorites` API and three Auth-owned relations:
`account_favorite`, `account_favorite_revision`, and `account_favorites_state`.
It is not a public Collection. Public Collection routes and bootstrap no longer
create hidden Favorites collections or write their private item history into
shared immutable `revision_content`. A save keeps an ordered target, an optional
private note and a typed captured preview. Restore restores the stored note,
preview and position; an occupied historical position inserts immediately after
that occupant. The optional explicit ordering anchor takes precedence. The fresh
target accepts this breaking replacement; old Favorites extraction belongs to
offline conversion, not to a runtime adapter.

One account-local state row serializes mutations and supplies optimistic
concurrency. Entry lookup and order seek use `(auth_user_id, target_unit_id)` and
`(auth_user_id, position)`. List pages contain at most 100 entries; history pages
contain metadata only and retrieve one full snapshot by exact revision. Notes are
bounded at 64 KiB, previews at 8 KiB and complete historical snapshots at 96 KiB.
History deletion is permitted only after the owning account is erased. Source,
operator and public publication evidence continues to use its immutable owners.

The erasure state machine deletes current Progress before its entries so
`current_basis` cannot be left invalid by an FK setting `current_entry_id` null.
The one Post link per Progress entry and one mail intent per notification are
proven bounded by unique constraints. API tokens drain their lease, daily-usage
and rate-state children by token-indexed batches before the token's two one-row
cascades. Notifications have an unconditional recipient index, Progress entries
have an unconditional Auth index, and message redaction has a partial sender
index that excludes already erased content. Erasure also removes account quotas,
private blocks, notification/read statistics, Studio state, recommendation
events/exclusions, personal Tags and subscriptions. Sent messages become content-
free tombstones so the other participant's read-marker order remains valid.

Image upload and management use private Auth ownership. New presigned uploads
include a signed `If-None-Match: *` header: an upload cannot overwrite its logical
content identity. Account erasure overwrites the original key with an empty fence,
then deletes at most 500 other keys/versions below that exact asset prefix per
transaction. The empty current object rejects even an already in-flight
conditional upload when it attempts to commit. A confirmed empty fence remains;
its body contains no private data. Public ready images remain public content;
private and incomplete uploads are erased. The replacement target must use an
object namespace/bucket with no old unconditional upload URLs; offline conversion
copies old objects into this new protocol. Internal completion, cleanup and
derived-image publication share account/asset locks, preventing a queued writer
from recreating private bytes after erasure admission closes.

The S3 adapter checks bucket versioning and drains historical versions as well as
current objects. Its explicit R2 endpoint branch uses current-object listing
because R2 has no object-version API. A provider error, partial delete or missing
empty fence leaves the durable job incomplete. Successful mocked archive tests
are not qualification of live storage credentials, retention policy or regional
availability. The deployment must permit prefix/version listing and deletion,
and must not lifecycle-delete retained empty upload fences.

These requirements follow the documented [AWS presigned URL reuse semantics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html),
[bounded multi-object deletion](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObjects.html)
and [R2's conditional-write and listing support](https://developers.cloudflare.com/r2/api/s3/api/).

### Private workload estimates and remaining qualification

Assume 500 Favorites mutations/second, 5,000 ordered reads/second and 1,000 active
erasure jobs spread across accounts; hot-account operations serialize on that
account's state row. These are capacity scenarios, not measured production rates.
With a 1.3 KiB mean entry including indexes, 500M current Favorites require about
650 GB and 3B require about 3.9 TB. At a 1.7 KiB mean history row including indexes,
500M revisions require about 850 GB and 3B about 5.1 TB. A mutation writes a current
row, a history row and one small state row; budget heap/index/WAL/replica traffic
for all three, with approximately 1.5 MB/s logical input at the assumed rate
before WAL overhead and high-note tails. Per-account hash partitions/shards are
the growth path; target ownership FKs need an explicit coordinated shard cutover.

Ordinary deletion batches contain at most 500 rows. Favorites history uses 32
rows (at most 3 MiB of bounded snapshot bodies), current Favorites 48 rows (about
3.4 MiB at their body maximum), and sent messages 32 rows (at most 2.5 MiB of old
content). These bounds limit high-tail TOAST/WAL work rather than relying on a
small average. Image erasure uses one locked asset and at most 500 object keys;
it never materializes all image variants or all account tokens. No account-sized
cascade, whole-corpus scan, deep offset, or in-process queue is needed.

At a 512 KiB mean original image, 500M originals represent about 262 TB and 3B
about 1.57 PB before derived images and provider version history. Empty erasure
fences add object-count/metadata overhead without retaining image bodies. Budget
provider metadata and request charges, database ownership/index storage and
network/WAL amplification separately. Large image-generation work retains the
existing 10 MiB / 40M-pixel input limits. Observe archive request latency/error
rate, erasure oldest-job age, private row deletion throughput, Auth/asset lock
wait, history/TOAST size and fractional-position length. Existing fractional-key
storage bounds still require an order-maintenance path at extreme repeated-gap
insertion; bounded local compaction and its concurrency proof remain a specific
qualification gate before claiming unrestricted hot-account ordering capacity.
