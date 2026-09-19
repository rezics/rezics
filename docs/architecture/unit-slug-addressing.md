# Resource addressing and Space routes

Status: selected target revised 2026-09-19; implementation remains pending.
The historical filename is retained for document navigation. Resource is the
[selected name for the existing logical Unit contract](schema-modeling.md#native-terminology-and-identity).
Owners: Main Service and Web. Apply the [program compatibility policy](../plan/execution-workflow.md#program-authority);
this target requires neither old URL compatibility nor legacy address transfer.

## Decision

Keep stable native identity, scoped address assignment, route matching, reverse
link generation and representation selection separate. UUIDs and slugs resolve to
the same Resource contract. A Space route binds a Resource, not a Document payload
or a separately owned Page. The resolved Resource uses the shared rendering flow,
including Post rendering where appropriate, with explicit presentation context.

Use one authoritative address model. A route definition is not a second slug store;
a resource's localized name is not its address. The [Space contract](realm-collection-zone.md)
owns capabilities and role-qualified contexts. A mount never grants access or
changes content ownership, published selection or attribution.

## Terminology

| Model | Identity, fields and responsibility |
| --- | --- |
| SpaceMount | Stable mount ID, admitted site/origin and base path, Space reference, state and revision. Existing fixed-site profiles remain valid input; arbitrary-domain hosting is not activated. |
| RouteDefinition | Space-local route ID, immutable revisions, pattern AST, typed parameters, target binding, reverse-link contract, current activation and work limits. It is an operational relation, not a Page Resource. |
| AddressNamespace | Stable namespace ID, owning authority/scope, policy revision and allowed target/assignment rules. A namespace need not be inferred from a mutable path segment. |
| SlugBinding | Namespace, original label, normalized lookup key, target ResourceRef, binding identity/generation, state and history. An assigned spelling is not native identity. |
| AddressPreference | Resource plus explicit site/Space/address purpose and optional language dimension; selects one usable route/binding. Preference does not change ownership or make other valid addresses false. |
| ResolvedResourceView | ResourceRef, route/mount/address revisions, typed parameters, role-qualified contexts and the selected authorized representation. No second content identity is allocated. |

## Invariants

- Persist resource links, grants, mutations and content references using stable
  identity or the appropriate exact revision/occurrence reference, never a slug.
- A native resource can exist and be read by admitted ID lookup without any slug.
- Canonical preference is scoped. One resource may have different preferred
  addresses in different Spaces/namespaces; it has no mandatory global slug.
- A normalized label has at most one occupied binding in its namespace. Active
  aliases and tombstones participate in reservation, not just current canonicals.
- A namespace/route/presentation association grants no read, edit, participation
  or publication authority over the target.
- Route pattern publication and slug assignment have atomic conflict checks,
  expected versions, idempotent receipts and independently versioned history.
- Renderer and link builder consume the same admitted routing/address contracts.
  Neither guesses SQL owners, manually concatenates unescaped input, or resolves
  one UUID by scanning all owner tables.

## Lookup contract

The following describes the target shape, not an implemented SDK declaration:

```ts
type ResourceLookup =
  | { by: "id"; id: Uuid }
  | { by: "slug"; namespace: AddressNamespaceRef; label: string };

type RouteTarget =
  | { kind: "fixed"; resource: ResourceRef }
  | { kind: "uuid"; parameter: string }
  | { kind: "slug"; parameter: string; namespace: AddressNamespaceRef }
  | { kind: "resolver"; resolver: RegisteredResolverRef; bindings: ParameterBindings };
```

Parameter declarations choose lookup mode. A UUID-shaped slug remains a slug in
a slug parameter; there is no `idOrSlug` heuristic. UUID-only lookup uses the native
locator and owner validation. Slug lookup uses its explicit namespace and binding
generation. Both recheck actual target existence, eligibility and disclosure.
Writes are ID-addressed except dedicated address-management commands.

Resolvers are registered, versioned capabilities with validated inputs, output
ResourceRef, authority and query/time/fan-out budgets. They are not user-supplied
JavaScript, SQL or unrestricted regular expressions. A nested namespace resolver
must state how the parent is resolved and bound its work; it cannot infer ownership
from path ancestry. Unknown, unavailable, invalid, conflicted and unsupported
outcomes remain distinct internally and follow the public disclosure contract.

## Public route contract

```text
Request URL
  -> admitted site/Space mount
  -> route revision and typed parameter parsing
  -> fixed / UUID / namespace-slug / registered resolver
  -> stable ResourceRef and role-qualified contexts
  -> current authorization and published representation selection
  -> shared Resource renderer
```

First support literal segments, declared single-segment parameters and a terminal
remainder parameter. Prefer literals over parameters and parameters over remainder
matches. Reject unresolved overlaps at activation, including UUID versus slug
patterns with identical positions; do not rely on insertion order or an arbitrary
priority number. Reserved platform/management routes cannot be captured by user
patterns. The normalized AST is authoritative; compiled matching/index data is
version-bound and rebuildable.

Illustrative patterns, not newly installed application URLs:

| Pattern | Resolution |
| --- | --- |
| `/id/{id:uuid}` | Explicit native UUID lookup. |
| `/articles/{slug}` | Slug lookup in the route's declared article namespace. |
| `/about` | Fixed ResourceRef. |
| `/books/{id:uuid}/chapter/{chapter:slug}` | Declared parent resolver followed by a parent-qualified namespace lookup, with a bounded resolution path. |

Route publication stages and validates a complete Space routing generation before
atomic activation; clients cannot observe half a conflicting route update. Bound
pattern bytes, segment count, candidate matches, resolver work and response hydration
in the admitted profile. Requests use Space/prefix indexes or compiled per-Space
matching, not a corpus-wide route scan. Storage/cache keys include the routing
generation and relevant target, content, language and policy state.

### Reverse links and canonical preference

A link request includes ResourceRef and address context. The result contains the
resolved preference/route/binding generation, typed parameters and a usable address,
or explicit unavailability. Ordinary resource summaries expose a bounded selected
address; enumerating all aliases is a separate paginated operation.

For a supported reversible route, under the same admitted routing/address versions
and applicable access/availability conditions:

```text
resolve(link(resource, context, preference)).resource == resource
```

Renaming, retirement or authority changes may subsequently produce a redirect,
gone or denied result; the invariant is not permission to ignore current state.
A resolver without a supported reverse contract is an inbound-only route and cannot
be automatically elected as canonical. Identity-route fallback remains available
where disclosure permits it. A global address never overrides a narrower site's
selected content or authority requirements.

<a id="zone-page-addresses"></a>
### Resource mounts and page rendering

There is no selected native ZonePage identity, `post(kind=page)` ownership exception,
or required `zone_page` parent. A route has an operational relation ID for editing
and history; the content remains the target Resource. Two Spaces may route to the
same target, including its Block content, without copying it. Root content is an
explicit `/` route binding; a literal `home` label has no implicit identity semantics.

Representation/Document revisions remain owned by the target's content contract.
Route publication must state whether it pins an exact accepted selection or follows
an admitted publication channel; it never silently follows a mutable draft head.
Fragment selectors retain exact content/representation interpretation. Navigation
links name stable targets and address context, not Page surrogate identities.

### Post interaction addresses

Posts, replies, reviews and other admitted resources use their ordinary identity,
content selection and interaction contracts after route resolution. Space context
may narrow disclosure or choose a presentation; it does not create another Post,
duplicate its body or implicitly enroll it in community governance. A bound target
need not be a Post: capability/presentation adapters choose its rendering.

### Fixed site origins

Preserve the [fixed-site delivery contract](realm-scoped-delivery.md#same-origin-site-adapter):
one frontend codebase can use distinct admitted site profiles. Mount and preference
resolution carry that context through redirects, query keys and share links, without
another slug registry. A Pro route cannot redirect to an otherwise valid general
body to bypass its scope conjunction. This model does not activate domain hosting.

### Content-language variants

Language/format selection does not create another Resource identity. Content language
uses the open content-language policy, not the UI locale enum. A route may expose a
typed language parameter or use explicit preferences; return the actual selected
language and fallback state. Named content variants and exact revision links retain
their own meaning. A requested unavailable translation is not fabricated.

The route profile declares which query parameters affect representation, reverse
links and address preference. Unrecognized query strings do not alter lookup mode.
Canonical omission/inclusion of language is a presentation/SEO decision, not an
identity rule. Preserve allowed suffixes/fragments through redirects and bind caches
and cursors to the effective language/representation choice.

## Collections and Favorites

Collections remain independent curation resources. A public Collection can be routed
when eligible and authorized. Private Favorites do not become public or obtain a
slug merely because a Space can render them. The existing route manifest's enabled
surfaces remain current implementation facts until target activation; documenting
a namespace or pattern does not install it.

## Assignment contract

An admitted namespace policy declares assignment/rename authority, target eligibility,
Unicode normalization, case comparison, reserved labels, byte/character budgets,
URI serialization and history rules. Namespace creation is separately authorized;
supplying a namespace ID in a request proves no control over it.

Selected new native default: Unicode NFC lookup keys with case-sensitive comparison,
retaining the original label. NFC is REZICS policy, not a requirement that all URI
paths be normalized. Other case policies require explicit versioned namespaces.
Do not apply NFKC, transliteration, simplified/traditional conversion or confusable
skeletons as general identity equivalence. Language tags remain independently
case-insensitive under their own standard.

The executable profile must specify admitted character classes and indexed UTF-8
byte ceilings before activation. Reject path separators, dot-segment ambiguity,
control characters and invalid encoding under that profile. Parse URL structure
before decoding parameters, decode once, and reject decoded separators where the
parameter is a single slug segment. Slug creation receives a label, not pre-escaped
path syntax. Reverse links serialize each segment with the same parser/profile.
Policy upgrades preflight collisions rather than silently rebinding names.

## Lifecycle and security

Slugs are explicitly assigned; titles do not silently generate or rename addresses.
A rename atomically creates/selects the new binding and retains the old binding for
the original resource as an alias or tombstone. The selected default forbids automatic
reuse and ordinary reassignment of an occupied historical label to another resource.
Exceptional release would need a separately selected governance/retention contract;
it is not implicitly authorized by expiry or an old implementation endpoint.

Bindings have immutable history/generations. Aliases resolve through stable target
identity and the current allowed preference rather than forming arbitrary redirect
chains. Tombstones reserve the label without disclosing unavailable content. Choose
HTTP status/cache lifetime according to the actual binding permanence and visibility;
identity stability alone does not justify permanently caching every contextual redirect.

Check current mount, namespace, target and representation disclosure before returning
redirect locations or metadata. Public failures cannot reveal which private target
or policy failed. UUIDs, labels and route parameters are not credentials. Address
mutations invalidate old/new paths and affected preference/mount projections; stale
cache or reverse-link results cannot bypass current revocation.

## Current implementation and required verification

Current `@rezics/slug` has a compile-time users/realms/zones route manifest, ASCII-only
labels and a small fixed depth. `unit_slug_address` has target-wide canonical
uniqueness. Zone Pages currently use `post + zone_page`. Those are implementation
facts to replace, not additional constraints on this target; current API names and
qualification evidence must remain explicit until affected consumers are updated.

Required cases are in [model-contract acceptance](../testing/model-contracts.md):
multi-Space preferences, UUID-shaped slugs, Unicode/encoding/case collisions,
route ambiguity, root and nested resolution, reverse-link equivalence, stale
versions, concurrent assignment, rename/tombstone, disabled routes, current access
and shared Resource rendering. Backend, generated clients, navigation, SEO, search
execution and Web adapters must change together when implementation is activated.

Primary basis: [Web identity/representation](https://www.w3.org/TR/webarch/),
[RFC 3986](https://www.rfc-editor.org/rfc/rfc3986.html),
[RFC 6570](https://www.rfc-editor.org/rfc/rfc6570.html),
[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) and
[Unicode normalization](https://www.unicode.org/reports/tr15/). They inform syntax
and protocol behavior; namespace lifecycle, precedence and admission are native choices.
