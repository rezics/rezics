# Current implementation contracts

This reference describes the checkout inspected at `84d1c5ec3`, before the complete
documentation reconciliation. It is not the target architecture or evidence of a
production deployment. [Architecture](../architecture/README.md) defines the selected
Resource/Agent/Space model. [Testing](../testing/README.md) records exact qualified
scopes and open failures; [the plan](../plan/README.md) owns remaining work.

## Names and references

| Selected concept | Current source/wire names | Reconciliation boundary |
| --- | --- | --- |
| Resource | `Unit`, `UnitRef`, `unitId`, `/units`, owner-specific tables and Unit capability adapters | One logical contract, no second root or universal parent. Target terminology does not rename an installed API. |
| Described/admitted Agent | Public `Entity`/`Profile`, `entity_identity`, `entityId`/`profileId` in retained contracts | Current person/organization/character storage must be separated from generic Entity semantics. Public attribution is not a private account. |
| Generic Entity | `reference_identity`, `description_object` and selected description profiles carry portions of the responsibility | Reconcile grain and writer authority without deleting source descriptions or fabricating specialized parents. |
| Space | Separate `realm` and `zone` identities plus capability-specific tables | Target merges the identity owner while preserving independent governance, routing and presentation contracts. |
| Routed Resource view | `post(kind=page)` plus `zone_page`; Page-named endpoints and host policies | Target resolves a Resource with typed context and selected representation; route history is operational history. |
| Indexed media | `media_item` with image/video/audio kind; separate platform `video`/`audio` records also exist | Asset, platform publication, work/cut and source listing must not be merged merely by name. Table-family specialization preserves logical owner. |

Exact implementation identifiers remain in code examples, operations procedures,
generated inventories and dated test results. Those identifiers do not require the
target architecture to retain their physical shape or public terminology.

## Schema and artifact pipeline

`libraries/schema/model/domains.ts` authors reviewed concept/property decisions;
`model/storage.ts` and `model/storage/` author generated layouts. The current
`PropertyDecision` embeds storage metadata. Target authoring separates the seven
contracts while continuing to compile one versioned model representation.

The source manifest pins twelve vocabulary artifacts. Source bytes, model-emitted
Drizzle modules, model reports and selected inventories are intentionally ignored.
The separate OAuth generator retains its reviewed protocol snapshot in Git.
Track source pins, authored models and emitters. A fresh checkout uses
`task artifacts:prepare`; later offline regeneration uses `task artifacts:generate`.
Provider preparation also refreshes the live VNDB contract under its own validation
policy, so it is not identical to restoring an immutable vocabulary artifact.

The generated schema is consumed by main. Other native/operational declarations
remain hand-authored. Migration SQL and the completed installation baseline stay
versioned and are not regenerated as scratch artifacts by preparation.

The 2026-09-18 compiler qualification covers 28 reviewed profiles, 53 property rules
and 55 emitted table declarations, plus its named tests. Those are dated inventory
counts, not full domain coverage. The current datatype implementation is an explicit
XSD subset; QName/XML-context-dependent values remain unsupported. The advisory
SHACL direct-triple projection does not preserve identified duplicate occurrences,
native ordering, transactional writer authority, CAS or erasure. These limits apply
to that projection rather than every possible SHACL model.

Current description commands admit 2,048 statements, 64 declared types and 8 MiB per
revision. They validate selected model/profile meanings and bounded references.
Those command guards do not qualify the target's complete generic-description,
source-query or arbitrary-domain workflow contract. Exact reproduction and earlier
relocation evidence belong to [schema qualification](../testing/schema.md).

## Identity and authority

Private `users`, credentials, sessions, preferences and workload records are
authentication/accountability storage. They are not a second public content model.
Current IAM code already contains mixed subject/role/representation work, but the
complete target remains unqualified. Some retained consumers still depend on
`authEntity`/unique-Self traversal. For example, public activity readers may derive
account preferences using `selfAuthUserIdForEntity`; that behavior does not satisfy
multi-controller Agent disclosure.

Target consumers must preserve many-to-many representation, independent private
account state, public Agent attribution and current revocation. Renaming fields
without changing the traversal/policy does not qualify the replacement. See
[identity acceptance](../testing/identity-and-access.md) and
[open regressions](../testing/known-failures.md).

## Routing and language

`@rezics/slug` currently uses ASCII labels, fixed users/realms/zones namespaces and
a small fixed path depth. `unit_slug_address` permits only one canonical entry per
target. The target supports Unicode namespace policies and context-specific address
preferences, with typed UUID/slug/fixed/resolver routing and reverse links.

Current routes include `/user/{id}`, `/u/{slug}`, `/realm/{id}`, `/r/{slug}`,
`/zone/{id}` and `/z/{slug}`. These are current implementation identifiers, not a
requirement that new routing preserve old URLs. The API/SDK, navigation, search
execution, SEO and renderer must change as a qualified scope.

The current `zone_page` relation owns Page Posts within a Zone. Current page and
Dock query endpoints select those stored documents. The target instead checks the
resolved Resource, route generation and selected content, then shares the renderer
and query execution contracts without copying a body into each Space.

Content-consumption language parsing uses the pinned IANA registry through
`@rezics/content-language`. Other metadata/API/localization paths still use
`ContentLanguageValues = ["zh", "en", "ja", "ko", "de", "fr", "es"]`.
The finite UI locale list is valid for translated interface delivery; the closed
metadata list is an implementation gap, not the target content-language universe.
The current 64-entry consumption-support document limit and rule localization
limits likewise do not establish lifetime name/translation limits.

The existing SEO entry `GET /api/v1/units/by-id/{unitId}/seo` is a sanitized projection.
Its earlier global-parent/seven-localization/Page access assumptions do not qualify
the owner-local, open-language, scoped-address target. Use current APIs as observed
behavior while implementing [Resource SEO](../architecture/resource-landing-seo.md).

## Measurements and reference ranking

Current measurement readers expose `heightMillimetres`, `weightGrams`,
`bustMillimetres`, `waistMillimetres` and `hipsMillimetres`; some context readers
bound a batch to eight IDs. Those API/presentation fields do not define the full
QuantityValue/Observation model or a lifetime limit on semantic contexts.

Earlier reference APIs rank a bounded active Alias/External Link set and use
`voteSummary`, viewer votes and rank-version cursors. The selected native NameRecord
model admits many languages and same-language variants; its replacement query/index
and projection contracts require qualification. Exact older fixture measurements
remain in [foundation evidence](../testing/foundation.md#historical-reference-list-fixture).

Studio currently has Profile/Realm-named candidate and participation projections.
They must be reconciled with direct Principal, represented Agent and recipient-set
paths; renaming a Profile key is not proof of mixed-authority behavior. The target
keeps private visits separate from public Agent contribution history.

## Operational and historical evidence

[Operations](../operations/production-deployment.md) and package/service READMEs
describe actual commands and deployment boundaries. Released migrations remain
append-only. [Release records](../releases/README.md) describe their own versions;
do not apply an old destructive cutover as current architecture guidance.

Earlier tests and measurements keep their IDs, versions, counts and limitations.
They do not automatically pass Resource/Agent naming, shared Space, scoped routing,
open-language or full model acceptance. The target's
[MODEL01-MODEL40](../testing/model-contracts.md) remain prospective until executed.
