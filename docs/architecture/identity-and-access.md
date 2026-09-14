# Identity, membership and mixed authorization

Status: selected target contract. Implementation and qualification are tracked in
[M01](../plan/modules/foundation.md) and [M06](../plan/modules/community-and-governance.md).
Existing account/Self and ACL fixtures establish only their recorded behavior.
This contract replaces their one-to-one identity and account-only grantee assumptions;
it does not claim the replacement is implemented.

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
and erasure flows must pass native tests before the old Org/Realm consumers are
replaced; the shared storage primitives alone do not qualify them.

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
