# Identity, mixed authority and connected-app acceptance

The matrices below are selected target test specifications. The separately scoped
[OAuth adapter qualification](#oauth-adapter-qualification) records executable
evidence; it does not mark whole IAM/APP cases complete.
They cover [identity/access](../architecture/identity-and-access.md),
[connected applications](../architecture/connected-apps.md),
[GUI layering](../architecture/identity-and-access-experience.md) and
[capacity](../architecture/identity-access-capacity.md).
Existing [foundation evidence](foundation.md) remains scoped to its recorded
Auth/Self, direct-grant and membership implementation. G2-G5 status lives only in
[the plan](../plan/README.md).

## Identity and membership

| Case | Required sequence and outcome |
| --- | --- |
| IAM01 | Anonymous public reads require no fabricated account/Entity and disclose only public state. Create an ordinary account, admit a usable Entity and save its main preference atomically; repeated/competing admission creates no duplicate binding or leaked private provider name. |
| IAM02 | One AuthPrincipal represents several Entities; several principals represent one Entity with different scopes. Credential linking, controller linking and public identity are not equated. |
| IAM03 | Import a cataloged person/organization and submit matching names/email or arbitrary Entity IDs. No control, account linking or participation is admitted from those values alone. |
| IAM04 | Exercise public detail/list/search/error/audit/webhook and external-token surfaces. Raw principal IDs, private emails, controller sets and unrelated Entity links remain undisclosed. |
| IAM05 | Change main/per-app defaults during two-tab editing and an OAuth refresh. Prepared attribution and consent retain their original Entity; an invalid default requires explicit selection before effect. |
| IAM06 | Admit Entity participation and private AuthPrincipal operational membership under their separate policies. Typed roster disclosure and group eligibility remain correct without a universal public account roster. |
| IAM07 | Exercise invitation/application, rule consent, active membership, mute, ban, leave and rejoin. Pending grants do nothing; rejoin creates a new generation and revives neither bans nor prior privileged group assignments. |
| IAM08 | Admit an Org as a Realm participant without enrolling all Org members or allowing every controller to represent it. Source affiliations and following create no operational membership. |
| IAM09 | Place a member in multiple groups and bind several roles to one group. Direct/inherited membership, root/sibling resource scopes and all-members derived sets remain distinct. |
| IAM10 | Reparent groups concurrently; reject cycles and unauthorized expansion. Child membership receives parent grants without copying direct membership or leaking private inherited roster labels. |

## Mixed authorization and governance

| Case | Required sequence and outcome |
| --- | --- |
| IAM11 | A principal lacking direct target rights uses a valid scoped representation of an authorized Entity: allow. The same request with missing/stale/wrong-action/wrong-target representation is denied. |
| IAM12 | A principal holds unrelated private rights while representing an Entity without those rights: deny. An App approved only for that Entity cannot harvest the principal's other grants. |
| IAM13 | Grant account administration, Entity-controller management and security-role assignment to an Entity, AuthPrincipal and eligible mixed member set. Enforce each action's conditions, not a blanket recipient-type prohibition. |
| IAM14 | Grant only publishing representation of an Entity that holds security powers. Reject account administration, controller changes and onward delegation. |
| IAM15 | Exercise the operator's group membership while representing a different Entity. It does not automatically become the Entity's membership; explicit combined policies are checked separately. |
| IAM16 | A compound command has different incomplete rights under two identities. Reject implicit stitching; separately specified multi-party authorization can succeed only with every required proof. |
| IAM17 | A manager can assign a named role without using its data permissions. Reject self-escalation through role edits, group enrollment, reparenting, ceiling changes or a change authorizing itself. |
| IAM18 | Activate a new role revision. Local bindings observe the approved head; external/cross-authority ceilings do not expand. Role retirement cannot fall back to a broader default. |
| IAM19 | Validate multi-hop representation with expiry, target/action narrowing and explicit redelegation. Reject widening, wrong edge order, cycles, unrooted mutual control and work-budget overflow. |
| IAM20 | Revoke an issuer/operator. Durable institutional assignments survive under their owning authority; dependent execution delegations fail; pending invitations revalidate before acceptance. |
| IAM21 | Attempt to remove the last valid recovery path, including two concurrent removals. Reject lockout; a cycle alone is not continuity. Recovery changes no historical authorship and revives no erased principal. |
| IAM22 | The same operator uses two Entities as purported independent approvers or duplicate voters. Enforce the feature's private accountability key; distinct account IDs are not claimed as proof of distinct humans. |

## OAuth, applications and cross-platform identity

| Case | Required sequence and outcome |
| --- | --- |
| APP01 | Connect a verified third-party local account to a selected Entity through a state-bound flow. Reject wrong issuer/audience/state, account substitution and name/email-based control claims. |
| APP02 | Two local accounts connect the same Entity with different grants; one account connects two Entities. No account merge, private-setting transfer or unauthorized sibling disclosure occurs. |
| APP03 | Inspect actual OIDC, JWT/opaque access tokens, UserInfo, introspection and errors for private global IDs. Pairwise OIDC alone is insufficient; public-client OIDC and MCP must still work under the elected privacy profile. |
| APP04 | User delegation checks the selected direct/represented context, consent, client scopes, selected resources and applicable installation policy. Either identity's unrelated privileges stay excluded. |
| APP05 | Issue installation credentials for two scopes of one App. Reject cross-installation use and client-controlled installation substitution; installer departure preserves scope-owned autonomous authority. |
| APP06 | Public registration/CIMD claims request machine privileges. Reject unauthorized machine-scope assignment; discovery is not verified publisher status or installation approval. |
| APP07 | Increase an App manifest/role/resource selection. Old consent and installation ceilings do not expand. New approval is version-bound and races with role/installation changes safely. |
| APP08 | Exercise PKCE, redirect matching, issuer/resource audience, expired tokens, refresh replay, rotation and revocation through actual HTTP endpoints, including invalid-bearer no-cookie-fallback behavior. |
| APP09 | If token exchange is elected, narrow audience and action scope, preserve private actor accountability and validate live dependencies. Nested act history alone cannot authorize; upstream revocation propagation is explicitly tested. |
| APP10 | Revoke consent, connection, token, client, installation and App separately. Old access/refresh/machine tokens cannot bypass the required live dependency. Uninstall does not delete existing content. |
| APP11 | Discover and authorize an MCP client using the elected 2026-07-28 profile. API/MCP object checks match; resource audience is not mistaken for the selected Realm/content set. |
| APP12 | Test CIMD/JWKS egress on Bun: private/special-use IPs, mixed DNS answers, rebinding, redirects, TLS identity, timeout and bounded fetch concurrency. Verify the actual connected address. |
| APP13 | Queue a webhook, revoke its installation, then attempt delivery. No newly unauthorized payload is disclosed. Test signed duplicate deliveries, retries, unknown outcomes, forbidden destinations and bounded backlog. |
| APP14 | Rotate/create credentials and clients under one account/installation. Shared quota ceilings remain effective; autonomous installation quota ownership is explicit. |

## Concurrency, erasure and capacity

Use independent connections and controlled barriers, not only timing-based sleeps.
For each relevant relation change, test both lock acquisition orders, waits that
outlive expiry, missing-row admission races, and changes to the discovered proof
dependencies while a command is waiting.

| Case | Required sequence and outcome |
| --- | --- |
| IAM23 | Revoke membership, parent group, role, representation or installation while a protected write waits. It commits before the conflicting revocation or observes the new authority. |
| IAM24 | After acknowledged revocation, read through detail/list/search/count/export/cache and every service replica. No new request succeeds through that path; authority outages never produce stale allows. |
| IAM25 | Revoke during a long job or stream. Subsequent protected effects follow the declared checkpoint; already delivered bytes are not claimed to be recalled. |
| IAM26 | Erase one controller's account and private bindings/tokens. Other valid controllers, permitted Entity contributions and independent institutional assignments survive. Cleanup remains bounded. |
| IAM27 | Restore an older database/object snapshot. Replay erasure and revocation frontiers before exposing data; stale roles/consents/delegation receipts cannot reactivate access. |
| IAM28 | Exercise 500M/3B relation arithmetic plus representative depth, degree, hot keys, wide metadata and cold/warm plans. Measure indexes, query count/buffers, latency, unavailable decisions, WAL, queues and restore cost. |

## Experience acceptance

These cases require implemented interfaces and the appropriate authorized rendered
or human-study workflow. The documentation refactor executes none of them.

| Case | Required experience |
| --- | --- |
| UX01 | Ordinary onboarding/login enters the valid main Entity without a role/delegation wizard. Users can read, post and join without knowing account-principal terminology. |
| UX02 | Switching identity makes attribution clear and preserves draft identity across tabs; lost authority preserves input and requires an explicit replacement before effect. |
| UX03 | Invite a collaborator, select a role preset and finish from collaboration controls; advanced mixed-recipient and scope choices remain discoverable when needed. |
| UX04 | Load an advanced API-created configuration, edit an ordinary field and save. Multiple roles, conditions, expiry, ceilings and recipient types survive; unsupported edits route to a capable editor. |
| UX05 | Approve an App with clear identity, activities, selected resources and offline implications. Material authorization consequences are not hidden in advanced controls. |
| UX06 | Revoke one member/connection/installation and understand affected access, including another surviving grant path, without reading a raw authorization graph. |
| UX07 | Inspect management lists through filtered empty pages, unavailable public labels and cross-page selections; keyboard/accessibility and typed locale behavior remain usable. |
| UX08 | Observe representative ordinary users and administrators on their actual tasks. Record completion, errors, navigation and attribution mistakes; the 90% audience priority is not an already measured success rate. |

## Evidence requirements

Use pure model tests for path composition and counterexamples, real PostgreSQL for
constraints/races, and stateful HTTP clients for produced IDs and protocol flows.
Pin dependency versions, policy revisions, fixture inputs, runtime, exact commands
and failures. Publish only secret-free evidence. A model check does not qualify
SQL or distributed consistency; a document/link check executes no case above.

Run these scenarios together with [backend integration](backend-integration.md),
including content publishing, membership, private account state and queued effects.
Do not disable unrelated required policy to obtain a passing result. Frontend work
follows the existing G4/G5 and Storybook/full-application verification boundaries.

## OAuth adapter qualification

`task services-main:db:oauth-privacy:check` runs
[check-oauth-privacy.ts](../../services/main/scripts/check-oauth-privacy.ts) under
Bun against an explicitly supplied loopback `DATABASE_ADMIN_URL` whose database
name is exactly `rezics_oauth_qualification`. Create that disposable database with
the owning PostgreSQL tools before invoking the task. It does not reset an
application database or use the native migration fixture lane.

The script generates uniquely prefixed public tables from the pinned provider's
schema metadata, including required fields, concrete foreign keys and declared
indexes. It runs the actual Drizzle relations-v2 adapter and HTTP token endpoints
on OS-assigned loopback ports, then removes only its tables and closes the listener.
These generated tables qualify the protocol adapter; they are not production IAM
DDL, domain constraints, application auth configuration or a schema migration.
Fixture-only admission permits client administration to isolate protocol behavior;
it does not qualify any administrative authorization policy.

The [pinned run](database/oauth-privacy-evidence.json) records Bun 1.4.2, PostgreSQL
18.6/Linux, Better Auth/provider/MCP 1.7.3 and Drizzle 1.0.0-rc.4 through package,
lockfile, patch and fixture digests. No raw credentials, principal IDs or session
keys are retained in its output.

| Executed scope | Result |
| --- | --- |
| Default provider, public/confidential clients | Resource JWT access tokens contain the private account ID even with pairwise ID tokens/UserInfo. This profile is rejected. |
| JWT disabled, public/confidential clients | Access tokens are opaque, but public clients receive no OIDC ID token. This profile is rejected. |
| Selected opaque profile | Both client types receive opaque access and refresh tokens plus signed RS256 ID tokens; JWKS verification checks issuer/audience, nonce, pairwise subject and the access-token hash. |
| External identity | UserInfo and authenticated access introspection agree with each client's pairwise ID subject, exclude the raw principal and omit the shared session key; different sectors have different subjects. Confidential refresh introspection has the same privacy properties. |
| Discovery and MCP | Protected-resource metadata identifies the exact resource/issuer and resource scopes. Authenticated online verification allows the valid bearer and rejects wrong audience, insufficient scope and an invalid bearer despite a valid cookie. |
| Refresh | Wrong-client use and scope widening are rejected. Rotation preserves the selected subject, produces opaque access tokens, and old-refresh replay fails and invalidates the rotated access token. |
| Machine protocol identity | Two confidential clients issue distinct client-bound opaque tokens without a human ID token/refresh token; explicit revocation makes introspection inactive. Installation mapping and authority are not exercised. |

The deterministic [resource verification tests](../../services/main/src/services/auth/oauth-resource-verification.test.ts)
cover wrong/missing audience, wrong issuer, expiry, future activation, invalid
expiry shape, valid claims, insufficient scope and introspection outage. Bad claims
produce a 401 MCP discovery challenge; outages remain operational failures.

The selected configuration and rejected alternatives live in
[connected apps](../architecture/connected-apps.md#qualified-external-token-profile).
APP03 protocol surfaces and selected APP08/APP11 mechanics now have adapter evidence;
the complete cases remain pending live-domain checks, production endpoint privacy,
CIMD egress, concurrency, erasure/recovery, external-client interoperability and
[capacity](../architecture/identity-access-capacity.md#opaque-protocol-cost).

## CIMD network qualification

`task services-main:auth:cimd-transport:check` invokes the
[network fixture](../../services/main/scripts/check-cimd-transport.sh), which requires
Linux user/network namespaces, `ip`, OpenSSL, Node and Bun. It creates an isolated
network namespace, assigns synthetic public-class IPv4/IPv6 addresses to its
loopback device and generates a temporary private test certificate beneath
`.temp/`. It never assigns those addresses in the host namespace. The fixture
removes its certificates and the namespace disappears when the process exits.

[check-cimd-transport.ts](../../services/main/scripts/check-cimd-transport.ts)
uses actual TLS connections from the selected Bun transport. It verifies the
connected peer and original Host, private/mixed/malformed DNS rejection, a
resolve-once rebinding counterexample, wrong certificate name/untrusted certificate,
redirect refusal, streamed oversize rejection, HEAD/304 preservation, timeout,
pre-abort, body abort and request admission. An
[independent Node TLS peer](../../services/main/scripts/cimd-tls-peer.ts) observes
Bun's actual SNI; the Bun server's unsupported SNI callback is not used as evidence.

The fixture additionally composes the real CIMD and MCP provider plugins with an
in-memory protocol store. Metadata and discovery-owned JWKS both use the transport;
rebinding before JWKS retrieval fails closed. A valid signed assertion for a
newly discovered client still cannot issue a machine token without server-assigned
scopes. This is network/protocol evidence, not PostgreSQL or live-domain authority
acceptance.

The [pinned run](database/cimd-transport-evidence.json) records Bun 1.4.2/Linux x64,
its independent Node TLS peer, source and dependency digests and secret-free
outcomes. [Deterministic admission tests](../../services/main/src/services/auth/cimd-transport.test.ts)
also verify that aborted but unresolved DNS retains its slot, capacity recovers
when it settles, and invalid methods/configuration/answer counts are rejected.
The [network owner](../architecture/connected-apps.md#cimd-network-boundary) records
bounds and limitations. These qualify selected APP06/APP12 mechanics; full target
cases still require production client admission, persistence, live authority,
external-client interoperability and fleet capacity/recovery.

## Authority context model

[authority-context.test.ts](../../services/main/src/services/authorization/authority-context.test.ts)
runs through the backend Vitest owner and currently passes 26 model cases. These
use explicitly constructed trusted facts; they are not PostgreSQL, authentication,
grant-loading, delegation-chain or API acceptance.

Cases cover direct versus represented selection, private-actor field rejection,
exact representation revisions, operator/Entity UUID collisions, private-rights
exclusion, incomplete composite proofs, credential subject/basis limits, exact
actor/permission-family/action/root/path binding, expiry, unavailable outcomes, hard denial and
independent valid paths within one selected Entity. Conflicting duplicate basis
facts were found to admit a stale allow and now fail closed. The boundary fixture
accepts 64 operations/bases and 256 operation facts, then rejects the next fact.

The [context owner](../architecture/identity-and-access.md#request-selection-and-decision-composition)
defines these semantics and computational bounds. Native IAM11-IAM25 qualification
still requires current database facts, mixed membership/group/role and representation
loaders, assignment ceilings, complete fences, expiry/revocation races and actual
protected effects. The existing request authorizers are not switched to this model
until those dependencies pass their persistence gates.

## Role definition persistence cases

`task services-main:db:access-roles:check` owns
[check-access-roles.ts](../../services/main/scripts/check-access-roles.ts) and is also
included in the full database gate. It uses the disposable native fixture workflow.
The [pinned run](database/access-roles-evidence.json) passes 77 native assertions.
The full fresh database gate also passes canonical SQL, integrity and schema-drift checks.
Its SQL-admin admission isolates storage behavior; it does not qualify actual
management authorization, assignment ceilings, role bindings or API access.

The fixture exercises complete draft creation, immutable definition snapshots,
explicit activation, unchanged active permissions while a proposal is pending,
terminal retirement, exact historical reads, scoped identity isolation, stable
receipts and changed-intent rejection. It rejects unknown/wildcard or late permission
writes, unsealed commits and immutable-history edits. Same-operation races reuse
one receipt; competing stale commands fail. Admission is tested before changes,
after a role-lock wait and after a later FK wait crosses its deadline; rejected
commands leave no provisional records even if the surrounding caller catches them.
Active reads serialize retirement. A 1,000-role sample plus a long-lived role with 100 further revisions records exact-key plans and
separate table/index widths.

The [role contract](../architecture/identity-and-access.md#scoped-role-definition-protocol)
and [capacity envelope](../architecture/identity-access-capacity.md#role-definition-storage)
define the selected behavior and remaining qualification. The existing IAM matrices
remain the authority for actual mixed-user, ceiling, delegation and management flows.
