# Connected applications, OAuth and MCP

Status: selected target capability; protocol integration and acceptance remain in
[M01](../plan/modules/foundation.md) and [the target tests](../testing/identity-and-access.md).
This owner builds on [mixed authorization](identity-and-access.md). It is not a
claim that the currently session/API-key-only bridge implements OAuth delegation.

## Scope and owners

REZICS supplies a common Entity directory and verifiable, scoped representation
to its own modules and connected platforms. A third party can keep its own login
accounts and product preferences, binding an authenticated local account to the
Entities the user explicitly connected. Offering hosted account/credential/recovery
infrastructure to other platforms is a deferred product decision, not required for
Entity integration. Physical service/database separation is also a later deployment
activation; define the trust boundaries now without requiring new microservices.

| Object | Responsibility |
| --- | --- |
| App | Product identity, developer/controller, declared capability revisions, lifecycle and trust status. App ownership does not grant access to installations' data. |
| OAuth client | Protocol identity, redirect URIs, authentication method, key/secret lifecycle and allowed protocol capabilities. An App can have multiple clients. |
| Installation | One App's admitted instance in an account, Org or Realm scope; approved capability revision, selected resources, state and scope-owned service principal. |
| Consent | An authenticated user's explicit delegation to a client for a selected authority subject, resources, actions and lifetime/offline conditions. |
| External account binding | Private association of a client's verified local subject, connected Entity and representation grant; no cross-provider account merge inferred from it. |
| Credential | A session, API key or OAuth token with its own audience, scope, validity, proof and live grant dependencies. It is not an Entity or membership. |

Use native Entity references for public app/service attribution where admitted.
Do not equate App installation with importing a Hub package, an Entity becoming
a Realm member, or a human accepting personal consent.

## Connection and identity privacy

Connect from an authenticated local account through a state-bound authorization
flow. Verify the issuer, token, audience and current representation authority,
then let the user select the Entity and approve the client/resource capabilities.
Store the exact private mapping. A supplied Entity ID, matching name/email, source
claim or third-party assertion alone cannot seize an existing Entity.

OIDC account identity uses validated issuer/subject, with client/sector context
for pairwise identifiers; the public Entity ID is a separately authorized identity
claim. Several local accounts can legitimately represent one Entity. Connecting it
does not merge those accounts or their private settings. Conversely, disclosing one
Entity does not authorize listing its controller's other Entities.

The external contract excludes raw global AuthPrincipal IDs from tokens, UserInfo,
introspection visible to clients, metadata, webhooks and errors. Use audience-scoped
private identifiers or opaque authorization references where protocol/account
correlation is necessary. Authorized security services can resolve them privately.
Do not replace an OIDC subject with an Entity just to conceal an account identifier:
login account identity and delegated public identity have different semantics.

Keep main Entity, per-application default and a consent's selected Entity separate.
Changing the default does not retarget existing grants or refresh tokens. A revoked
connection leaves permitted existing content attributed to its original Entity
but removes subsequent use of that connection's authority.

## Two execution modes

In user delegation, authenticate the operator and evaluate the selected direct or
represented authority context under the identity contract. Intersect that context's
current authority with the client capability ceiling, user consent, token scope,
selected resources and applicable installation policy. Do not intersect represented
Entity permissions with unrelated direct account grants, or combine both identities'
privileges opportunistically. Org/Realm approval cannot silently consent for every
human member.

In autonomous installation execution, authenticate the installation's service
principal and check current installation permissions and target policy. Authority
belongs to the installation scope, not its original human installer. The initial
integration candidate is a dedicated confidential OAuth client per installation,
mapped by the server to that principal and its scope. Client credentials never
select an arbitrary installation from untrusted request data. This candidate must
pass the integration tests before becoming a fixed adapter contract.

Machine credentials and user-delegated credentials are distinct types. Public
client registration, CIMD discovery and ordinary user consent cannot assign machine
privileges. An App-wide key can identify an application, but access to a particular
installation still requires its current authorization and a bound credential.

For later service-to-service delegation, use an explicit token-exchange profile
with narrowed target audience/actions and preserved actor accountability. Prefer
delegation semantics over erasing the operator through unrestricted impersonation.
RFC 8693 defines protocol vocabulary, not REZICS's live grant graph. Nested `act`
history is informational; token consumers must not interpret it as an independent
chain of current authority. The authorization service validates authoritative
delegation records before admitting execution or issuing a narrowed credential.

## Lifecycle, grants and delivery

