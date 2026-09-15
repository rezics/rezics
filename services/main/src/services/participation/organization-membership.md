# Native organization enrollment

Org enrollment uses the canonical Entity resource `access_scope`, typed
`access_subject`, and the same `access_membership` head/admission/event consumed
by Groups, member sets, bindings and representation. The old Self/account roster
and invitation tables are replaced by forward migrations, without transfer or
parallel writes. The completed installation baseline and released SQL remain
unchanged. This is implementation evidence only; native acceptance remains deferred
under the [execution workflow](../../../../../docs/plan/execution-workflow.md).

## Authority and identity

An active controlled organization admits eligible Entities and human private
AuthPrincipals. Public catalog affiliation, an operator's Self, metadata ownership,
Org membership, and Realm association never supply consent or representation.
Service-principal enrollment is deliberately not an eligible Org recipient type.

`access.membership.read` discloses the private roster/history; separately,
`access.membership.manage` admits invitations/revocations/removal at the Org's
`memberships` path. Entity consent/inbox/leave selects that Entity explicitly and
requires `access.membership.participate` representation at its own `memberships`
path. Direct mode selects only the authenticated private principal. All commands
use current first-party credential policy, human actor eligibility and fresh
interactive sessions for mutation. Account enforcement remains independent:
write bans block writes, while silence remains contribution policy. No command
clears mute/ban/enforcement state or creates Realm enrollment.

Creation issues an explicit, institutional, scope-bounded native governance
representation. It enrolls nobody. The retained managed-organization constructor
and fresh installation constructor issue the same native relation; they no longer
issue the obsolete `entity.membership` capability. The private-account constructor
needs no public Self. Released installations are not backfilled by an implicit
compatibility path.

## Invitation protocol

Private principals explicitly create a scope-specific contact capability, share it
outside this protocol, and may revoke it. Only its digest is stored. A currently
authorized Org manager exchanges that capability for an opaque recipient selector.
Selectors bind the exact verified credential, selected authority, Org scope and
purpose for five minutes. They disclose no global account/subject ID, account name,
email or Self association. Entity recipients instead use their actual Entity ID;
that ID never resolves implicitly to an account. No email/message is sent.

An invitation captures the Org participation revision, recipient subject, contact
consent when applicable, original inviter credential/selection, and the exact
`groupAuthoritySourceDigest` of owner/binding/terms/role/representation/member-set
sources. Acceptance re-reads and compares those sources. Replacing revoked source
A with grant B does not revive the invitation. A pending invitation also ends
when its original session/credential is no longer admitted; signing in again does
not substitute new proof. Fresh-session age is required when issuing, but the
inviter's session need not remain *fresh* while the invitation is pending.

States are pending, accepted, declined, revoked, expired and invalidated. Pending
confers nothing. Acceptance requires an exact invitation revision, expected shared
membership version, operation ID and explicit consent. One transaction writes the
shared admission, resolves the invitation and records the exact result. Accepted
membership is independent from the inviter's subsequent departure, revocation or
erasure. Ending membership clears `active_generation`; rejoin advances
`last_generation`. Old Group selections and declared admission dependencies cannot
follow the new generation. SQL guards require accepted Org consent to match the
exact shared event and concrete scope/subject/admission FKs.

Receipts bind the operator, selected authority, canonical target and command digest.
Retries under current authorization return the original outcome, without renewing
an invitation or repeating a membership transition. Refreshed private selectors
resolve to the same canonical request target. Terminal invitation proof payloads
are scrubbed; the receipt and PII-free audit references remain separate evidence.

## Recovery, reads and cleanup

Before a membership transition that may affect configured authority, bounded
physical binding/representation/ceiling/dependency candidates identify repair
roots. For every affected root, one existing registered native recovery path must
remain exercisable through the same pre-change sources after the effect. Explicit
all-scope representation is repaired at its represented Entity root; the protocol
does not enumerate the resource corpus. Candidate overflow or missing recovery
policy is unavailable, never a guessed subset. Existing Group recovery registration
APIs supply those paths. Leaving may consume its own manager source, so the final
check retains credential, actor/selected-subject eligibility and scope admission
without demanding the authority it just ended.

