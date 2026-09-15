# Realm enrollment

Realm enrollment owns policy inputs to the shared `access_membership` identity and
`access_membership_admission` generations. `membership.ts` owns commands;
`membership-policy.ts` composes native scope, credential, actor, selected subject,
representation and manager authority. The selected
[identity/access contract](../../../../../docs/architecture/identity-and-access.md)
and [execution phase](../../../../../docs/plan/execution-workflow.md) govern acceptance.
This implementation has source review and generated artifacts, not G2/G3 qualification.

## Identity and state

A request explicitly selects private direct principal authority or a represented
public Entity using `X-Rezics-Authority`. Public Self presentation, catalog
organization affiliation, Org enrollment and Realm creation never enroll another
identity. Account provisioning and official Realm installation no longer fabricate
public enrollments. A Realm owner retains ownership independently of membership.

One Realm policy row references the concrete shared scope/subject/member tuple.
`open` is a reserved, unenrolled identity; `invited` and `pending` are policy inputs
with no admission. A consenting open join or approved application becomes
`approved` and selects a new generation. `left` and `removed` clear that selection;
`rejected` ends an invitation/application. Rejoin creates a new generation, so
previous Group selections and generation-dependent roles/representation never
reactivate. The all-members set uses the same shared head.

`realm_enforcement` has independent `clear`, `muted` and `banned` state and revision.
Mute suppresses contribution without ending enrollment. Ban prevents admission and
membership-derived authority. Neither leaving, rejoining, nor deleting a follow
clears enforcement. Clear restriction restores only restriction eligibility; it
never enrolls a departed member. Current owners cannot be removed, muted or banned
through enrollment commands. Ownership checks use the concrete Realm target key.

## Native commands and consent

All enrollment mutations carry `operationId`, `expectedControlRevision`,
`expectedRevision`, `expectedMembershipVersion` and `expectedEnforcementRevision`.
The policy, enforcement and shared membership heads are distinct preconditions.
Read them with `GET /realms/:realmId/membership` for the selected subject or
`POST /realms/:realmId/members/inspect` for a manager-selected recipient.

- `POST /membership` takes `consent: true` and the exact `ruleRevisionId` (null
  declines optional acknowledgement; a required current revision must match). Open Realms admit; approval Realms
  retain a pending request. A live native manager invitation supplies admission
  authority for private Realms and approval-policy joins. A current native manager
  can instead authorize their own explicitly consenting private-Realm enrollment.
- `PATCH /members` takes a typed Entity recipient or private opaque selector and
  an explicit `invite`, `approve`, `reject`, `remove`, `mute`, `ban` or `clear`
  operation. Approval consumes the original applicant's current consent sources.
- `DELETE /membership` leaves or withdraws the selected subject's application.
  Managers can remove an admission or cancel a pending relationship. Closed,
  unpublished and soft-deleted Realms still permit authorized management/exit;
  only new invitation/admission requires current published, approved lifecycle.
- `GET /enrollment-rules` discloses bounded current rules to a currently authorized
  enrollment subject, including private invitees. `PUT /rules/:revisionId/acknowledgement`
  records exact preparatory consent or active-generation acknowledgement. The
  published-rule fence prevents consent racing a new revision. A non-current
  revision is rejected. Following alone never acknowledges rules.
- `POST /members/history` traverses immutable human and system receipts by
  policy revision. Expiry and erasure have explicit system operations without
  attributing those actions to the original human. Replay preserves the original
  result and requires current caller admission; expiring selectors are excluded
  from the digest after resolving their exact subject.

Consent and invitation evidence retain the original credential and exact native
source digest (representation path, binding/role revisions and membership/selection
bases). Issue-time consent requires a fresh session. Approval rechecks current
credential/source liveness without requiring that old session to remain *fresh*.
A replacement authority source cannot silently adopt an old consent. The current
Realm control revision, exact rules, invitation deadline and contact consent must
still match. Preparatory acknowledgement cannot extend an invitation's deadline.

Commands retain complete native authority and pair/tree/control fences before the
effect. `prepareEnrollmentRecovery` reuses bounded reverse impact and original
native recovery paths before and after membership/enforcement changes. Departure
may intentionally end its own management/representation source: the final check
retains live credential, actor/selected-subject policy, Realm control and selected
recovery rather than demanding that ended source again. No generated boolean or
cached capability substitutes for transaction admission.

## Private invitation contact exchange

A never-enrolled private principal can use the complete backend flow:

1. With direct principal authority, `POST /realms/:realmId/enrollment-contact`
   issues a secret for that exact Realm address. This endpoint does not inspect
   the addressed Realm or reveal whether a private Realm exists. It records
   explicit recipient consent to the scoped disclosure.
2. An authorized native manager exchanges that secret through
   `POST /realms/:realmId/enrollment-contacts/resolve`. The response contains
   `contactId` and a membership-purpose recipient selector bound to this manager's
   exact selected authority and verified credential.
3. The manager inspects the recipient's exact head, then invites with that selector,
   `contactId` and revision preconditions. The recipient reads their own status and
   rules, consents, and joins using their own direct context. No account ID is
   exposed or inferred from an Entity.
4. `DELETE /realms/enrollment-contacts/:contactId` revokes the contact with its
   expected revision, independently of Realm lifecycle. Acceptance holds and
   rechecks the original contact; revocation/expiry invalidates an unaccepted invite.

The contact is a revocable locator/consent, never membership or authority. Contact
creation is bounded to 64 physical active rows per principal, with 29-day expiry;
selectors and private roster cursors expire within five minutes.