An installation has pending approval, active, suspended and revoked outcomes.
Accepted scope changes create a new approved revision. Broader App manifests,
role changes or new resource selection require new approval where they exceed the
recorded ceiling. Listing an App as trusted is not approval for every permission.
Uninstalling does not delete content that the installation legitimately created.

Distinguish user consent withdrawal, connection removal, token revocation, client
disablement, installation suspension/removal and app-wide emergency disablement.
Each invalidates its own live authorization paths. Issuer/operator departure does
not cancel durable scope-owned assignments; dependent execution grants remain tied
to their actual parent dependencies. A valid signature or refresh token cannot
restore authority lost through any required live dependency.

Credential control routes require their operation-specific current authority and
authentication assurance. Representation can carry administration authority, but
possession checks, fresh authentication, allowed grantees and recovery constraints
remain explicit. Never log secrets; use one-time secret display and bounded key
rotation/retirement. Exact matching of redirects, PKCE S256, issuer/audience/token
validation, refresh replay protection and scope reduction need allowed/denied tests.
Keep OIDC identity tokens separate from API access credentials.

Webhooks subscribe within the installation's approved resources and events. Commit
event intent with the domain operation, then use signed, retryable, idempotently
identified deliveries. Recheck current authorization before disclosing payloads;
queued events do not bypass a revoked installation. Separate event, delivery and
attempt identity. Validate destinations and network egress, bound retries and body
sizes, and expose permanent/uncertain failures. Do not claim exactly-once external
delivery or recall data already delivered.

Account, client, installation and credential quota subjects are distinct. Token
rotation or another client must not multiply an account/installation's admitted
capacity. Reuse the [quota owner](api-quotas.md) with explicit autonomous-installation
budgets rather than forcing every workload into a human account's allowance.

API owners expose separate client registration/key administration, user connection/
consent management, scope installation approval/revision, credential issuance/
refresh/revocation and webhook subscription/delivery inspection. Mutating calls
bind the requested scope, selected authority, exact capability/approval revision
and idempotency context. Public client metadata is explicitly redacted; private
grant configuration is available only to its authorized managers. A simple connect
or invite flow composes these operations without merging their consent or ownership.

## Better Auth and MCP boundary

Better Auth owns credential and OAuth protocol mechanics; REZICS owns membership,
mixed grantees, representation, installation policy and resource authorization.
The Organization plugin supports teams and custom roles but is not a second
writable Org/Realm authority. No library hook or active-organization field alone
proves the requested cross-domain representation.

