# Identity, membership and mixed authorization

Status: selected target contract. Implementation and qualification are tracked in
[M01](../plan/modules/foundation.md) and [M06](../plan/modules/community-and-governance.md).
Existing account/Self and ACL fixtures establish only their recorded behavior.
This contract replaces their one-to-one identity and account-only grantee assumptions;
it does not claim the replacement is implemented.

Terminology update, 2026-09-19: [the integrated model](schema-modeling.md)
selects Resource for the logical Unit contract and Agent for the described/public
person/organization responsibility. The detailed contracts below retain
their current Entity-named types, columns, API concepts and headings; those public
Entities denote admitted Agents, not the new generic Entity store. Renaming and
consumer qualification remain M01 work. No new public User/Profile identity layer
is introduced. Private `users`/AuthPrincipal storage remains valid for credentials,
private preferences and accountability; it is not a public authorship/ownership key.

Public activity and presentation must not reverse-map an Agent to an assumed unique
private account. Several Principals can represent one Agent and one Principal can
represent several Agents. Account-private state becomes public activity only through
an explicit attributed disclosure/publication contract. Space merges the Realm/Zone
identity owner while retaining independent capability, membership and context-role
admission; see [Space composition](realm-collection-zone.md).

This owner defines identity, membership, roles, representation and authorization
semantics. [Connected applications](connected-apps.md) owns external delegation,
[the experience contract](identity-and-access-experience.md) owns GUI layering,
[D02](database/data-dictionary.md#d02-accounts-participation-and-access) owns relational
shape, and [capacity](identity-access-capacity.md) owns the workload envelope.

## Identity and service boundaries

| Concept | Contract |
| --- | --- |
| AuthPrincipal | Private authenticated human or workload identity. Credential methods, private account data and enforcement remain separate from public presentation. Authentication methods can link to one principal only through verified linking. |
| Entity | Stable public referent and, when participation is admitted, a content/interactions identity. Person, organization and service presentation reuse native Entity identity. Cataloging a referent does not admit participation or prove control. |
| Authority subject | The AuthPrincipal or Entity whose authority a request explicitly exercises. A Group/MemberSet is a grant recipient set, not an authenticated caller. |
| Representation | An explicit, scoped permission to exercise an Entity's authority. Multiple principals can represent an Entity and one principal can represent multiple Entities. |
| Attribution | The identity credited for an effect. It cannot manufacture representation or resource access; public contributions require an admitted Entity and appropriate attribution authority. |

The term principal in external authorization literature is broader than the private
AuthPrincipal type here. An Entity can be an authorization subject and a managed
resource. Account management, Entity control and security-role assignment may be
granted to AuthPrincipals, Entities or eligible member sets. Operation-specific
conditions, not a blanket identity-type split, constrain these capabilities.

Keep authentication/account control, Entity directory/representation, resource
authorization and product preferences behind explicit module interfaces. One
PostgreSQL authority is the initial deployment. Later independent services must
preserve verified identity, current authority and recovery contracts; direct access
to another service's private account tables is not an external integration API.

Public resources, ordinary responses, webhooks, errors and public audit presentation
use authorized Entity data. Raw AuthPrincipal IDs, credentials, emails, controller
lists and links between otherwise separate Entities stay private. Internal services
receive only necessary verified context; an opaque operation or audience-scoped
actor reference can support authorized audit correlation without publishing the
global account graph. A publicly shared Entity intentionally permits correlation
of that Entity across platforms, not discovery of its other controllers/personas.

## Private subject and scope values

The first D02 persistence layer gives a private `access_subject` value to exactly
one AuthPrincipal or Entity through concrete restrictive foreign keys. The same
UUID in those two identity namespaces denotes two different subjects. Member sets
remain separate grant-recipient relations and never become authenticated callers.
Allocation neither activates Entity participation nor links a controller, creates
a grant, chooses a default or proves current eligibility.

An `access_scope` is one immutable authority root: the registered platform root,
a private AuthPrincipal account, or an existing canonical Unit REF. Org/Entity,
Realm and other public roots all reuse REF rather than adding nullable domain
columns or parallel direct-owner aliases. This avoids two scope/fence identities
for the same public target. Org membership and Entity control can share that
native root while retaining independent actions, bindings and admission policy.
Structural capability and owner eligibility belong to the consuming command;
creating a root for a cataloged organization does not admit operational membership.
Subtree/resource selection narrows a binding or grant, not the identity of its root.

Parsed IAM UUIDs normalize hexadecimal casing before command digests, candidate
maps and requested-authority selections are formed. Namespace discriminators stay
distinct; this does not normalize opaque OAuth client IDs or external identifiers.

The concrete `users`/Entity owner and `reference_value` foreign keys establish
identity integrity. Exactly-one-target checks and per-alternative unique indexes
prevent malformed or duplicate values. Updates, retargeting, rekeying and deletion
are rejected so later history/dependency rows cannot change meaning. Revocation,
retirement and erasure change their owning lifecycle records; resolving a retained
value is never a current authorization decision. Principal tombstones may retain
private identity while credentials and personal fields are erased.

Internal allocators accept validated closed alternatives in the caller's bounded,
already authorized transaction. They reuse an existing mapping without updating
it. A losing READ COMMITTED insert reads the concurrent winner in a new statement;
stronger isolation propagates serialization failure for whole-command retry.
This reuses the qualified immutable-reference protocol. These behaviors follow
[PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
and [statement snapshots](https://www.postgresql.org/docs/18/transaction-iso.html);
the native fixture must qualify their actual composition. No public lookup endpoint,
recipient handle, mixed grant or representation path is provided by these tables.

The [capacity owner](identity-access-capacity.md#private-registry-cost) counts these
registries separately from memberships, bindings and token contexts. Direct domain
columns in every scope were rejected because they duplicate the Unit bridge and
permit conflicting aliases; a discriminator plus unchecked ID was rejected because
it cannot enforce concrete references. Keeping private accounts in the public Unit
registry was rejected because it would conflate private authority and public identity.

## Main Entity and private account state

Ordinary interactive onboarding creates or selects at least one usable Entity and
sets a private main-Entity preference. Admission proves control; it does not claim
a cataloged person by name/email or expose a private provider name. A human can
subsequently manage several Entities. Workload and recovery identities need not
create public personas merely to obtain a credential.

Account main Entity, application default Entity, request-selected authority subject
and published attribution are different values. Validate the chosen Entity on
entry and at effects. A valid default enters the normal experience directly.
An unavailable default prompts an explicit replacement before identity-sensitive
effects; do not silently publish as another Entity. Changing a default neither
rewrites history nor retargets an existing OAuth consent. Bind in-flight drafts,
tabs and commands to their selected identity so switching elsewhere cannot change
an already prepared operation.

Private favorites, preferences, security settings and other account-owned data
retain their private owner when a public identity switches. Any delegated account
management has an explicit target/action policy; representing an Entity alone does
not grant its controllers' personal data. Erasure and loss of a controller preserve
other valid controllers and permitted Entity contributions. Loss of every valid
control path suspends sensitive participation until governed recovery; recovery
does not revive erased accounts or old grants.

### Native subject eligibility

Current subject policy reads the private registry, then concrete account/Entity
owner rows under shared locks. Account lifecycle and enforcement writes take the
exclusive side of the account row fence; Entity participation writes take the
exclusive side of the Entity identity fence. Native triggers cover direct SQL
writers as well as application commands. A missing account-state row means active
by the account owner's contract; a missing Entity participation row means no
admitted participation. These negative selections are read after the owner fence.
The composed reader requires READ COMMITTED; merely locking an unchanged parent
row would not refresh an older repeatable snapshot of its policy children.

Erased/closed/currently suspended accounts are ineligible. Existing write versus
contribution enforcement semantics remain explicit, independently of the authority
subject; read eligibility does not invent a new enforcement-wide ban. Entity
eligibility requires an undeleted identity and active participation, without
requiring public publication. Database time after waits controls expiry and the
first known future policy boundary; nonfinite time and exhausted candidate reads
are unavailable. Resource/scope restrictions, credentials and independent-approval
conditions remain additional owner decisions.

### Scope-owned workload principals

A native workload uses a private service AuthPrincipal and does not require a
public Persona, password or personal API key. Its immutable owner is a human
account, Org or Realm installation scope, or the platform for a named internal
duty. Purpose and system key cannot be repurposed. Installation workloads begin
suspended; their owning installation must separately admit activation. Platform
duties use a unique private system key and remain a trusted provisioning boundary.

Control transitions retain exact operation receipts and private operator history.
Suspension/revocation advance a credential epoch; resumption does not restore the
previous epoch, and revocation is terminal. The original operator is never the
owner or a continuing liveness dependency. Installation/client binding, credentials,
quota and public attribution remain separate requirements.

Native subject eligibility requires an active workload in addition to its own
account policy. Installation workloads additionally require their exact active
installation approval window and App/controller lifecycle. Account-owned workloads also obey that human owner's lifecycle
and action-specific enforcement. Org-owned workloads require an undeleted,
participating organization; Realm-owned workloads require the undeleted Realm.
Platform duties require the platform root. These dependencies are loaded under
owner fences within a combined 256-account/Entity/Realm budget. Missing workload
admission denies service use; missing/incomplete bounded evidence is unavailable.
No creator-history lookup substitutes for current owner policy.

Principal authentication kind is immutable from creation. Entity shape changes
retain the workload-owner dependency guard and require READ COMMITTED so a
post-wait check cannot miss a newly admitted dependent workload. The workload
admission locks its Org identity while validating the structural owner type.
Native session/linked-credential writes require an unerased human account, preserve
credential ownership and linked issuer/subject identity, and cannot reset a
session's authentication time through an update. Existing personal-key guards
enforce the same human/service boundary.

The trusted installer provisions private duties for CIMD registration, webhook
delivery and account erasure. A unique duty key reuses its existing identity and
retains any suspension/revocation; installation reruns never renew it. These
accounts have no public Persona, password or interactive session. Runtime duties
still require current workload eligibility and their purpose-specific policy.
Legacy service-Persona consumers, installation provisioning and runtime-duty use
must migrate to this owner before the complete runtime is qualified.

### First-party credentials and management effects

Verified sessions and personal API keys produce private secret-digest proofs stored
outside enumerable request authorization state. A current read checks the same
principal and secret, live expiry and explicit credential authority. Personal keys
store a versioned operator/direct/represented limit in server-owned metadata; missing
or malformed limits are unavailable. New ordinary keys explicitly choose operator
authority. API entry scopes and domain permissions remain separate requirements.

Personal-key control identities are retained separately from removable provider
secret rows. Owner/identity reuse is forbidden; policy changes advance a narrow
fence and deletion records terminal revocation. Provider request counters leave
that fence unchanged. Current readers share the control fence and read configuration
after waits, avoiding a per-request counter write becoming a long-lived authority
lock. Sessions retain their own row fence. Only real sessions can satisfy the
ten-minute fresh-authentication window, and future/nonfinite times fail closed.

Management composition verifies the actor, credential, selected subject and complete
selected representation path before using management ownership or current role
bindings. Private accounts have direct-principal ownership; Entity control is not
inferred from directory metadata ownership. Domain owners still provide resource
lifecycle/restrictions, confer applicability, impact and recovery/approval policy.

Its final SQL checks the original secret identity, management source versions,
current recipient membership, subject eligibility and selected representation path,
as well as the chosen proof's earliest expiry. Thus an earlier mutation in the same
transaction cannot leave a cached management allow usable after its source changed.
Paths retain their actual selected references and fresh-session deadline. These
predicates require the owning transaction's retained fences and must be rebuilt
after rollback; they are not portable authorization receipts. Complete API/consumer
integration and native concurrency qualification remain pending.

Native `/access` management entry authenticates the private principal without
creating a public Persona. `X-Rezics-Authority` carries the explicit JSON authority
selection; absent selection means direct authority for sessions/operator keys or
the key's fixed selection. API entry requires `access:read` for inspection and
scope resolution, and `access:manage` for changes. These scopes do not supply
domain management permission. Responses are private and non-cacheable.

Scope resolution accepts the caller's own account, the platform, or a concrete
resource reference and requested management operation. Missing and undisclosed
roots share one response. Its fifteen-minute encrypted locator binds the private
root to the account and exact credential; it carries no authority. Role endpoints
recheck current admission, expose bounded keyset directories/control history and
omit private issuer identifiers. Definition creation/revision does not activate
permissions; activation, assignment impact and protected recovery have separate
admission requirements. Generated transports preserve these boundaries.

### Private default selection storage

One preference identity belongs to a private account and either its main selection
or one concrete OAuth client. Separate unique keys preserve main/client namespaces;
Entity is not unique, and these rows are not controller bindings. Selection is an
explicit Entity, no default, or (for clients only) inheritance from main. A missing
client override inherits main; explicit no-default does not. Clearing a main choice
requires later explicit selection rather than silently picking another Entity.

The main-choice API is direct private account ownership under `account:read` or
`account:update`; it does not reuse a represented Entity's access to personal data.
Reading the stored choice does not assert that the Entity is currently usable.
Setting an Entity additionally requires an explicit current representation path
for `access.identity.select` at that Entity's `identity` path. The credential must
permit both direct preference management and the selected represented context.
This purpose-specific permission proves selection control without choosing an
unrelated data action as a proxy or claiming access to future resources. It is
literal in representation snapshots and is never added to previously approved
grants. Clearing the preference needs no replacement representation. Both forms
retain operation receipts, expected versions and live authority at the effect.
Client-specific selection remains subject to its separate admitted-client policy.

Each explicit Entity preference retains up to eight user-selected representation
references as private context hints. They have concrete immutable grant-revision
FKs and a count/digest sealed by the preference receipt; later additions or edits
are forbidden. No hint is authority. Resolution rechecks the credential, current
subject/Entity policy and the same selected context, returning unset, ready or
selection-required. Infrastructure/integrity unavailability stays an error. A ready
context still requires operation-specific authorization at every later effect.

Keeping the selected references supports ordinary default entry without exploring
an unbounded controller graph or enumerating Group rosters. It also preserves the
chosen grant context across tabs and requests. When hints become unusable, the
user can select a new context for the same Entity or explicitly choose another;
resolution never substitutes a new grant or identity. The preference remains a
private convenience value and cannot retarget consent. Erasure removes context
hints before their receipts, in batches of at most 500.

Private account identity creation accepts explicit public names and never accepts
an existing Entity ID or copies a private provider name. One transaction creates
the native Entity, its direct institutional representation grant and the optional
main choice. The first creation requires a main-choice precondition. The initial
all-scopes grant seals the current literal permission vocabulary; it gives the
operator representation, not unrelated resource permissions. Additional identities
use the same constructor without imposing one-Entity-per-account uniqueness.

An immutable account/operation receipt fixes the created Entity, initial grant and
optional main revision. A replay requires current private account admission and
matching intent, returns that original outcome, and never renews a revoked grant
or resets a subsequently changed default. Account erasure removes these private
receipts in bounded batches before preference history. Public Entity lifecycle,
other controllers and institutional grants remain separate cleanup decisions.
The legacy unique-Self consumer migration and automatic onboarding entry remain
unqualified until they use these native owners throughout.

Commands use expected versions and stable operation IDs under the account fence,
with exact private receipts. Current owner SQL must admit management, the client
and chosen-identity usability; the preference store does not grant representation.
Capture reads retain main and client versions separately and return the chosen
Entity once. Prepared work and consents keep that Entity instead of following a
later preference change. Erased accounts cannot read or mutate preferences.

These histories are private convenience data with no incoming authority dependency.
Account erasure deletes receipt batches before their preference heads; native guards
allow that deletion only after the account's erasure frontier. Ordinary clearing
advances a revision. The production auth/session and API consumers still require
migration from the old unique-Self relation before default selection is activated.

## Membership, groups and teams

Both Org and Realm own membership capabilities and can independently own many
Groups, custom Roles and Bindings. Realm does not require an Org parent.

Membership identifies an admitted subject in a declared owner scope, with lifecycle,
revision and admission generation. Public participation can enroll Entities;
private operational membership can enroll AuthPrincipals. Each owner declares its
eligible subject types, admission policy and disclosure. Do not expose a private
enrollment by flattening both into a public people directory. Public presentation
of a private recipient is not conversion of the recipient's identity.

Share membership invariants and commands, with owner-specific policy. Invitations,
applications, exact-rule acknowledgement and moderation are separate records.
Pending acceptance grants no authority. Muting can restrict contribution without
ending membership; leaving/rejoining cannot erase a live ban. Ending an enrollment
invalidates dependent authorization immediately. Rejoining creates a new admission
generation and does not reactivate old privileged group assignments. Source-derived
catalog affiliations never enroll an operational member.

An Org participating in a Realm does not enroll every Org member or give every
controller authority to speak for it. These effects require explicit relations.

Groups contain typed AuthPrincipal/Entity members or declared subordinate groups.
One member can join multiple groups, and one group can receive multiple roles.
The all-members set derives from the owning membership relation; it is not a
second writable roster. Group membership must retain any admission-generation
dependency used for eligibility. A cross-scope recipient requires explicit target
authorization; scope association alone adds no permissions.

Team composes collaboration features with one Group's membership: presentation,
mentions and work entry points do not create another roster. A technical access
group need not have a public Team page. Group membership, control of a public
Team Entity (if one is admitted), and management of the Group remain distinct.

Use same-scope, bounded, single-parent group hierarchies initially. Child members
benefit from parent grants; parent members do not acquire child-only grants.
Inherited members are not copied into direct membership. Reject cycles and
validate reparenting as an authority change. Resource ancestry and role composition
are separate relationships, never inferred from Org/Realm/Team names.

### Shared membership generations

Use one scope/subject membership identity for both admitted Entity participation
and private principal operations. Its current head carries a control version and
last admission generation; an active-generation pointer is separate from that
identity. An inactive or merely reserved identity grants nothing. Invitations,
applications and rule acknowledgement remain owning-policy inputs rather than
alternative interpretations of an active membership row.

Each admission generation has a retained concrete key. Joining after departure
creates a new generation; ending membership clears its active selection without
rewriting previous admission identity. Group assignments and any membership-dependent
bindings reference the exact admission key and are effective only while the head
still selects that generation. This permits retained evidence while preventing
old privileged assignments from reviving on rejoin. An independent institutional
assignment still ignores its issuer's departure, but any declared recipient
eligibility dependency remains live.

Group membership and parent relations keep the owning scope in their concrete keys.
A parent belongs to the same scope, and one Group has at most one current parent.
Current child membership can use parent grants without copying rows into a second
roster. Parent changes serialize on their scope's tree fence and reject cycles and
excess depth before becoming visible. Assignment impact and recovery continuity are
additional authorization requirements, not consequences of a valid FK or acyclic
shape. Private operational membership never becomes a public Entity roster entry
merely because a presentation can be shown for its subject.

Admission commands require current owner policy, actor eligibility and the correct
subject's consent/representation basis where applicable. Mute/ban/enforcement state
is independent from admission generations: leave, rejoin and Group changes neither
clear it nor bypass its current effect. Those owner policies, disclosure, invitation
and erasure flows must pass native tests before the Org/Realm consumer replacement
qualifies for acceptance; the shared storage primitives alone do not qualify them.

### Realm native enrollment owner

[Realm enrollment](../../services/main/src/services/realms/README.md) implements
explicit Entity/public and principal/private admission over the shared identity.
Its policy/application and independent enforcement heads do not create parallel
rosters. Pending consent retains original native authority evidence; issue-time
freshness and later credential/source liveness are separate checks. A private
Realm's first principal invitation uses a scoped, revocable contact exchange rather
than account identifiers or inferred Entity/account associations. Exit and
revocation remain possible after unpublishing; new admission still requires the
current published policy. Public active counts and Entity presentation are distinct
from private operational enrollment. That owner records physical candidate budgets,
bounded cleanup/recovery, affected consumers and the deferred G2/G3/G5 prerequisites.

### Scoped Group topology protocol

Each Group has one immutable scope and identity, a current parent and lifecycle,
and immutable control snapshots. Creation completes a reserved identity in one
transaction; metadata updates, parent changes and terminal retirement are separate
commands with exact versions and stable operation receipts. Retirement detaches a
leaf; administrators move or retire children explicitly before retiring a parent.
Historical snapshots retain their selected parent without treating it as live.

The admitted topology is a forest with at most eight Groups from root to leaf.
Keep parent links in same-scope concrete keys. A scope-local tree row serializes
mutations; each control head transition advances that row after final pre-change
admission, so stale REPEATABLE READ snapshots
fail rather than combining independently valid parent moves into a cycle. Current
snapshot and authorization readers use a shared fence, promoted before writes when
the same tree is also an authority dependency. Unrelated scopes have separate rows.

Store each Group's derived subtree height. A move checks the new ancestor chain
plus the existing subtree height, then maintains heights only along the old/new
ancestor paths. The maximum active child comes from an ordered partial index,
including when the tallest child departs. No descendant roster or transitive
subject/resource matrix is rewritten. Prelock the bounded old/new ancestor closure
before final admission, so parent FKs and height maintenance cannot introduce a
later row-lock wait after the authority clock check. Changes still require current
management authority, assignment ceilings, reviewed impact and recovery continuity;
structural validity does not establish those policies.

This selected combination is a REZICS implementation choice. An adjacency-only
alternative needs a descendant scan to validate a moved subtree's maximum depth;
a closure/path materialization adds descendant writes on reparenting. Cached height
instead adds bounded ancestor maintenance and a shared scope mutation bottleneck.
The latter must be measured for hot scopes before capacity acceptance. An advisory
lock alone was rejected because it does not invalidate an already-fixed MVCC
snapshot; the common tree row write supplies a real serialization conflict.

Primary evidence reviewed September 14, 2026: GitHub's
[nested teams](https://docs.github.com/en/organizations/organizing-members-into-teams/about-teams#nested-teams)
illustrate single-parent inheritance with direct and inherited membership kept
separate; their visibility rules are not adopted as REZICS policy. PostgreSQL 18
[isolation](https://www.postgresql.org/docs/18/transaction-iso.html) and
[locking](https://www.postgresql.org/docs/18/explicit-locking.html) explain the row
conflicts and stale-snapshot rejection; REZICS must still test their composition.
PostgreSQL's [ordered B-tree limits](https://www.postgresql.org/docs/18/indexes-ordering.html)
support the maximum-child access path without scanning every sibling. Native
cycle/depth/shrink/width and two-connection tests qualify this mechanism; they do
not establish live role assignment impact, inherited roster privacy or throughput.

### Private Group management boundary

The native `/access/:scope/groups` API uses credential-bound opaque scope selectors
and current server-owned authority at `groups` or `groups/<group-id>`. Directory
reads require the broad path; detail and immutable history require the exact path.
Each page is an ascending keyset of at most 100 records (101 candidates), using
scope/Group and Group/version indexes. Historical reads retain current disclosure
checks and return no private operator or authority-subject identifiers. Mutations
record both private identities from live authority, preserve operation receipts
and require exact control versions. Reparent and retire additionally require a
fresh interactive session. Creation and presentation update confer no membership.

Without a review, the topology API admits dependency-free empty leaves for reparent
and retire. This is a sufficient no-impact proof: the exclusive tree fence excludes child/selection changes; the exclusive
Group head excludes new Group-referencing FK inserts. Under both fences, admission
requires height one, no physically selected direct memberships (including stale
admissions), and no Group-targeted RoleBinding, representation or assignment-ceiling
records, including dormant records. Exact-selection dependent authority is already
ineffective when no selection is active. No authority or recovery dependency can
be removed or gained by the admitted transition. Existing recovery authority is
preserved, but this does not certify that the scope already has a valid protected
recovery path. Receipt replay still requires live management authority, but does
not rerun new-effect impact against an already-applied transition.

Populated reparent and leaf retirement consume the exact complete impact review,
current ceiling/effect policy, an independent approval and protected recovery through
`authorization/group-admission.ts`. Clients pass `reviewId` to the existing mutation
endpoint. Receipt replay retains current management authority and the original
review selection; it does not reopen evidence invalidated by its own successful
Group transition. Empty roster alone cannot bypass the populated admission.

The no-impact proof uses bounded existence seeks, never a descendant or subject
scan. A partial `(recipient_group_id,id)` ceiling index adds one entry per
Group-targeted ceiling. At an estimated 64 bytes/entry, the conservative all-Group
case adds 32 GB at 500M ceilings or 192 GB at 3B, excluding bloat, WAL, replicas and
reserves; multiply by the Group-recipient fraction for a mixed population. Each
such ceiling insertion adds one index write. Group page presentation is bounded by
100 × 4,608 payload bytes before JSON/identity overhead. Hot-scope tree contention,
index installation cost and actual query plans remain verification obligations;
no new runtime, concurrency or capacity evidence is claimed for this boundary.

### Staged Group assignment-impact discovery

`authorization/group-impact-discovery.ts` owns private structural discovery for one
exact scope/Group, reparent-or-retire operation, expected Group/tree versions and
explicit proposed parent (null for retirement). Retirement continues to require a
leaf; nonleaf retirement has no selected child disposition. The production API
reads these preconditions through `GET .../groups/:groupId/impact-context`, creates
an idempotent caller-named review at `POST .../impact-reviews`, advances server-owned
keysets at `POST .../impact-reviews/:reviewId/pages`, and reads facts at
`GET .../impact-reviews/:reviewId?afterOrdinal=...`. The page version prevents a
retried advance from executing twice; inspection pagination is independent, so an
empty current fact page while discovery is running is not completeness.

Every request checks current `access.group.read` at the exact Group path and the
credential's `access:read` permission. Reviews belong to their original private
principal and selected authority subject; another selection cannot reuse them.
Cross-scope dependency details stay private in the server fact store. Inspection
exposes random review-local item ids, kinds, versions and state, without raw
principal/subject/recipient/target identifiers, permission sets or private audit
attribution. The proposed Group parent remains an explicitly selected Group id.
This restricted structural inspection is separate from permission to administer a
roster, confer a role, operate another target or execute the proposed transition.

The durable queue starts with the bounded old/new ancestor paths and the moved
subtree, plus the original management binding and selected representation sources.
The review deadline also retains their initial authority deadline. Each affected Group visits child, selected direct admission, Group binding,
ceiling, representation, exact-selection terms and retained parent-selection reverse
indexes in keyset pages. Ancestors visit their assignment dependencies without
expanding unrelated descendant rosters. Binding snapshots retain current role
activation/permission terms, frozen permission approvals and manager ceilings.
Representation snapshots retain current and exact parent revisions, their literal
permission approvals, exact admission/selection bases and dependent child lineage.
Membership evidence retains the current admission head, exact selected historical
admissions and current direct selections; supporting Group paths are loaded without
expanding their unrelated recipients. Dormant records and historical selection
references are conservative candidates, not a claim of current effective authority.
Deduplication applies to owner work; edge facts retain their exact selection versions.

`access_impact_fence` is a change witness, not a universal entity/identity table.
Source triggers update the appropriate per-Group, tree, membership, binding, role,
ceiling or representation witness on insert/update/delete, including both old and
new reverse keys. They cover native heads, terms, permission members, admissions
and selection-set writers. This makes newly inserted and removed dependencies
visible even after an empty reverse-index page. There is no per-review invalidation
fanout or global authorization epoch. Witness tombstones are retained; source
TRUNCATE and witness reset/deletion are rejected rather than admitting an ABA reuse.
Installing the triggers requires no population backfill: existing rows receive a
lazy zero witness under a conflicting upsert/reader lock before their first read.

The review also retains a bounded (64 KiB) `pg_current_snapshot()` value; each
writer witness stores `pg_current_xact_id()` as a full-width top-level xid8 value.
Revalidation requires that writer to be visible in the original snapshot, including
when a dependent bucket is first reached on a later page. A transaction started
before review creation but committed afterwards is therefore rejected as well.
This stores a transaction visibility boundary, without holding an exported MVCC
snapshot, vacuum horizon or transaction open across HTTP requests. Witness versions
still detect every later change and retain locking through the current page.

Every page runs in READ COMMITTED, records its positive and negative witnesses
before reading, and locks/recompares the entire bounded retained witness set before
commit. The same revalidation runs for inspection and complete-review consumption.
The changed witness, including insertion/deletion or binding, ceiling, representation
or admission revocation, makes the review `invalidated/changed`; crossing any observed start/expiry/grant deadline
or the fifteen-minute review lifetime makes it `invalidated/expired`. The earliest
boundary after review creation is retained even if first discovered after it passed.
Current management revocation denies inspection and consumption independently.
Missing source evidence or exceeded discovery budgets produce unavailable, never a
complete subset. Partial page effects roll back before recording terminal failure.
Deadlocks retry the whole page through the existing access transaction owner.

`complete` means complete structural discovery for the retained revision set. Every
response still says `admission: not-evaluated`. The next owner must use
`lockCompleteGroupImpactDiscovery` with the exact proposal and original attribution
inside the mutation transaction, after discovering/promoting all live authority
fences; `readGroupImpactFacts` supplies bounded private facts in that transaction.
Complete-review consumption also checks retained fact/node counts and an empty
work queue under the review lock. The evaluation owner below decodes the facts and retains complete source/recipient
contributions and ceiling decisions. Protected recovery still must establish continuity
and independent approvals from the pre-change state. It must recheck all time boundaries in the final mutation.
The discovery owner returns no boolean or SQL admission predicate. The production
admission owner below composes its evidence; empty-leaf admission retains its separate proof.

Operational budgets are 100 edges per keyset page (101 with lookahead), at most
eight queue steps and 512 edge/head candidates per advance, 4,096 queued owners,
32,768 retained facts, 65,536 queue steps and 16 MiB encoded fact payload per review.
Permission members remain bounded by the action vocabulary, admission selections
by 64, and ancestor depth by eight; those point-read costs are additional to the
edge-page budget. Revalidation locks at most 8,193 owner/scope witnesses; it performs
indexed seeks over the bounded review, never over a corpus or full ACL matrix.
Final admission input consumption additionally counts the bounded stored facts and nodes to detect missing artifacts.
These finite initial budgets may make a larger change unavailable; completing a
partial review, raising evaluation limits or silently clipping impact is forbidden.
Sixteen retained reviews per principal over the twenty-four-hour retention window
bound intake through a principal-local advisory lock and expiry index. The worker
prunes expired reviews after a day in at most 100 facts, 100 nodes and 100 witnesses
per tick, deleting the empty header last. Pruning retains terminal invalidity and
never removes reusable source witnesses. Cleanup lag remains an operational capacity
obligation, not permission to make evidence appear complete.

Keep the 500,000,000-row baseline and 3,000,000,000-row estimate for every potentially
large source, witness and reverse index. At an estimated 64-96 bytes per added
reverse entry, each all-row index costs 32-48 GB / 192-288 GB respectively; multiply
by the Group/selection/dependent fraction for partial indexes. At 160-256 bytes per
witness including its key index, one witness population costs 80-128 GB / 480-768 GB,
excluding replicas, WAL, bloat and reserves. Source writes add O(1) fixed witness
upserts (at most five distinct keys per representation head with immutable
references); they never
rewrite a roster or fan out to reviews. Fact payload caps do not include row/index,
WAL or duplicate key overhead. Hot Group/parent witness contention, index rollout,
cleanup throughput, storage and actual query plans require later verification.

Mechanism evidence reviewed 2026-09-15: PostgreSQL documents
[READ COMMITTED statement snapshots](https://www.postgresql.org/docs/current/transaction-iso.html)
and [conflicting row locks](https://www.postgresql.org/docs/current/explicit-locking.html).
Its [snapshot visibility functions](https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-PG-SNAPSHOT)
distinguish top-level transaction visibility without commit-timestamp retention;
together these motivate retained change witnesses instead of trusting independent page
snapshots or an exported long-lived transaction. Its
[multicolumn B-tree guidance](https://www.postgresql.org/docs/current/indexes-multicolumn.html)
supports equality reverse keys followed by complete ordering keys. The chosen
composition and capacity estimates are design deductions, not measured production
results. Large continuously changing owners can repeatedly invalidate reviews;
this is explicit unavailability, not optimistic approval. Source/diff inspection
and production generation are the only evidence in the implementation phase;
concurrency, privacy, expiry, rejected-state, installation and capacity acceptance
remain deferred under the execution workflow.

### Group delta and explicit-ceiling evaluation

`group-impact-delta.ts` decodes the complete private discovery store using native
head, sealed permission snapshot, admission and selection schemas. It computes
before/after contributions per source, logical target path and private recipient.
A contribution retains all direct/inherited paths, exact admission generation,
selection and selection-set versions, current role activation, frozen permission
approval, representation conditions and exact parent lineage/bases. Representation
permissions remain a ceiling on acting for the Entity; they are not added to the
Entity's resource permissions or the operator's unrelated direct rights. Target
paths remain symbolic; no subject-by-corpus-resource ACL matrix is created.
These are complete changed **source contributions**, not a materialized union of
all unrelated grants or a claim that every contributed permission is currently
exercisable. Unchanged sources and independent deny overlays remain in their owners.

Discovery additionally captures selection-set snapshots and bounded recipient
rosters for affected representation edges. A dependent representation losing its
parent basis can affect recipients outside the moved subtree. Group roster work
visits only child/selection indexes; all-member work pages the existing
`(scope_id,subject_id)` membership key. Neither recursively discovers unrelated
assignments. Exact retained parent terms cannot follow a newer revision. Existing
reviews without these required facts fail unavailable and must be rediscovered.
Membership transitions now touch the scope tree witness, including absence, and
binding-scope transitions have a dedicated witness for negative manager discovery.

`group-impact-evaluation.ts` owns one resumable evaluation per exact complete
review. Delta compilation is atomic; no partial delta is published if decoding,
cardinality or work budgets fail. The durable effect store has an ordered complete
payload digest and byte/count checks. Every later consumer checks the exact review,
proposal, original principal/selected subject and topology-management source digest,
including its selected binding terms, role version/revision and representation path.
An evaluation request advances at most sixteen source effects with a retry-safe
page version. Changed/expired witnesses invalidate the whole review, including
previously covered pages. Budget/missing evidence remains unavailable; explicit
absence of a complete ceiling remains denied. Inspection never promotes an empty
page, partial processing or an unavailable effect into completion.

For every gained named-role recipient/path, the evaluator requires current
`access.role-binding.manage` at the target and calls `findRoleAssignmentCeiling`
with the entire effective after-set, not only newly different permissions. The
finder requires one immutable approval for an exact current manager binding/terms,
named role, target, lifetime and recipient; approvals are never unioned. Manager
data permissions are not intersected with the role being assigned. Scope-member
approval retains an exact active admission. A Group/all-member ceiling can cover
an individual through that exact **pre-change** admission and current membership.
Group approval additionally requires the source to remain that same dynamic Group;
a direct subject grant cannot discard the approving Group dependency. In particular,
the proposed topology cannot bootstrap membership in its own approving Group.
Manager bindings, roles, memberships, trees, selected representations and complete
ceiling snapshots retain the original review visibility boundary and earliest clock.

Current source authority and recipient read/write/contribute eligibility are
reloaded under their native fences. Native resource lifecycle, permission
applicability/delegability and bounded deny overlays are loaded independently of
ceiling coverage. Deny overlays retain their own permission/path rather than
clipping the confer request. They are not cached as approval across transactions.
The bounded `mixed-realm-access-manager.ts` reader composes native selected-subject
ownership, RoleBindings, retained literal grants and native member admissions for the
nonrecursive Realm access-manager userset. It never maps an Entity to an assumed
private self-account. All-scope representation resource-policy expansion remains
unavailable for both gains and losses; it needs a bounded owning-root inventory. Current policy outcome
is a separate inspection field, and every response says `admission: not-admitted`.

Private production endpoints append `/evaluation/pages` (POST) and `/evaluation`
(GET) to an exact impact-review URL. They require fresh `access:manage`, the
proposal's current reparent/retire authority, and original attribution; starting
an evaluation also requires the existing private review read boundary. Inspection
returns only review-local random ids, kind, path/permission counts and decisions,
not private recipients, source ids, target scopes or permission names. Evaluation
completion is a prerequisite, not an independent approval or mutation receipt.

`lockCompleteGroupImpactEvaluation` is the narrow handoff to protected recovery.
It returns the exact effect digest, private contributions, selected ceiling ids,
current policy and retained source admissions in the same transaction. It returns
no mutation admission SQL. Its caller must promote the complete native mutation
fence closure before entry, independently establish recovery and approval policy,
and revalidate source authority, policy and all deadlines at the final effect.

For representation confer, the evaluator requires current
`access.representation.manage` at the represented Entity root. For ceiling recipient
expansion it requires current `access.assignment-ceiling.manage` at the ceiling
scope/path. These effects become `approval-required`; they no longer report an
unimplemented approval owner. A complete evaluation still requires the independent
acknowledgement below before any populated effect can execute. Named-role effects
retain their existing explicit ceiling and reselect that same ceiling at consumption.

Limits remain 4,096 discovered owners, 32,768 facts and 16 MiB discovery payload.
Compilation reads at most 328 indexed fact pages once and admits at most 65,536
membership/path visits, 4,096 effects and another 16 MiB encoded effect payload.
The per-advance integrity read is bounded by that whole effect store; it is not
constant-time pagination. Sixteen effects may each invoke the existing 256-candidate
manager/approval readers with their permission-vocabulary bounds. Final policy
loading allows 256 distinct subjects/dependency subjects, 64 scopes/management
paths, 256 restriction candidates per target, 4,096 total masks, 64 resolved restriction Realms, 256 Realm/subject
membership probes and 65,536 policy visits. Overflow is unavailable. Decoded-object memory, indexes and WAL add to the
32 MiB encoded discovery/effect budget; no runtime memory measurement is claimed.
The existing 16-review/principal intake, fifteen-minute lifetime and one-day cleanup
remain. Cleanup removes at most 100 effects plus one evaluation head alongside the
prior 300-row child budget per tick, with no unbounded cascading effect deletion.

Keep the 500,000,000-row baseline and 3,000,000,000-row estimate. The new active
restriction `(unit_id,id)` index has one entry per nonrevoked mask: at 64 estimated
bytes/entry the all-active case is 32 GB / 192 GB before bloat, WAL, replicas and
reserves. Multiply by the active fraction. The binding-scope witness adds O(1)
write amplification per scope transition; membership changes add one scope witness
upsert. A hot scope can invalidate concurrent reviews and contend on that witness;
there is no per-review or per-recipient writer fanout. Deployment index installation
and widened control-table constraints still need a measured installation/rollout
plan before corpus-scale deployment. Persistent over-budget or repeatedly
invalidated reviews require a partitioned/review-epoch protocol, not raised limits
or partially approved pages. No throughput or capacity acceptance is claimed.
This implementation reuses the staged-discovery evidence above; source/diff review
and necessary artifact generation do not qualify tests, types, replay, concurrency,
recovery or production behavior under the current paused verification phase.

### Direct and inherited Group membership

A direct Group selection belongs to one exact membership admission and one Group
in that same scope. Each selection keeps its own control version and immutable
assign/remove/prune receipts. Its selected flag is distinct from effectiveness:
current use additionally requires the same active admission, an active Group and
the owner's current eligibility/restriction policy. Remove/reassign advances the
selection version; dependent grants must check that exact version before use so
that an old assignment cannot revive.

An admission initializes an empty selection-set fence and its scope tree if absent.
Every selection effect advances the set version after final pre-change admission.
A current read locks the tree, enrollment and selection set; missing set state is
unavailable, not an empty authorization result. This protects existing admissions
against future selections and stale stronger-isolation snapshots. The broader
missing-enrollment/scope-subject negative fence remains a separate requirement of
complete authorization loading; this primitive does not establish that closure.

Keep at most 64 physically selected direct Groups per admission generation. Query
that bounded set before filtering retired Groups or computing at most eight
ancestor levels. Direct and inherited paths remain distinct, including when a
Group is reached both ways; permission use deduplicates matching Group grants.
An incomplete path or exceeded work budget is unavailable, never a partial allow.

Pruning is an explicit bounded maintenance operation that closes a selection only
when its Group is terminally retired or its admission can never become current
again. Temporary restrictions or unavailable evidence cannot justify pruning.
Single-selection commands preserve their own pre-change admission and operation
receipt; an owner can orchestrate bounded cleanup before retrying a full selection
budget. Ending enrollment or retiring a Group invalidates effectiveness immediately
without synchronously rewriting a whole roster. History and private attribution
remain retained after cleanup.


### Managed direct selections and private roster API

`group-selection-management.ts` composes already admitted membership selections;
there is no enrollment, invitation or writable all-members command in this owner.
The separate `access.group.membership.manage` permission operates at
`["groups", groupId]`. It is necessary alongside Group read, fresh first-party
session admission, current operator/selected-subject/owner policy, complete impact,
explicit named-role ceilings, one independent complete approval and preexisting
protected recovery. Even an empty selection impact follows this admission path.
Known recipient suspension/closure blocks assignment; removal and terminal prune
can still revoke an ineligible recipient's selection. Unknown recipient policy
remains unavailable. The selected subject's policy deadline is checked after
recovery as well as before the actual effect.

Selection proposals extend the existing private impact review with exact enrollment,
admission generation and expected direct-selection version. FK alternatives bind
immutable admission receipts to either a Group lifecycle event or an exact Group
selection event; a generated topology-event discriminator keeps those alternatives
exclusive. Receipts survive disposable discovery cleanup. Original reviewers can
refresh a five-minute recipient selector using the retained review or its immutable
receipt, so lost-response retries remain possible after remove/prune and review
cleanup. Retries reauthorize the current actor and resolved recipient and preserve
original command attribution; they do not reopen consumed impact evidence.

The compiler changes only the selected direct edge, keeping its other inherited
paths and incrementing the selection-set witness. A set revision is completeness
evidence, not a newly conferred path by itself. Remove/reassign cannot reactivate
any binding or representation depending on an old exact selection version. Related
representation descendants retain their exact parent bases and recipient rosters.
Manager-binding changes also retain attached ceiling confer effects, including the
ceiling's full symbolic recipient predicate and lifetime limits; these are confer
capabilities, not another copied recipient roster. Existing all-scope representation
policy remains unavailable, as do incomplete/over-budget discovery, absent explicit
ceilings, missing independent approvals and missing pre-change recovery paths.

All routes below are relative to `/api/v1/access/{scope}/groups/{groupId}`; `scope`
comes from `POST /api/v1/access/scopes/resolve`. Public Fetch, TanStack and
`packages/api` clients are generated from the same route owner.

| Operation | Route / input and result |
| --- | --- |
| Choose an admitted recipient | `GET /roster?view=admitted`; requires Group read and membership management. Current scope admissions yield Group-purpose opaque recipients, private context-local correlation keys, subject kind and exact active generation. No private account id, subject id or account/Profile association is returned. |
| Inspect direct/current inherited roster | `GET /roster?view=direct` or `view=inherited`; the latter includes the root's direct rows and descendants' inherited rows. Each selected path is a separate row, including duplicate direct plus inherited participation by one recipient. |
| Inspect stale cleanup candidates | `GET /roster?view=direct&includeStale=true`; additionally requires membership management and returns physical stale selections with generation/version and terminal status. |
| Read selection preconditions | `POST /selections/query` with `{ recipient, generation }`; returns physical selected/version, set version, active generation and terminally-stale status. An absent slot has version zero. This is not an effectiveness receipt. |
| Start selection impact | `POST /selections/impact-reviews` with `{ reviewId, recipient, generation, expectedVersion, operation, expectedGroupVersion, expectedTreeVersion }`, where operation is `assign`, `remove` or `prune`. Group/tree preconditions come from `GET /impact-context`. |
| Discover/evaluate/approve | Use existing `POST /impact-reviews/{reviewId}/pages`, `POST /impact-reviews/{reviewId}/evaluation/pages`, inspection, approval-proposal and approvals routes. The independent proposal includes a selector minted for that approver's current context and the exact target generation/version. Page requests supply `expectedPageVersion`; continue only while discovering/evaluating. |
| Apply the selection | `POST /selections` with `{ operationId, reviewId, recipient, generation, expectedVersion, operation }`; atomically writes one selection and both receipts after complete admission, then checks native recovery in the actual resulting state inside the savepoint. |
| Refresh the private target | `POST /impact-reviews/{reviewId}/recipient`; original reviewer only, with current Group read and membership management. Returns a fresh purpose-bound selector even for retained consumed receipts. |

Before starting a review, eligible recovery operators register each needed root
through `POST /api/v1/access/{scope}/recovery-paths` with `{ pathId }`. Independent
approvers obtain their own credential-bound scope locator, inspect the complete
proposal, then submit `{ approvalId, proposalDigest, effectDigest }`. An updated
selector can replace an expired token when retrying the exact same operation:
tokens are locators, while the decoded membership/generation/selection and actor
form the command identity. No client-supplied private subject/principal id is accepted.

Roster cursors encrypt the private keyset and bind the principal, exact credential
proof domain, normalized selected authority, scope, Group, view and stale mode.
Their lifetime is five minutes. Every page reauthorizes disclosure; a tree epoch
change produces a conflict. Enrollment and selection updates use live keyset
semantics rather than a retained cross-request snapshot. Empty pages can have a
continuation, and clients must follow it. Direct candidates use the selected
`(group_id,membership_id,generation)` index; admitted candidates use the active
`(scope_id,subject_id)` index. Limits precede joins, eligibility and deduplication.
Each page hydrates at most 100 candidates, with at most one additional
selection sentinel across the entire page and at most 100 child-index seeks;
at most 101 physical selection candidates are read before filtering. The encrypted DFS stack has at most eight
frames. Paths retain direct selection generation/version, set version and every
Group/version through the requested root. Subject policy retains its existing
256-owner and 512-enforcement candidate limits; overflow is explicit unavailable.

Keep the 500,000,000-row baseline and 3,000,000,000-row estimate. This slice adds
three nullable 8/16-byte selection fields per retained review and nullable
membership/generation plus the stored topology discriminator per admission receipt;
there is no roster projection or per-recipient writer fanout. Existing indexes
bound reads, and each selection updates its head, immutable event, set witness,
Group/membership impact witnesses and one admission receipt. Recovery comparison
normalizes only the exact target set's expected one-version advance; exact admission,
selection versions and a surviving original path remain required. With an estimated
additional 32 bytes per receipt including its stored discriminator, an all-receipt
500M/3B scenario adds roughly 16 GB / 96 GB before alignment, indexes, bloat, WAL,
replicas and reserves; actual incidence and storage need measurement. The fixed
review/effect budgets above still apply and may reject high-fanout dependencies.
The new typed migrations and all three client generators are implementation
artifacts. Tests, fixtures, typechecks, lint validation, builds, replay, concurrency,
recovery, capacity and browser qualification remain deferred in implementation.


### Populated Group production admission and protected recovery

`group-admission.ts` owns the private acknowledgement and final mutation composition.
One independent accountable principal must acknowledge the **whole** exact proposal,
including all changed contributions and all confer targets. Different incomplete
approvals cannot be stitched together. The initial fixed threshold is one independent
principal in addition to the initiating operator. Equality is private principal
identity, not Entity identity; this is not proof of distinct natural people.

An approver inspects `/impact-reviews/:reviewId/approval-proposal` and submits its
`proposalDigest` and `effectDigest` to `/approvals` with a retry `approvalId`.
Both operations require fresh first-party session authentication, current Group read
and action-specific reparent/retire authority, plus every applicable confer target.
The immutable record also fixes selected subject, exact credential secret digest,
management/owner/role/representation sources, membership and selection revisions,
tree epochs and the complete retained discovery witness digest. The record stores
no raw credential. Revalidation uses server-owned proof captured at approval, never
client-submitted proof. A changed source or witness invalidates the approval; a retry
returns the original receipt without extending its lifetime. One review/principal
unique key prevents persona switching from multiplying approvals.

The initiating principal/subject, active selected subjects in the moved/retired subtree,
changed recipients/dependency subjects, represented
Entities, and their potentially controlling operators cannot supply independence.
Controller discovery conservatively follows active representation recipients through
at most eight layers, 256 affected subjects, 256 Entities and 256 combined
grant/recipient visits. Subtree roster discovery first reads at most 4,097 indexed
review-local subtree keys and rejects more than 4,096. For each admitted key it
probes the existing `(group_id,membership_id,generation) WHERE selected` index,
ordered by its remaining key columns, with the remaining candidate allowance plus
one sentinel. Across all Groups it reads at most 257 physical selection rows and
rejects the 257th **before** joins, current-generation filtering or deduplication.
Stale generations and repeated selections for one subject consume the same budget.
Only a complete candidate set may then hydrate at most 256 distinct membership
heads by primary key under shared locks and retain the currently active generation.
Complete review witnesses and the clock are rechecked before and after these reads.
Thus each independence evaluation has at most 4,096 bounded roster index seeks and
256 membership-head lookups, even when almost every subject is duplicated; no global
join, DISTINCT or subject sort precedes the candidate limit. Dynamic
Group recipients are conservatively covered by their active scope membership;
conditions are not used to assert independence. This can reject an unaffected
operator in a large/shared scope; overflow is unavailable. The native Entity and
membership-change fences retain negative discovery. Changing any selected approver
binding or representation contribution is rejected, so a newly conferred recipient
or authority cannot authorize its own expansion.

`GET /approvals` is private to the original reviewer with current Group-read authority.
It returns only local approval IDs, deadlines, revocation flags and currently valid
counts. Each counted approval is reauthenticated and reauthorized. The original
approving principal may revoke its receipt with a fresh session and retry operation
ID even after losing its selected Entity or role. Approval expiry is the earliest
review, fresh-session, credential, source or current-policy deadline; it cannot be
renewed under the same review/principal. Expired/revoked receipts remain historical.

The `access_recovery_policy` owner selects fixed `native-repair-v1`: at least one
currently exercisable pre-change repair path must survive at each affected logical
root. A root is the Group scope, every effect target scope, and every represented
Entity root. The policy is immutable; this slice exposes no command to weaken or
disable continuity. Each path is enrolled by its own authenticated operator through
`POST /:scope/recovery-paths`. It requires current root-level
`access.role-binding.manage` and `access.assignment-ceiling.manage`, plus
`access.representation.manage` for an Entity root. Ownership can supply these
permissions, while Entity use still needs an actual authorized representation path.
Registration is evidence of a current repair route, never a new grant. Its lifetime
is at most fifteen minutes and also bounded by the fresh session and native sources.
At most eight live candidates exist per scope; the private operator can revoke its
own path. The enrollment transaction must be visible in the original review snapshot.
Operators enroll routes before starting the review, and may register a
new route after expiry for a later review.

Consumption selects an existing candidate per root from the pre-change state and
loads complete native owner, RoleBinding, representation, membership, eligibility,
lifecycle and credential policy. For a selected source appearing as a changed contribution, it requires the selected
management permission before and after and chooses an exact original enrollment/
ancestry path present in both path sets. Redundant paths may change while that
original path survives. It keeps exact source/generation/selection evidence. It does **not**
assume continuity because a source was absent from the delta, nor subtract that
delta from a supposed effective ACL union. After the actual Group head/tree/height
writes, it re-runs native authority under the resulting topology and requires the
same selected repair sources. The expected target-tree epoch and derived member-set recipient changes are excluded
only from this after-state identity comparison; the selected original path intersection
and current native recipient/path policy are both required. An alternative candidate is considered before mutation if an older
candidate is denied, expired or unavailable. No new after-state source rescues a
failed pre-change selection.

The transaction promotes the written Group/tree/ancestor and impact-witness fences,
discovers/promotes the bounded confer roots, then retains all native authority,
credential, enrollment, representation, policy, approval and recovery locks. The
primitive's final SQL checks exact review/tree/source evidence, approval and earliest
clock before its head effect. An after-effect callback remains inside the primitive
savepoint, records an immutable admission receipt and performs the final credential,
policy-clock and recovery SQL recheck after all waits. Any failure rolls back both
receipts and every topology/height effect. Deadlock or serialization failure retries
the complete transaction, not a subset of decisions. Receipt replay compares the
original command and review under live management authority without reapplying it.

Remaining boundaries have specific owners: all-scope representation needs a
bounded target/recovery-root inventory and full symbolic resource policy; over-budget
controller graphs need partitioned private accountability discovery; recovery with
no surviving original path needs a reviewed replacement-path protocol. These
are not a blanket prohibition on populated Groups. Missing registered recovery policy
is unavailable; a known policy without a surviving path or independent approver is
denied. Nonleaf retirement remains an invalid Group transition. Broader representation
creation/lifecycle APIs and other IAM owners retain their own scope; these Group
commands do not claim to finish unrelated management operations.

Capacity remains bounded without a global ACL. The 500,000,000-row baseline and
3,000,000,000-row estimate still apply. A review admits 64 approval rows; at the
9 KiB credential/selection JSON cap plus roughly 1 KiB metadata, that is approximately
640 KiB per review before indexes/WAL/decoded objects. Up to 64 roots × 8 recovery
candidates implies 512 bounded candidate reads, about 5 MiB encoded candidate payload
at the same estimate. The global relations are not bounded by those per-root caps:
at 10 KiB per approval/path row, 500M / 3B rows would require approximately
5.12 TB / 30.72 TB payload **per relation**, before storage overhead. Three estimated
64-byte path indexes add 96 GB / 576 GB; two approval indexes add 64 GB / 384 GB.
The fixed recovery-policy row plus primary index is estimated at 128 bytes, or
64 GB / 384 GB for 500M / 3B registered roots. Fifteen-minute validity and bounded
expiry cleanup limit ordinary live populations, but an overloaded cleanup worker
can retain a backlog; retention throughput and management intake need deployment
budgets before approaching these counts. Complete approval inspection can make 64 × 66 authority reads;
recovery can make 512 × 3 repair reads, each retaining the existing 256-candidate
native reader ceiling. These are upper-bound compositions, not latency measurements;
hot-scope serialization and repeated native reads need G2/G3 workload qualification.
Deployments must rate-limit management intake and partition persistent over-budget
work rather than raise these limits. Indexed review/scope/expiry reads bound cleanup:
one tick removes at most 100 recovery paths, 64 approvals and the prior 402 review
rows. Proof payloads become eligible for bounded cleanup after one day; durable admission receipts retain only
review/operation/digests and opaque approval/path IDs. Revocation and account erasure
immediately invalidate live proof via native credential/principal policy before cleanup.

For long-lived admission receipts, approximately 0.5 KiB metadata plus up to 65 UUID
handles (about 2.6 KiB JSON) gives a conservative 3.1 KiB payload bound: about 1.55 TB
at 500M receipts or 9.3 TB at 3B, excluding tuple/index/WAL/replica reserves. Two
64-byte unique-index entries add about 64 GB / 384 GB. New active-controller
`(entity_id,id)` and active-membership `(scope_id,subject_id)` indexes each add
approximately 32 GB / 192 GB at 64 bytes per all-active entry; multiply by each
relation’s active fraction. They avoid scans through inactive history for bounded
controller discovery. Mixed Realm grant probes reuse the three existing active
subject-kind indexes and reject more than 256 candidates before permission filtering.
The admission receipt relation grows per admitted command, not per affected corpus resource. A deployment approaching those
volumes needs retained-receipt partition/archive design; the current indexed table
has no measured corpus-scale installation, latency or throughput acceptance.

Design evidence reviewed September 15, 2026: [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
supports exact server-owned transaction acknowledgement, limited lifetime and final
execution authorization. [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
supports retained conflicting row locks and whole-transaction deadlock retry. Our
fixed independent threshold, conservative controller closure and native repair path
selection are project policy choices, not guarantees established by those sources.
Source/diff inspection and production generators do not qualify correctness,
TypeScript, migration replay, recovery, races, privacy or capacity. Tests/fixtures,
static checks, builds, database checks and browser QA remain deferred under the
current implementation phase.

## Roles and grants

Permissions are the canonical atomic operations in [@rezics/access](../../libraries/access/README.md).
A Role is a persistent named permission set, with immutable definition revisions
and one enabled head; built-in roles and custom roles share explicit applicability.
Custom roles compose registered permissions, not arbitrary code or unknown strings.
New permission keys do not enter old roles or external approvals through wildcards.

A RoleBinding binds a typed recipient (AuthPrincipal, Entity or MemberSet), role,
target scope, validity and conditions. One subject can have several bindings and
direct atomic grants remain explicit exceptions. A read-only role adds reads; it
does not negate another valid edit grant. Matching grants combine only within the
selected authority context. Hard actor/resource restrictions apply independently.

Role reuse does not widen a binding's resource scope. Local role-head updates may
affect local bindings after authorized activation. Cross-authority grants and
external delegations preserve the granting resource authority's approved permission ceiling;
expanding a role cannot exceed that ceiling without new approval. Copying a role
template creates a separate definition unless an explicit dependency was requested.
Role retirement invalidates its bindings without silently substituting an admin
or broad default role. Group changes and definition changes remain distinguishable.

Using a permission, defining a role and assigning it are distinct powers. A
delegation manager can be authorized to assign a named role without personally
using its data permissions. Validate the explicit assignment ceiling, target and
recipient constraints. Role editing, privileged group enrollment, reparenting and
representation changes must not bypass those checks. Evaluate mutation authority
from the pre-change state; a proposed change cannot authorize itself.

Ownership continuity is domain-specific. A single accountable owning Entity can
have multiple controllers; domains may also permit multiple protected owner
relationships. Preserve at least one valid recovery path under the selected policy,
not necessarily a direct AuthPrincipal resource grant. Cyclic control alone is no
recovery path. Credential replacement, recovery and high-impact role changes can
require fresh authentication or independent approval without making Entity
recipients categorically ineligible.

## Scoped role definition protocol

The [role store](../../services/main/src/services/authorization/roles.ts) separates
role identity/control version, sealed definition revisions, explicit permission
members and private command receipts. A proposed revision does not replace the
active definition. Activation explicitly selects one sealed revision; retirement
is terminal for that role identity and keeps its definitions and last selection.
Recovery can create a new role and admit new bindings rather than reviving retired
assignments implicitly. Labels such as “Owner” confer no permissions.

A permission reference contains its registry family (`unit`, `platform` or
`management`) and key. The family is part of the key in storage, digests, ceilings
and operation-bound decisions. It cannot be inferred from text alone: the existing
Unit `realm.members.manage` implies Unit read, while the identically spelled
platform capability has a different implication closure. Flattening those values
would lose meaning. The [canonical management vocabulary](../../libraries/access/src/management.ts)
keeps role definition, activation, assignment and assignment-ceiling management
separate from using the role's data permissions. Existing registries retain their
own implications; a role stores authored references, not a rewritten inferred set.

Each definition has a bounded label/description and exact permission count/digest.
Permission rows use `(role_id, revision, family, permission)` keys. Sealing verifies
the complete set and prevents later insertion, deletion or rewriting. Unsealed
construction state and an empty initial role head cannot commit. The private event
for each control version retains authenticated operator and selected subject;
a direct principal subject must match that operator. Those audit references do
not themselves prove permission or representation.

Control versions advance for creation, proposed revisions, activation and retirement.
Definition revisions use the control version that created them, so activation events
can leave gaps between definition numbers. Every head transition has an exact
immutable event. Stable operation IDs are unique within a role; an exact retry
returns the original receipt, while changed intent/context is rejected. A receipt
reports its original outcome, not the current role state or continuing authority.

The command primitive requires a caller-owned, side-effect-free SQL admission
predicate. The owner first discovers and locks the complete authority dependency
set, promoting locks needed by the mutation before taking shared read locks. The
primitive checks admission before provisional writes, after its role-lock waits and
inside the final head update. Unknown admission stays unavailable. Its savepoint
removes provisional records even when a surrounding transaction catches the error.
Current authorization remains required when replaying a stored receipt. These
placement guarantees do not implement membership/representation loading or an
assignment ceiling: the owner must supply their complete current policy.

An active snapshot read holds the role head's shared lock for its owning transaction,
serializing activation/retirement. Exact historical reads remain distinct. No reader
substitutes the latest proposal or a broad preset when the role has no active head.
Role assignment, impact admission, effective-grant queries and APIs require their
own native tests before runtime activation. The [role storage envelope](identity-access-capacity.md#role-definition-storage)
counts permission members and events separately from definition headers.

### Explicit permission approval snapshots

The assignment-ceiling store records an immutable institutional approval at one
resource authority root, naming an exact manager RoleBinding/terms revision and
one role. It bounds target paths, recipients and explicit approved permissions.
Recipients can be one subject, one Group, an all-members set, or admitted subjects
of one specified kind in one scope. The latter requires resulting subject bindings
to retain their exact admission key; an enrollment-only preflight cannot create an
independent grant that survives departure.

Approval validity determines when the manager may act. Optional maximum grant
duration and absolute grant-end limits separately constrain resulting assignments;
temporary management authority need not automatically terminate durable assignments.
Changing an approval creates a replacement identity and explicitly revokes the old
one. Revoking/amending the manager source prevents future use of that approval,
without retrospectively revoking institutional assignments already admitted.

Confer matching requires a current native management grant for the selected subject
and one complete matching ceiling. It does not require the manager to hold the
role's data permissions and does not union partial approval constraints into a new
approval. Binding management is evaluated at the assignment's target path; role
activation uses the role-control path `roles/<role-id>` while separately reviewing
each affected binding's data target and recipient. Approval management, resource
grantability, independent approval, continuity and complete mutation impact remain
owning-policy requirements; this matcher alone is not command authorization.

A permission approval records an explicit, family-qualified closure at its
admission time. Ordinary role definitions keep authored permissions. When the
resource authority approves a cross-authority binding or external delegation,
its persisted ceiling includes the then-approved prerequisites; no wildcard or
role-head pointer substitutes for that snapshot.

At use time, intersect the current role's closure with the stored approval without
expanding the approval itself. Additionally withhold any permission whose current
prerequisite closure is not fully inside the stored approval. For example, an
approval containing only `unit.update` but missing its required `unit.read` does
not permit update. Expanding the approval after loading would silently manufacture
that missing read. This rule also prevents a future implication change from adding
unapproved access. Permitted prerequisites can remain effective independently when
the broader mutation is clipped. Empty approval permits nothing, and a ceiling
without a current matching grant grants nothing.

Assignment-impact admission checks the whole proposed closure against the manager's
explicit ceiling and rejects excess; it must not silently clip the requested
assignment. Runtime effective use may clip an already-admitted dynamic role under
its frozen permission ceiling. These are distinct operations in the shared pure
contract. Scope, recipient constraints, validity, conditions, grantability and
current manager/representation authority remain independent admission requirements.
Local bindings can follow a locally activated role only through the separate
role-activation impact checks; the pure set operations do not authorize activation.

The [shared helpers](../../libraries/access/src/permission-ceilings.ts) return
canonical frozen values, validate all references before
returning a result, and cap input length at the registered vocabulary size. Tests
cover both registry families with identical spellings, independent management
powers, role growth, missing prerequisites, invalid sets and every registered
permission. They qualify the set algebra, not persistence, authority loading or
complete role-binding admission.

Primary evidence revisited September 15, 2026: Kubernetes
[role and binding escalation prevention](https://kubernetes.io/docs/reference/access-authn-authz/rbac/#privilege-escalation-prevention-and-bootstrapping)
separates role mutation and explicit binding power; REZICS additionally requires
recipient/scope ceilings and Group/representation impact checks. AWS
[permissions boundaries](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html)
distinguish an authority limit from an identity-policy grant. REZICS uses explicit
frozen references and does not import AWS resource/session-policy exceptions.
The prerequisite-preserving intersection above is REZICS's selected rule; neither
external system establishes its correctness or performance here.

### Scoped RoleBinding storage protocol

A binding's role, target root and typed recipient are immutable identity choices.
Changing one creates a new binding. Recipient alternatives are a private subject
value, a same-scope Group key, or the owning scope's derived all-members set. The
latter has no copied roster. Principal and Entity recipients remain distinguishable
through the subject registry. A Group recipient is not an authenticated operator.

Target paths, validity and permission policy live in sealed immutable terms
revisions. Create/amend events introduce terms at their own control version;
revocation names retained earlier terms. The narrow head selects its exact sealed
terms. Revocation is terminal; regrant creates a new identity instead of reviving
old dependent references. A receipt preserves its original outcome and private
operator/authority-subject context while retry still requires current admission.

Validity is a half-open interval with an inclusive start and exclusive optional
end. A future start does not activate authority early. Target paths retain at most
eight bounded segments; root/sibling/path comparisons use the canonical scope
semantics. A role in another root does not change the binding's target root.

Local-role policy requires the role, binding target and any recipient Group/member
set to share a root, and still needs authorized role-activation impact checks.
A cross-authority binding uses a
sealed, explicit resource-authority permission approval. Loading it constrains the
current role closure using the qualified ceiling contract. Empty frozen approval
grants nothing; local following and empty frozen approval are distinct states.

Target-root binding fences serialize binding writes and protect negative candidate
reads. A missing fence yields unavailable, not an empty proof. Initialize empty
fences when a root is admitted so ordinary reads need not create mutable state.
These fences cover binding candidates at that exact root only; complete policy
must include inherited resource roots, restrictions, memberships and representation
dependencies. A current role reader locks the role head as well as the relevant
binding scope, with overlapping mutation modes promoted by the owning command.

Membership-dependent subject bindings require exact admission and optional exact
Group-selection revision keys. Institutional issuer attribution is historical
accountability; dependent delegation carries explicit live authority sources.
Conditions, dependency lineage, assignment ceilings and recovery continuity must
be reconciled with the representation owner before dependent bindings or APIs
activate. Initial table shape and administrator-predicate fixtures alone do not
qualify the full binding contract or any current management decision.

Sealed binding terms retain an optional recipient eligibility dependency: a concrete
membership/admission key and, when required, the exact direct Group assignment
event. Only subject recipients may select this dependency, and the membership
must belong to that exact subject. Null explicitly means the binding has no such
recipient dependency; an empty or missing Group does not create an all-members
grant. A Group dependency references an `assign` event, never a removal/prune.
The head effect retains shared tree, enrollment and selection-set fences and
checks the current generation, selected assignment version and active Group.
Later policy must repeat those checks; persisted active state alone is not authority.
An amendment changes these terms under new current admission; it does not mutate
the old dependency. Revocation can close a binding whose eligibility already ended.

The native positive-binding reader composes recipient-scope discovery, selected
subject membership/Group resolution and batched current role/approval hydration.
Pair-local shared/exclusive advisory fences cover absent as well as present
enrollments; membership commands and native guards take the exclusive side.
Composed membership reads require READ COMMITTED for new statement snapshots after
waits. Hash collisions only serialize unrelated keys; they cannot alias subjects.
The reader takes target fences even for empty candidate sets and checks discovered
binding versions after waits. A changed discovery requires whole-transaction retry.
Roles load by exact current definitions, frozen approvals are never expanded,
and expiry uses database time after local locks. Retired/revoked/future/expired
bindings contribute no positive permissions. Native queries do not expand rosters.

This is the positive RoleBinding contribution, not a final access decision. Resource
owners still supply complete inherited roots, current actor/credential/representation
facts, restriction precedence, live delegation, conditions and assignment admission.
Mutation owners promote overlapping locks and revalidate their complete dependency
closure. Member sets come from the selected subject; operator membership cannot
fill a represented Entity's missing grants. Runtime adapter activation and native
acceptance remain pending.

For the negative-enrollment fence, PostgreSQL 18's
[transaction advisory locks](https://www.postgresql.org/docs/18/explicit-locking.html#ADVISORY-LOCKS)
and [READ COMMITTED statement snapshots](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED)
were reviewed September 15, 2026. A stored fence per possible scope/subject pair
would require mutation on first negative read and retained rows for nonmembers;
a scope-wide exclusive enrollment fence would serialize unrelated members.
The selected pair-local transaction lock avoids both costs, but every writer must
participate and advisory locks consume shared lock-manager capacity. The native
guards enforce participation; race and capacity qualification remain pending.

The immutable role/recipient/target choice makes assignment identity and revision
lineage explicit. An alternative permits all three to change inside one versioned
object, but every dependent proof would then need to distinguish a terms edit from
replacement of the grant's subject and authority root. New binding identities keep
that distinction in concrete references at the cost of an additional retained
identity on replacement. Batch assignment remains orchestration over individual
bindings, not a mutable recipient array on one grant.

Kubernetes [RoleBinding semantics](https://kubernetes.io/docs/reference/access-authn-authz/rbac/#rolebinding-and-clusterrolebinding),
reviewed September 15, 2026, independently preserve the referenced role and keep
binding scope separate from reusable role scope. REZICS also fixes each binding's
recipient and target root, and adds revision-bound terms, explicit permission
ceilings, mixed subjects and live delegation lineage. The external precedent does
not qualify these additions; the native binding cases remain required.

## Representation and request evaluation

RepresentationGrant records represented Entity, typed delegate, allowed actions
and target scopes, conditions, lifetime, revision and whether further delegation
is permitted. A delegate may be an AuthPrincipal, Entity or eligible member set.
Managing an Entity's controllers, publishing as it, exercising its security powers
and redelegating those powers are separately grantable capabilities.

Every authenticated operation carries a verified AuthPrincipal, selected authority subject, client/
credential limits, target/action, relevant representation evidence and attribution.
Client-supplied IDs or claims select a requested context; they do not prove it.

Anonymous public reads use an explicit public-audience disclosure path; they do
not fabricate an AuthPrincipal, membership or Entity. Protected effects require
the appropriate authenticated context. An invalid explicit credential never falls
back to a cookie, anonymous access or another identity.

| Mode | Required authority |
| --- | --- |
| Direct | Current target permission of the authenticated AuthPrincipal. |
| Represented | A complete valid path from that actor to the selected Entity for this action/target, and the Entity's current target permission. |

Both modes require current actor eligibility, resource restrictions, credential
scope, applicable App/installation policy and domain invariants. In represented
mode the operator need not personally hold the Entity's resource permissions.
Its unrelated private grants are also not imported into the request. A composite
operation requiring several permissions cannot stitch incomplete proofs from
unrelated identities together; intentionally multi-party workflows specify and
validate each required authorization separately.

Group grants match membership of the selected subject. An operator's own group
membership is not automatically membership of the Entity it represents. Any
supported operator-and-Entity combination is an explicit policy condition.
Public attribution cannot turn a denied direct request into an authorized one.

Chained representation validates each edge's type, scope, expiry, admission and
redelegation conditions. Downstream delegated ceilings can only narrow; intermediate
actors contribute no unrelated resource powers. Bound traversal, reject delegation
cycles and preserve provenance. A graph path or historical JWT actor list alone
is not proof that the path is authorized and current.

Two Entities controlled by the same operator do not count as independent approvers.
Where separation of duty is required, enforce the declared private accountability
identity as well as role eligibility. Distinct accounts do not, by themselves,
prove distinct natural people. Keep this enforcement private and feature-specific;
persona switching does not multiply ballots, quota or independent approvals.

## Durable assignments, dependent delegation and revocation

### Representation persistence protocol

A representation identity fixes the represented Entity, one typed delegate and
optional exact parent grant/terms revision. Its private control receipt advances
sealed terms containing an explicit all-scopes or concrete-root/path target,
half-open validity, literal approved permissions, redelegation and fresh-session conditions, and optional exact delegate
admission/Group eligibility. The head supports create, narrow and terminal revoke.
Broader replacement uses a new identity under current assignment admission.

Narrowing can restrict all-scopes to one concrete root/path, but cannot move a
concrete root to another root or all-scopes. It cannot add approved permissions,
move above the approved path, extend validity, restore redelegation, remove a
fresh-session requirement or remove/change an existing exact eligibility dependency. A previously independent grant may gain
a recipient dependency. Explicit permission membership remains family-qualified;
loading must remove permissions whose prerequisites are not also approved.

A null parent is an institutional assignment. A dependent grant retains its
parent's exact terms for the same represented Entity. Its effect
requires that parent to be current and redelegable, and all child limits to fit
the parent's ceiling. Parent lineage is bounded to eight edges including the child.
Changing the selected parent revision invalidates dependent use rather than making
old descendants follow new authority. Immutable parent choices and current-parent
admission prevent lineage cycles. The Entity control fence serializes all grant
effects and parent revocation without synchronously updating descendants.

Each dependent grant also fixes the private subject whose parent authority it uses.
Creation's selected authority subject must match that value. A subject-held parent
must name the same subject. A Group/all-members parent additionally requires that
subject's exact admission in the parent's recipient scope; a Group parent fixes
the exact direct selection through which the subject reaches that Group. Current
use checks the admission, assignment revision and bounded current ancestry, so
departure, reassignment or reparenting can invalidate the dependent path. These
issuer-basis dependencies are separate from the child delegate's own eligibility.
The historical operator is not substituted for the selected parent subject.

All-scopes is an explicit representation target alternative for ordinary full
Entity control. It permits only the sealed action set and still requires the
Entity's current permission on each actual resource. It creates no resource grant,
imports no operator rights and does not approve future permission keys. Exact
scopes retain concrete private scope FKs; all-scopes has no scope ID or relative
path. The narrow head's target projection must match its selected sealed terms.
An all-scopes parent may issue a narrower concrete-scope child, subject to all
other admission and attenuation rules. RoleBinding targets remain concrete roots.

Allocating a separate representation grant for every resource was rejected because
ordinary Entity use must cover independently authorized resources without per-object
control fan-out. Treating the platform scope UUID as an implicit wildcard was
rejected because it would conflate one authority root with all roots. Google IAM's
[service-account impersonation](https://docs.cloud.google.com/iam/docs/service-account-impersonation)
and [delegation chains](https://docs.cloud.google.com/iam/docs/create-short-lived-credentials-delegated),
reviewed September 15, 2026, separately authorize acting as an identity and accessing
its resources, without importing intermediate account powers. REZICS's explicit
target union and immutable permission approvals are its own additional constraints;
that precedent does not qualify native scope narrowing or revocation here.

This lineage is distinct from a request's path through Entity delegates. The native
store checks structural limits and parent/admission liveness; the management owner
must also prove that the operator may exercise/delegate the selected parent, admit
the recipient and preserve recovery. A SQL admission expression remains mandatory
before work, after waits and at the effect. Private actor attribution alone is not
admission. Request path evaluation, account/Entity eligibility, private disclosure,
independent approval, live role-binding dependencies and erasure/recovery integration
remain required before activating represented APIs.

Sealed terms reuse the RoleBinding snapshot protocol. Exact parent revision was
selected over following a mutable parent head to keep approved lineage explicit;
the cost is deliberate reissuance after a parent's terms change. Neither this
choice nor the storage implementation qualifies the target race/recovery cases.

### Selected representation paths

The selected references form a bounded request subgraph, including any intermediate
Entity grants used by a path. A base starts at the request's represented Entity;
an Entity delegate continues through a separately selected grant for that Entity.
Each nonterminal edge must permit redelegation and every edge must independently
cover the requested action/root/path and fresh-session condition. A Group/member-set
edge can terminate at the authenticated principal or continue through a represented
Entity whose own current membership matches it. The operator's membership is not
substituted for that Entity's membership.

The path evaluator uses trusted native grant and subject facts, with explicit
loaded recipient scopes to distinguish nonmembership from unavailable evidence.
It strips permissions with missing approved prerequisites, preserves denied versus
unavailable outcomes and can select an independent valid basis when another path
is unavailable. Breadth-first traversal retains the shortest certain/uncertain
visit per Entity, excludes cyclic authority and bounds paths to eight edges.
The returned basis covers one operation; it is not an independent resource grant
or a reusable authorization receipt. Credential selection must approve every
selected reference, including intermediate ones, before path evaluation.

The native selection reader locks Entity controls and exact declared membership/
Group dependencies, hydrates selected terms and their literal permission members
in batches, and evaluates current lineage after waits. Its lifecycle outcome is
not yet the full subject/credential/representation decision: native subject policy,
management admission, complete mutation fence promotion, erasure/recovery and API
integration remain pending. Neither source implementation qualifies these paths.

The current representation evaluator now composes those native grant, subject and
membership owners for one operation. It retains parent-subject policy per selected
basis, so an institutional issuer is not imported as a live dependency and an
unrelated failed path does not become a global subject denial. It refreshes subject
policy and lineage liveness after membership waits before evaluating the explicit
subgraph. Authentication supplies the principal and fresh-session facts; resource
permissions and complete command admission still belong to the request owner.

### Assignment lifetime and revocation

A durable institutional assignment is authorized at creation and owned by its
declared institution/resource authority. The operator who issued it is audit
provenance, not a permanent liveness dependency. Their departure does not revoke
every legitimate assignment they made. Pending invitations still revalidate their
captured admission authority before acceptance.

A dependent execution delegation explicitly references its live parent authority.
Ending a required parent, enrollment, consent or installation invalidates the
dependent execution path. Do not silently convert dependent delegation into an
independent assignment; that needs separate current assignment authority.

After a revocation succeeds, requests beginning afterward cannot use that path.
Sensitive mutations serialize with all relevant authority changes and recheck
after waits, immediately before effect. Already admitted mutations either commit
before conflicting revocation or observe the changed authority. Long-running jobs
revalidate before later protected effects; already delivered bytes are not recalled.

The initial single-database implementation uses bounded dependency discovery,
ordered shared/exclusive fences and current-statement reads, with post-lock expiry
checks. Fence/revision closure includes group ancestry, role heads, representation,
actor state and App grants, not just the target ACL. Revalidate the discovered
dependency set after locks; retry if it changed. Missing future deny/membership
rows need their owning fence rather than relying on a row lock that cannot exist.

Private reads, listings, counts, search snippets, exports and cached content use
current disclosure policy. A cache needs a proven dependency/freshness contract;
asynchronous invalidation and token signature validation alone do not suffice.
Unavailable required authority yields an explicit unavailable/denied outcome,
never a stale allow. Recovery replays revocation/erasure frontiers before exposure.

## API contracts

### Subscribe policy integration

The selected [Subscribe contract](subscriptions.md#effective-benefits-and-authorization)
adds a registered entitlement resolver and native benefit audience/condition adapters
under M10, not an already implemented IAM recipient kind. Multiple paid and
complimentary sources can establish one benefit without changing one another's
commercial state. Resource owners approve exact target/role mappings through the
same grantability and assignment ceilings; a seller's plan revision cannot widen
that approval or manufacture another owner's permission.

Personal benefits are verified for the authenticated private beneficiary. They do
not supply a represented Entity's missing native authority, reveal a private
subscriber roster or share one controller's access with another controller.
Ordinary Pro enrollment/attribution still uses this owner's explicit consent,
membership generations and representation. Ending enrollment or changing a ban
does not cancel a paid agreement, while continuing payment cannot revive forbidden
participation. The direct-principal benefit audience must carry an exact native
resource proof before activation; it is not a cached membership boolean.

Benefit source/mapping revisions and expiry are dependencies of protected effects.
Revocation and erasure remain current at reads, writes and later delivery. An
independent gift cannot become an alternative proof for a forbidden operation.
[SUB18-SUB24](../testing/subscriptions-and-pro.md#subscribe-contract-cases) extends
this owner's acceptance when that integration is activated.

### Shared API behavior

API capabilities remain complete independently of GUI disclosure level. Keep one
verified request authority context across owner adapters: direct mode derives its
AuthPrincipal from authentication, and represented mode selects an Entity and
an explicit bounded set of representation references/revisions which the server validates. Public clients do
not submit an internal principal ID to choose their authentication identity.
Recipient selectors for private grants return purpose-scoped opaque handles with
authorized presentation; resolve them privately and revalidate at mutation.

The private selector codec encrypts the subject value and a lifetime of at most five
minutes. Authenticated associated data binds the viewer principal, verified
credential/client audience, canonical authority selection, scope and purpose.
Representation references are normalized as a set for that binding. A selector
from another viewer, context or purpose is invalid; malformed and expired tokens
share one non-disclosing error. Decryption is not current permission or recipient
eligibility, and callers must admit both selection disclosure and later mutation.

Selectors reuse the Collection cursor's per-token HKDF/AES-256-GCM envelope through
one opaque-value owner, with distinct purpose labels. A fresh 16-byte salt, 12-byte
nonce and 16-byte authentication tag avoid a shared deployment nonce counter.
The existing Collection prefix and context remain its own contract. Node's
[HKDF and authenticated encryption APIs](https://nodejs.org/api/crypto.html),
reviewed September 15, 2026, supply the primitives; this does not qualify the new
recipient codec on Bun or its future API disclosure integration. A signed plaintext
handle was rejected because it would expose its stable private subject value.

| Capability family | Required interface behavior |
| --- | --- |
| Usable identities/defaults | List only identities the actor can currently use, with eligible operations and bounded continuation; separately set account/app defaults by revision. No controller-graph enumeration. |
| Enrollment/invitations | Explicit scope, subject type/selector, terms and expected generation; accepted/pending/declined/expired/revoked outcomes remain distinct. |
| Groups/Teams | CRUD, direct membership, parent changes and direct/inherited roster views; each authority-changing command validates its assignment impact. |
| Roles/bindings | Built-in/custom definitions, revisions, scoped assignment, approved ceilings, expiry, retirement and paginated impact inspection. A preset uses these same commands. |
| Representation | List/issue/narrow/revoke grants with represented Entity, delegate, action/resource limit and redelegation conditions. A display-name edit is not control transfer. |
| Effective access | Evaluate the explicit subject, action and resource against current authority; return allowed/denied/unavailable and viewer-safe provenance, never an unrestricted graph dump. |
| Governance/recovery | Separate protected continuity, ownership, private account administration and independent-approval operations with typed current-state preconditions. |

Mutations use expected revisions/generations and stable operation identities where
retry can duplicate an effect. Batch operations preserve per-item context and
document atomic versus partial outcomes; they cannot combine incomplete proofs.
Typed errors distinguish invalid input, stale state, unavailable authority and
denial while preserving private existence. Lists use keysets and explicit
continuation even through empty filtered pages. OpenAPI/SDK and GUI adapters must
preserve mixed alternatives, absent versus empty values and hidden advanced state.

API entry scopes, domain permissions and audience disclosure remain independent.
Possession of an effective-access response is not later write authority; every
effect rechecks the appropriate live context. Fresh-session requirements cannot
be satisfied by API-key or OAuth session emulation.

## Request selection and decision composition

The [requested selection contract](../../libraries/access/src/identity.ts) has two
forms: direct mode contains no private principal selector; represented mode fixes
one public Entity and one to 64 unique exact representation references/revisions.
References are selection bases, not proof of current authority, and public selectors
must preserve their owning privacy boundary. Several independent bases can cover
different operations for the same Entity. A single mandatory basis was rejected
because it would discard legitimate combinations of grants within that context.
An empty set, repeated reference IDs or unsafe revision numbers is invalid.

The [decision model](../../services/main/src/services/authorization/authority-context.ts)
combines trusted owner outcomes bound to the authenticated principal, selected
subject, registry-qualified operation, exact authority-root value and normalized path.
It requires actor eligibility, credential permission and the selected subject's
resource permission for every requested operation. Represented mode additionally
needs a valid selected representation basis for each operation. The operator's
private rights and group membership cannot fill missing Entity decisions.

Credential authority is explicitly operator-wide or bound to a direct/represented
selection. A bound credential cannot switch to private direct rights, another
Entity or an unapproved representation basis. The server constructs this constraint
from the verified credential and its current domain context; a client cannot request
operator-wide credential authority in the selection payload.

Owner evaluators resolve group/role/deny precedence and action-specific conditions
before supplying one final resource/credential decision per operation. Resource
facts retain the operator binding even where authority belongs to an Entity, since
conditions can depend on that operator. A decision for a different actor, subject,
action, root or descendant path is not interchangeable. Conflicting duplicate facts
are unavailable, not a choice of whichever answer allows access. Representation
facts likewise have one current result per basis; duplicate or conflicting revisions
cannot resurrect an old allow. An independent current basis can still authorize an
operation when another selected path is denied or unavailable, subject to the shared
actor, credential and resource checks.

Expired decision validity, missing final decisions and exhausted work budgets fail
closed with an unavailable result. The model indexes at most 256 operation facts
plus one actor fact, admits at most 64 operations and representation bases, and
uses paths of at most eight ASCII segments of 256 characters each. After bounded
validation/indexing, representation selection requires at most 4,096 map probes.
These are local computation bounds, not SQL, latency or whole-system capacity
qualification. Larger mutation impact must use an explicitly staged owner workflow.

The [model tests](../testing/identity-and-access.md#authority-context-model)
qualify selection and composition only. API clients never submit decision facts.
The model does not authenticate, discover delegation paths, establish membership
or assignment ceilings, lock authority rows or certify freshness. Owners must
produce current facts after complete fence/revision closure and re-evaluate before
later effects. Neither its input nor its result is a reusable authorization receipt.
Native loaders, multi-hop/redelegation, mutation admission, erasure/recovery and
stateful API integration remain required before activating this in the runtime.

## Research basis and qualification limits

Sources reviewed September 2026. These support the selected composition; they do
not prove its implementation. [Target tests](../testing/identity-and-access.md)
own the positive, rejected, race, privacy and workload obligations.

| Primary source | Selected lesson | Limit |
| --- | --- | --- |
| Ferraiolo and Kuhn, [Role-Based Access Controls](https://csrc.nist.gov/CSRC/media/Projects/Role-Based-Access-Control/documents/ferraiolo-kuhn-92.pdf), NCSC 1992 | Separate duties/permissions from people and arbitrary onward delegation. | Does not specify REZICS identity or a database layout. |
| Abadi et al., [A Calculus for Access Control in Distributed Systems](https://homepages.inf.ed.ac.uk/gdp/publications/Calculus_for_Access_Control.pdf), 1993, sections 4-5 | Evaluate adopted authority, restricted delegation and both represented and acting identities. | A formal model, not a current cryptographic implementation recipe or capacity result. |
| [SCIM RFC 7643](https://www.rfc-editor.org/rfc/rfc7643.html#section-4.2), 2015 | Member sets and provider-defined authorization semantics are distinct. | Does not mandate one universal Membership state machine. |
| [GitHub organization roles](https://docs.github.com/en/enterprise-cloud@latest/organizations/managing-peoples-access-to-your-organization-with-roles/using-organization-roles) and [Teams](https://docs.github.com/en/organizations/organizing-members-into-teams/about-teams) | Multiple roles for people/teams; explicit direct versus inherited membership. | Product limits/pricing are not REZICS requirements. |
| [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/#privilege-escalation-prevention-and-bootstrapping) | Role edits and bindings both need escalation/assignment controls. | REZICS must additionally check its Group and representation mutations. |
| [Cedar acting-on-behalf patterns](https://docs.cedarpolicy.com/bestpractices/bp-using-the-context.html#agents-acting-on-behalf-of-a-principal) | Retain both identities while selecting the primary authorization subject. | Policy input must be authoritative; Cedar does not establish membership freshness. |
| [Google Cloud delegation chains](https://docs.cloud.google.com/iam/docs/create-short-lived-credentials-delegated) | Each hop needs authority over the next; intermediate identities add no unrelated powers. | Service accounts are an engineering analogy, not the public Entity contract. |
| Pang et al., [Zanzibar](https://www.usenix.org/system/files/atc19-pang.pdf), USENIX ATC 2019, sections 2.1-2.2 | Usersets and ordering of authority/content updates are independent concerns. | Distributed deployment results do not qualify local SQL or cache consistency. |
| Birgisson et al., [Macaroons](https://www.ndss-symposium.org/wp-content/uploads/2017/09/04_3_1.pdf), NDSS 2014, sections II and V-E | Delegation attenuation and revocation need explicit conditions and freshness. | No requirement to adopt macaroon token encoding. |

Account-only grants were rejected because they prevent Entity-held institutional
authority. Entity-only grants were rejected because private direct authority would
need artificial public indirection. Unqualified union/intersection of actor and
Entity permissions was rejected because it respectively leaks unrelated rights or
defeats delegation. Unbounded offline delegation was rejected for the selected
revocation and work-budget requirements. These are design choices, not universal
claims that other products cannot use those models.

### Native Role and assignment management API

The [assignment management owner](../../services/main/src/services/authorization/assignment-management.ts)
implements Role activation/retirement, binding create/amend/revoke and immutable
ceiling create/revoke through `/access/:scope/assignment-reviews` and their resource
command endpoints. Definition preparation remains separate. A Role's catalog root
is not its bindings' data target: an account-owned definition may contain Unit
permissions and be reused at an appropriate resource root. Applicability is checked
at every affected binding target. Management permission never requires possession
of the data rights being assigned.

A review retains the exact server-resolved command, private accountable operator,
selected subject, current native source packet and full permission/recipient effect
digests. It expires within five minutes. Every inspection page revalidates the
complete source packet; partial pages cannot become partial approvals. Amendment
shows the removed old terms and the new terms separately. Manager-role changes also
capture attached institutional ceilings; amended manager terms do not renew their
old ceiling dependencies. Inspection returns review-local recipient keys, not
reusable private-principal selectors or a foreign roster. Direct recipient choice
uses self, a participating public Entity, or a source roster admitted separately by
`access.membership.read`; the target manager independently needs binding or ceiling
management at the intended target path. Raw private principal IDs are not inputs.

Each command requires a fresh interactive session and exact control/definition
revisions. A target owner may approve applicable registered permissions at their
own root. Account and Entity owner predicates recheck the exact native root identity;
resource ownership retains its current concrete ownership record. Platform native
IAM bootstrap is limited to the existing direct principal's current literal
`platform.access.manage` grant and the explicit Role/binding/ceiling management
actions. Neither a native management binding nor a represented operator's unrelated
capability can manufacture that bootstrap source. Applicability uses explicit
management-action sets and the canonical Unit grantability rules.

A delegated manager needs one complete current ceiling for the named role,
recipient, target, validity and grant-end/duration conditions. Both today's role
closure and **all permissions persisted in a new frozen approval**, including
currently dormant permissions, must fit the approving resource authority. A
requested assignment is rejected if it exceeds the approval; it is never clipped
into success. Runtime use of an existing frozen binding still constrains a later
role head to its old immutable approval. Ceiling issuance by a delegated ceiling
manager uses one complete parent approval with the same recipient predicate and
no wider downstream constraints. Approval validity governs when issuance is
permitted; institutional grants are bounded by explicit grant-end/duration terms,
not by silently converting historical issuer authority into a live dependency.
Replacement creates another ceiling identity and explicitly revokes the old one.

Activation or retirement of a Role with active binding heads requires one currently
revalidated, independent private operator to approve the entire review. Initial
activation without bindings confers nothing and needs no independent approval.
Binding and ceiling commands consume the explicit target-owner or complete-ceiling
approval directly. All commands retain a registered, currently exercisable native
repair path from before the review at every affected authority root. The definition
root of a reused role is not an affected recovery root for a binding-only command.
The original exact recovery sources must survive the actual effect; a replacement
or newly gained path cannot certify continuity. Source selection excludes the
binding/role being changed, while another complete unchanged source can authorize
the operation. The existing private controller-closure and native recovery protocol
is shared with Group management. No representation-administration API is added.

Role, binding, ceiling, review, independent approval and admission receipts retain
history. Revocation and retirement preserve their evidence. Exact retries return
the original receipt only after fresh current management admission, and changed
intent, resource identity or authority subject is rejected. Whole transactions retry
on deadlock or changed role-binding discovery. Final SQL rechecks credential and
freshness deadlines, exact manager/role/terms, current recipient dependencies,
ceiling revocation/expiry and original recovery after all locking work.

This implementation uses the existing bounded native-policy envelope: at most 256
physical Role-binding candidates, 256 attached ceiling candidates, 256 roster
candidates before joins/filtering/deduplication, 4,096 traversed Group candidates,
64 affected roots, 4,096 effects and a 16 MiB complete evidence packet. Overflow is
unavailable and creates no approvable partial result. Role scans use
`(role_id,target_scope_id,id)`, attached ceilings use `(manager_binding_id,id)`,
rosters use their existing scope/subject or Group/membership/generation indexes,
and directories/history use keyset pages of 100. Tree and target-scope fences cover
new-row and absent-recipient reads; role heads serialize new binding attachment.
The private approval closure retains its separate 256-controller/eight-level bound.
A principal can have at most 16 unexpired reviews, with at most 64 independent
acknowledgements per review and one complete approval selected for execution.

The 500,000,000-row baseline and 3,000,000,000-row estimate still apply to durable
review/receipt history. At an illustrative 8 KiB packet plus 2 KiB acknowledgement
and 0.5 KiB receipt per executed operation, payload alone is approximately 5.4 TB
and 32.3 TB respectively, before tuple/index/TOAST/WAL/replica overhead or unused
reviews. These are planning assumptions, not measurements. Capture performs bounded
indexed native reads without a global ACL or per-recipient write fanout, and
inspection trades repeated bounded revalidation for complete current evidence.
High-fanout roles exceeding the stated native envelope remain unavailable; archival,
partitioning and larger resumable activation require their own capacity qualification
before increasing it. This implementation does not qualify corpus-scale history
retention or throughput. Source/diff review and necessary generators are the only
implementation-phase evidence; tests, fixtures, TypeScript, migration replay,
integrity/concurrency/recovery/capacity checks and rendered acceptance remain deferred.