## Disclosure and retained consumers

`current_realm_entity_membership` and `current_realm_entity_rule_acceptance` are
read-only public Entity projections over native shared membership/consent. Private
principals never appear in them. `GET /members` retains public Entity names,
avatars, canonical addresses and ownership presentation under native membership
read authority. The earlier roster also required an authenticated account via
`admitRealmAccount`; it did not authorize anonymous roster reads. Existing public
Realm/feed counts remain accessible through their own read policies.

`GET /enrollments?view=operational` is a separate private administrative roster;
`view=public` selects only Entity recipients. Both consume physical policy
candidates before subject filtering. Empty filtered pages can have a next cursor.
The public `active_member_count` keeps its existing active-state meaning: enrolled
Entities with clear Realm enforcement. Private subjects, muted and banned members
are excluded. Shared-head and independent enforcement triggers apply matching
counter deltas; reconciliation reads the same public projection. Missing counter
rows and underflow fail rather than being repaired with invented values.

Group/member-set evaluation, assignment eligibility, role/representation current
SQL and the mixed Group impact evaluator consume the same shared admission and
Realm ban policy. Existing public Realm permission/rule readers, Unit Realm
usersets, Tag contexts and Studio discovery consume the derived native Entity
projection or bounded shared candidates. Transactional retained Unit userset
consumers lock the exact membership pairs, including negative enrollment keys.
Studio/Tag discovery bounds physical active subject/scope candidates before Realm,
state or presentation filtering. Realm follows no longer write rule acceptance. Moderation commands retain
private audit events and the existing Realm notification event. Principal notices
use the exact principal; Entity notices use the original consenting inbox's
explicit represented context, revalidated against current native representation
and recipient policy. A notice destination never changes membership identity,
becomes a public actor, or expands a controller roster. Credential proofs expire
separately from this small revocable delivery basis; account erasure clears both.
Broader institutional inbox selection remains with its own future owner.

## Retention, capacity and qualification

The existing account erasure worker synchronously disables principal eligibility
and uses its bounded shared-membership removal stage. Realm cleanup then revokes
contacts and clears pending/private credential evidence through indexed subject
and original-consenter/inviter ranges; public Entity membership remains
institutional when an individual controller is erased. Deadline-indexed maintenance
expires applications/invitations and removes stale credential proofs. Independent
moderation and minimal shared/native audit anchors remain retained. Neither exit
nor cleanup scans all rule revisions or deletes prior generation acknowledgements.

Retain the 500,000,000-row baseline and 3,000,000,000-row estimate. Online admission
uses exact Realm/subject/member keys; roster pages consume at most 51 physical
scope/subject rows and return at most 50. Public per-subject discovery consumes at
most 257 indexed admissions and fails over its 256-candidate budget before hydration.
The retained userset discovery also counts physical candidates before deduplication.
Recovery keeps the existing 256-source/64-root budgets; an overflow is unavailable,
not a reason to raise limits. Expiry visits at most 50 applications and 50 contacts;
erasure visits at most 20 rows per indexed evidence range (including the retained notice destination) and 20 contacts per batch.

The policy head, shared identity/generations, enforcement, receipts and rule consent
are separately retained rows; do not reuse the old 256–320-byte roster estimate.
Planning allowances (not measurements) are 0.5–1 KiB per policy head with indexes,
0.25–0.5 KiB per retained enforcement row, and 0.5–1 KiB per command receipt before
WAL/replicas. At 500M/3B policy heads this is roughly 250–500 GB / 1.5–3 TB in
addition to shared IAM storage. Original credential evidence is capped at 32 KiB
per consent/invitation and cleared by deadline; measure actual pending fractions
and receipt volume before capacity acceptance. The existing 100 normal / 2,000
peak global changes/s and 200 ms p95 admission, 100 ms p95 roster targets remain
unqualified. Scope/tree management fences and hot-Realm counters require workload
qualification; these source bounds are not throughput evidence.

The forward replacement drops the obsolete writable roster/acceptance tables and
resets only their obsolete count projection. It preserves released migrations and
the completed native installation baseline. Generate from the tracked typed anchor
with `task services-main:db:generate:typed -- realm_enrollment`; fresh installations
replay the retained history and this forward migration. No legacy data transfer or
dual write is provided.

Required next-phase work: migrate the existing Realm membership/roster/rule and
projection fixtures (including `seed/service.ts`, whose old roster writes are
fixture work), author stateful API/contact/receipt and rejected-source scenarios,
then run owning TypeScript/deterministic checks, native replay and G2/G3 cases.
Include competing join/approval, source replacement, stale revisions, contact
revocation, last-clock expiry, leave/rejoin privilege non-revival, moderation
counter transitions, private disclosure, physical-candidate skew, erasure restart
and recovery continuity. OpenAPI/Fetch/TanStack/public SDK artifacts are generated,
not typechecked or runtime-qualified.

Existing web hooks mechanically capture native main Entity authority and explicit
preconditions, preserve rule confirmation, and use explicit moderation operations.
A missing/unusable native main context requires the account identity selection
flow; there is no Self-to-account fallback. A new private membership/contact UI,
advanced Entity selection and invitation/application management journeys remain
frontend design prerequisites, excluded from this task. The retained public
controls require later Storybook and affected workspace qualification. No tests,
fixtures, typechecks, lint validation, builds, replay/checks or rendered QA were run
in this implementation phase.