The September 2026 documentation and published metadata for
[OAuth Provider](https://registry.npmjs.org/@better-auth%2Foauth-provider/1.7.3),
[MCP](https://registry.npmjs.org/@better-auth%2Fmcp/1.7.3) and
[CIMD](https://registry.npmjs.org/@better-auth%2Fcimd/1.7.3) show version 1.7.3 with
compatible declared Better Auth peer dependencies.
This is dependency evidence, not tested Bun/Drizzle integration. Resolve these
adapter questions before G2/G3 claims:

- Use the [qualified external token profile](#qualified-external-token-profile)
  for dependent schema/API work. Its Bun/Drizzle protocol fixture resolves the
  token-format/public-client conflict; application policy and all external
  response surfaces still require their owning tests.
- Prove current consent/installation/representation checks on issuance, refresh,
  exchange and resource use. Provider revocation behavior alone does not implement
  the selected live-domain revocation contract, especially for machine JWTs.
- Qualify the installation-client mapping, authenticated administrative endpoints,
  transaction boundaries and any provider extension. RFC 8693 support is not
  implied by a generic extension API.

REZICS's MCP endpoint exposes its own authorized capabilities to external AI
clients. Use the MCP 2026-07-28 authorization profile: protected-resource discovery,
authorization-server discovery, PKCE, target resource indicators and audience checks.
CIMD is the recommended discovery direction; DCR is deprecated compatibility and
is enabled only for an elected client requirement. Discovery does not verify a
developer, approve an installation or grant machine access.

The OAuth `resource` identifies the MCP/API service; it does not replace the selected
Realm/content resource set. Every tool, resource, prompt, batch result and subscription
performs its applicable domain checks. Tool descriptions and model intent are data,
not authorization. REST and MCP enforce the same capabilities and revocation rules.

Better Auth's `mcp()` already provides OAuth Provider; do not mount a duplicate
provider. Its current guidance requires Bun/non-Node deployments to supply a secure
CIMD transport that checks DNS results, pins the approved address, preserves TLS
identity and rejects redirects. Generic fetch after a separate DNS check is
insufficient. This applies to metadata and discovery-owned key retrieval.

Connecting REZICS outward to third-party MCP/services requires separate consent and
secret ownership; never pass a REZICS-audience token through as another service's
credential. Executing uploaded agents or hosting third-party MCP processes remains
within the unresolved [Hub execution decisions](../research/ai-hub-execution.md).

## Qualified external token profile

### Production protocol storage

`task services-main:auth:oauth-schema:generate` produces
[`auth-oauth.generated.ts`](../../services/main/src/services/database/schema/auth-oauth.generated.ts)
from the pinned Better Auth/provider/MCP/CIMD 1.7.3 metadata. The owning generator
rejects unreviewed versions, models, field types and reference shapes. It preserves
required fields (including the metadata's required-by-default rule), uniqueness,
compound indexes and concrete references. Existing private account/session UUID
owners are reused; this is not another account store. Provider defaults remain
provider behavior rather than silently becoming new database defaults.

Protocol records normally use native UUID identities. The client-assertion replay
table deliberately uses text: the pinned provider supplies a namespaced, 24-byte
digest encoded as a 32-character base64url ID even with UUID generation configured.
Client/resource protocol identifiers remain text and reference their exact unique
keys. Arrays use the native PostgreSQL array representation exercised by the
protocol fixture. JSON fields remain unknown until their owning boundary validates
them. Expiry/ID indexes support bounded cleanup; they do not implement retention.

The generator creates source artifacts atomically under `.temp/`, without starting
an auth server, contacting an external client or opening a database. Generate SQL
with the separate typed migration owner after reviewing the resulting model. Its
plural model aliases are an adapter boundary, not public API models. Production
client privacy/admission, App/consent/installation records, token-domain context,
workers and actual adapter/schema qualification remain required before mounting
the provider in the application's authentication configuration.

### Token and client profile

The September 14, 2026 [executable qualification](../testing/identity-and-access.md#oauth-adapter-qualification)
selects opaque access tokens, ordinary opaque refresh tokens and separately signed
RS256 OIDC ID tokens. Keep JWT signing enabled and set the locally patched
`forceOpaqueAccessTokens: true`. Admit user clients with server-owned
`subject_type: "pairwise"` and a stable private `pairwiseSecret`; use authenticated
online introspection with exact issuer/resource validation for API/MCP access.
The public Entity claim remains a separately authorized domain claim, not the
account subject. Never use the presented pairwise subject as a raw database user ID.

Two reproducible Yarn patches against Better Auth 1.7.3 own the adapter delta:

- [OAuth Provider patch](../../.yarn/patches/@better-auth-oauth-provider-npm-1.7.3-8fc63cd677.patch)
  separates access-token format from OIDC signing and removes the global session
  key from pairwise access/refresh introspection. Internal token validation retains
  the real user/session keys needed for lookup and revocation.
- [Core verification patch](../../.yarn/patches/@better-auth-core-npm-1.7.3-79aeed22f4.patch)
  turns invalid remote token claims into authentication failures, allowing MCP to
  return discovery challenges. Infrastructure failures remain operational errors.

Default JWT access issuance remains disallowed for this external profile: its
subject exposes the raw principal even when the ID token is pairwise. Disabling
JWT globally was rejected because public clients then receive no ID token.
Rewriting identity claims in custom claim callbacks was rejected because reserved
claims belong to the provider; replacing the underlying credential user with an
Entity or synthetic per-client account would conflate identity ownership. The
selected patch reuses the existing opaque storage, rotation and revocation paths
without changing account identity or adding a second credential store.

`forceOpaqueAccessTokens` alone does not establish privacy. The admitted client
must be pairwise; the provider's ordinary user-created client route does not retain
that administrator-owned setting and returns private owner metadata. Before
production activation, wrap/disable raw client management, registration and claim
extension surfaces under the REZICS contracts. Keep session/back-channel logout
extensions disabled for this profile until separately scoped session identifiers
and logout behavior are qualified. CIMD/DCR clients need the same server-enforced
privacy admission; arbitrary metadata must not opt out. The [Bun transport](#cimd-network-boundary) is qualified separately; dynamic
registration remains unactivated until server-enforced privacy admission passes.

Machine tokens remain distinct: opaque issuance/introspection identifies the
issuing confidential client without a human subject, ID token or refresh token.
The server must resolve that client to exactly one admitted installation/service
principal and validate its live scope; two clients producing distinct protocol
identities is not proof of installation authority or isolation.

This profile adds a stored row per access token, including machine issuance, and
requires online token verification. Preserve the 500M/3B credential envelope and
[combined query-budget qualification](identity-access-capacity.md#opaque-protocol-cost)
before production activation. Provider revocation, protocol scopes and pairwise
identifiers do not implement live consent, representation, installation checks or
private accountability. Upgrades must replay the fixture and deterministic auth
regressions; remove either patch only after the pinned replacement passes its cases.

## CIMD network boundary

[createCimdResourceFetch](../../services/main/src/services/auth/cimd-transport.ts)
is the selected Bun network boundary for metadata and discovery-owned JWKS.
The [isolated Linux/Bun qualification](../testing/identity-and-access.md#cimd-network-qualification)
uses public-class IPv4/IPv6 addresses assigned only inside an isolated network
namespace; it does not contact those addresses on the Internet. An independent
Node TLS peer verifies the original hostname in Bun's ClientHello.

Resolve a hostname once, reject an empty, excessive, malformed or mixed
public/special-use answer set, and connect directly to one approved IP. Preserve
the original Host, SNI and certificate-verification identity, require a valid
certificate, disable connection pooling and verify the connected peer before
accepting the response. Literal IPs pass the same special-use classification.
A second DNS lookup cannot substitute a private destination. Every 3xx response
except conditional 304 is rejected without following its Location. This implements
the [CIMD transport requirements](https://better-auth.com/docs/plugins/cimd#security-boundary)
using the [HTTPS connection controls](https://nodejs.org/api/https.html#httpsrequestoptions-callback)
verified on Bun 1.4.2; API type compatibility alone was not treated as evidence.

One shared transport instance admits at most sixteen unresolved DNS/network/body
operations, with no waiting queue. It accepts at most 64 DNS answers and buffers
at most 64 KiB of response chunks before returning a body. The default absolute
deadline is five seconds, including DNS and body retrieval; caller abort applies
throughout. A timed-out OS DNS operation retains its admission slot until it
settles, so retries cannot accumulate unbounded resolver work. A stuck resolver
can exhaust availability and must be observable/recovered operationally; it cannot
turn into an unbounded queue. Settings can narrow these limits, not raise them.

The transport body cap accommodates JWKS; the plugin retains its stricter 5 KB
metadata-document limit and its cache, pacing and origin/global budgets. Accepted
response chunks across active requests have a 1 MiB ceiling before concatenation,
Response copies and runtime socket/TLS buffers, whose memory/throughput still need
measurement. These are bounded process-local structures, not new corpus-scale
relations. Multiple instances/replicas multiply this envelope; production integration
must share the instance across metadata/JWKS and retain fleet admission/observability.
This does not change the 500M/3B persisted-client/credential inventory.

The plugin-level network fixture uses an in-memory protocol store to isolate
metadata discovery, private-key JWT verification and denial of unassigned machine
scopes. It does not qualify production client persistence, pairwise admission,
metadata-refresh authority, delegated requests, cache capacity or external-client
interoperability. Raw CIMD registration therefore remains disabled in the product
until those contracts pass. Supplying the transport is not App trust or installation
approval.

## Sources and limits

| Primary source | Selected use and limitation |
| --- | --- |
| [OIDC Core 1.0, errata set 2](https://openid.net/specs/openid-connect-core-1_0.html#SubjectIDTypes), sections 5.7 and 8 | Issuer/subject identity and pairwise privacy. Shared public Entity identity and third-party binding are REZICS product contracts. |
| [OAuth Security BCP, RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html), January 2025 | Restricted credentials and secure flows. Does not define installation or Entity authority. |
| [RFC 8693](https://www.rfc-editor.org/rfc/rfc8693.html), January 2020, sections 1.1, 2.1 and 4.1 | Subject/actor delegation and exchange; no automatic input/output revocation linkage, and prior actors are informational. |
| [GitHub user delegation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app-on-behalf-of-a-user) and [installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app) | Distinct personal and installation grants with resource limits; not a requirement to clone GitHub's token endpoints. |
| [Better Auth OAuth Provider](https://better-auth.com/docs/plugins/oauth-provider), [Organization](https://better-auth.com/docs/plugins/organization), [MCP](https://better-auth.com/docs/plugins/mcp) and [CIMD](https://better-auth.com/docs/plugins/cimd), reviewed September 2026 | Protocol/adapter capabilities and their documented limitations; not proof of the REZICS composition. |
| [MCP authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) | Discovery, issuer/resource binding, client registration and protected requests. It does not define REZICS object authorization or approve hosted execution. |

Acceptance is recorded only through the [target matrix](../testing/identity-and-access.md),
with the [capacity envelope](identity-access-capacity.md) and existing recovery policy.