Platform evidence-reviewed Org recovery uses `access.membership.recover` at the
platform `organization-recovery` path. Recipient contact is exchanged for a
separate recovery-purpose opaque selector. Recovery requires exact control revision,
current platform authority, eligible recipient/contact and no currently eligible
native controller; non-subject controller sources remain unavailable for this
narrow recovery route. It revokes old native root representation grants, advances
the Org control revision and installs an explicit replacement. It does not enroll
the recipient. The older raw-account recovery route rejects Org targets.

Roster and inbox select indexed candidate pages of at most 50 before hydration.
Inbox includes terminal history; pending denied/unavailable entries remain present,
and expiry is presented separately from stored revision. Roster returns shared
head/version/generation plus current availability, including departed identities.
History is a membership/version seek over shared events. Missing enrollment is
404, while policy unavailability remains 503 or an explicit row availability.
Private roster cursors/selectors are encrypted; names/links are returned only for
actual Entities, never synthesized from private principal enrollment. The retained
manager chooser pages direct representation and direct binding candidates under
current native authority; it fails unavailable rather than publishing a partial or falsely empty directory. Broader
Group-derived administration discovery is not inferred from a direct directory.

Shared member-set readers and native current-recipient predicates also apply Org
scope lifecycle. A disabled/deleted/recovery-required scope contributes no current
member-set rights, without deleting institutional enrollment or enforcement.

Worker lanes `organization.enrollment_expiry` and
`organization.enrollment_reconcile` process indexed deadlines. Reconciliation
invalidates known-denied pending invitations and retries unavailable evidence.
Acceptance checks revocation immediately; background lag cannot authorize it.
Account erasure invalidates sent pending invitations, erases private operation
receipts, clears active shared generations, then removes received invitations and
contacts. The shared immutable admission/Group audit keys retain PII-free account
anchors; another recipient's accepted membership is not deleted with its inviter.

## Production entry points

All enrollment routes are under `/api/v1/participation/membership`:

| Operation | Route/input |
| --- | --- |
| Create Org without Self | `POST /organizations` with name/language; returns Entity, scope and native representation |
| Native manager directory | `GET /managed-organizations` with optional opaque `afterId` |
| Share private contact | `POST /organizations/:organizationEntityId/contacts`; `POST /contacts/:id/revoke` |
| Resolve private recipient | `POST /organizations/:organizationEntityId/recipients` with contact secret |
| Invite | `POST /organizations/:organizationEntityId/invitations`, typed recipient, operationId, optional expiresAt |
| Accept/decline | `POST /invitations/:invitationId/accept` or `/decline`, expectedRevision/operationId; accept also expectedMembershipVersion/consent |
| Revoke invitation | `POST /organizations/:organizationEntityId/invitations/:invitationId/revoke` |
| Leave/remove | `POST /me/organizations/:organizationEntityId/leave` or `/organizations/:organizationEntityId/members/remove`, exact shared version/operationId; remove adds typed recipient |
| Roster/inbox | `GET /organizations/:organizationEntityId/members`, `/organizations/:organizationEntityId/invitations`, `/me/invitations`, `/me/organizations` |
| History | `POST /organizations/:organizationEntityId/history` with typed recipient and optional afterVersion |
| Recovery | `POST /organizations/:organizationEntityId/recovery-recipient`, then `/recover` with selector/control revision/evidence/operationId |

Requests select representation with `X-Rezics-Authority`; no public/default
presentation header supplies authority. Native Org management requires a currently
usable explicit representation or management binding. Protected membership changes
also require pre-existing registered repair paths for every discovered root.
Platform recovery requires its separately provisioned native permission. Native
credential/authority provisioning and actual sessions must exist before API use.

