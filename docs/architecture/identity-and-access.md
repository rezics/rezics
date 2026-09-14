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
representation reference/revision which the server validates. Public clients do
not submit an internal principal ID to choose their authentication identity.
Recipient selectors for private grants return purpose-scoped opaque handles with
authorized presentation; resolve them privately and revalidate at mutation.

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
