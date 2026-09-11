# Controlled organization membership

This owner is operational participation, separate from sourced catalog
affiliations. A roster entry records a human account's explicitly accepted
membership in a controlled organization. It grants no publication, security,
catalog editing, voting multiplier or private-data access. The initial creator
receives explicit management grants; creation does not silently enroll anyone.

Invitations address a recipient's public Self Entity and bind it privately to
the current Auth account. Creating or cancelling an invitation and removing a
member require the exact `entity.membership` grant for that organization.
Acceptance/decline and voluntary departure use the actual authenticated human,
independently of an unrelated selected acting identity. No email or message
delivery is implicit in this lifecycle.

An invitation captures the issuer's Auth revision, exact immutable grant event,
and the organization's participation revision. Acceptance locks and revalidates
all three in the same transaction as the membership write. Revoked/expired
authority, erased/suspended accounts and a recovered organization generation
cannot revive a pending invitation. Current-controller and invitation-source
expiry predicates use current-statement time. Recovery rechecks a locked
platform grant after obtaining the organization control row, before changing
control history; waiting past its deadline does not admit a stale recovery. Already accepted membership survives an
issuer's later grant revocation; removal and the member's own account erasure
are separate effects. This follows the separation between membership and
provider-defined authorization in [SCIM RFC 7643](https://www.rfc-editor.org/rfc/rfc7643.html#section-4.2),
and the per-request validation rule in the [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#validate-the-permissions-on-every-request).

Membership mutations also apply the current account write policy to the human
performing the change. Acceptance revalidates the inviter's write eligibility.
Active bans and enforcement suspensions block invitation creation, cancellation,
acceptance/decline, removal and departure. Silence blocks contributions rather
than these membership writes. Enforcement expiry and explicit reversal restore
eligibility; enforcement alone does not delete an already accepted membership.
Private inbox and authorized roster reads retain their read policy. These
account-enforcement effects are separate from sign-in suspension/closure and
from the Auth-to-Self binding state.

Pending invitations become accepted, declined, cancelled, expired or invalidated;
terminal invitations never reopen. Rejoining requires a new accepted invitation
and advances the existing membership revision. An immutable account-owned event
records every join, removal and voluntary departure with the actual operator;
rejoining cannot overwrite prior removal evidence. Concrete composite foreign keys
bind a roster entry to its exact recipient/organization invitation and bind the
invitation to immutable grant evidence. Database guards reject wrong self pairs,
uncontrolled/non-organization targets, stale admissions and revision rollback.

Erasure immediately fences acceptance via Auth/grant admission. Bounded worker
stages invalidate pending invitations sent by the erased operator, delete the
erased member's transition events and roster rows, then delete received invitations. Accepted
invitations owned by another recipient retain the PII-free operator reference;
deleting an inviter never removes another person's accepted membership.

## Workload and scale

Potential membership/invitation relations use the 500M-row baseline and 3B-row
estimate. Assumptions: 10M active organizations, median 20 and heavy-tail 1M
members, 100 membership changes/second normally and 2,000/second globally at
peak, 10,000 roster/inbox pages/second, pages of at most 100 rows. Local target
budgets are 100 ms p95 for reads and 200 ms p95 for admission excluding client
transport. These are targets and workload assumptions, not measured production
qualification.

There are at most 1,000 pending invitations per organization and per recipient.
Two scoped advisory locks serialize admission and capacity checks; they do not
lock every roster member. Expired/invalidated pending rows are drained within
the union of those two proven 1,000-row sets (at most 2,000 rows) before admission.
Accepted history is unbounded but is never part of a request-path count. Member
and manager pages use composite seeks/keyset cursors; issuer/recipient cleanup
uses indexed 500-row batches. No operation loads a whole organization's roster.

Estimated membership storage is 180-240 bytes heap plus 250-400 bytes across
primary/member/active/account/invitation/operator indexes: 215-320 GB at 500M
rows or 1.29-1.92 TB at 3B. Invitations are about 240-320 bytes heap and 350-500
bytes indexed, including the explicit four-column membership FK target and grant
evidence key: 295-410 GB at 500M or 1.77-2.46 TB at 3B. Width, fillfactor, bloat,
WAL, backups and replication must be measured separately. A transition event
including its five indexes is estimated at 300-450 bytes: 150-225 GB at 500M or
900 GB-1.35 TB at 3B events. Acceptance writes the invitation, current membership
and one event; rejoin updates the same roster identity and adds an event. At
2,000 acceptances/second, roughly 2-3 MB/second of logical writes precede WAL and
replica amplification. Responses are bounded metadata, with no invitation body
or copied biography.

Hot organization invitations serialize only admission; recipients targeted by
many organizations serialize on their inbox admission lock. This deliberately
backpressures invitation floods. Observe lock wait, pending-bound failures,
oldest erasure job, dead tuples/WAL, and p95/p99 page/admission latency. A sustained
200 ms admission p95 or five-minute erasure backlog triggers capacity review.
Organization-hash roster shards and Auth-routed inbox/erasure ownership are the
growth direction. Cross-owner routing, concrete FK preservation and a committed
membership/inbox cutover must be qualified before sharding; no unchecked
polymorphic relation replaces these constraints. The expiry correction adds no rows or indexes at either scale. A recovery
using an expiring platform grant adds one scalar SQL deadline check after its
locks; current-controller probes retain their existing selective keys and
32-controller bound. No 500M/3B throughput claim is made from local fixtures.

The [foundation fixture workflow](../../../../../docs/testing/foundation.md#controlled-organization-membership)
records executable lifecycle/API/race evidence and its qualification boundaries.
Use the installed native baseline and forward migrations; generated contracts
remain owned by their existing OpenAPI/SDK tasks.

The pending-admission fixture in the linked foundation workflow verifies both
1,000-row limits through domain commands and direct SQL, slot reclamation, and
competing last-slot admissions on independent connections. It does not replace
sustained workload or migration/sharding qualification.

The account-policy integration adds one indexed account-enforcement probe per
acting account on a membership write, plus the account authorizer's existing row-lock
probe. Acceptance checks both recipient and inviter; other membership changes
check one operator. Read queries and storage do not change. At the 2,000-change/s
peak assumption, acceptance adds up to 4,000 enforcement probes/s and 4,000
account-key lock probes/s in the uncached admission path. This is a workload estimate,
not a measured capacity result. Long enforcement histories and lock contention
remain part of the 500M/3B load qualification.