The two retained web consumers use native transport inputs and stable command IDs.
Their existing Entity invitation form remains Entity-only. New private-contact
initiation/sharing and Entity-selected inbox experiences remain frontend work;
private-principal invitations/acceptance and represented Entity enrollment are
available through the production API. No full frontend experience is claimed.

## Workload and capacity assumptions

Retain the **500,000,000-row baseline** and **3,000,000,000-row estimate** for
membership, invitation, receipt, contact and event relations. Assume 10M active
Orgs, median 20/heavy-tail 1M members, 100 mutations/s typical and 2,000/s global
peak, and 10,000 roster/inbox pages/s. Read/admission targets remain 100/200 ms p95,
not measured results. Native authority hydration is bounded per candidate and
may require up to 50 native checks per page; its high fan-out is explicitly
unqualified at these rates. Measure lock wait, SQL visits, response bytes and
p95/p99 before capacity acceptance.

Each Org and recipient has at most 1,000 physical pending invitations, including
expired slots, and each principal at most 64 unrevoked contacts. Scoped advisory
locks serialize these admission counters; request expiry cleanup touches only the
two bounded pending index ranges. Contact history is not counted. Pending reviews
are a separate one-row-per-pending deadline queue. Global expiry batches are 100;
policy reconciliation takes 20 due candidates, each in its own transaction, every
10 seconds per worker. Unavailable candidates move five minutes forward. At the
2,000 invitations/s peak a single lane cannot keep up: partition due work by Org
hash and add workers (SKIP LOCKED prevents duplicate effects); alert on five-minute
oldest-due lag. No request depends on that backlog for revocation correctness.

Pages use scope/subject, subject/scope, scope/invitation ID, subject/invitation ID,
private direct-subject source ID, or membership/version index ranges. Reverse
recovery discovery uses recipient-scope/ID indexes including dormant and every
recipient kind, then admission dependency indexes. It caps physical sources at
256 before deduplication and roots at 64, with up to eight registered recovery
candidates/root. This is a workload boundary, not an empirical safe throughput.
Erasure reads 100 private receipts/invitations or 20 active heads per batch through
subject indexes; the active-subject partial index excludes departed history.

Planning widths: shared head plus its indexes 400–650 B/identity (200–325 GB at
500M; 1.2–1.95 TB at 3B); invitation heap/indexes excluding bounded JSON authority
500–900 B (250–450 GB; 1.5–2.7 TB), plus commonly 1–8 KiB private proof while
pending, hard maximum 32 KiB. Operation receipts 450–900 B (225–450 GB; 1.35–2.7 TB),
contacts 250–450 B (125–225 GB; 0.75–1.35 TB), pending review row/indexes 100–180 B
(50–90 GB; 300–540 GB if the entire baseline were pending). Each added private
source or active-head reverse index is approximately 50–90 B/entry (25–45 GB;
150–270 GB). Shared event/admission/Group-set amplification remains in the owning
IAM schema, not a duplicate Org roster. Acceptance writes one invitation, one
operation receipt, shared head/event/admission and its Group-set initialization;
terminal resolution deletes one review queue row. WAL, replicas, backups, TOAST,
bloat, index maintenance and erasure contention remain unmeasured.

Growth direction is Org-hash admission/roster routing with subject-routed private
inbox/erasure ownership, preserving concrete FK and atomic admission semantics.
Forward replacement DDL is generated with the typed anchor workflow's explicit
no-rename table replacement declaration. Required future qualification includes
native SQL/API transitions and concurrency, exact source replacement, erasure,
permission/credential expiry during lock waits, recovery continuity, retained web
TypeScript/localization checks and scoped Storybook screenshots. No tests,
test-authoring, fixtures, typecheck, lint validation, build, DB replay, benchmarks
or browser QA ran during implementation.
