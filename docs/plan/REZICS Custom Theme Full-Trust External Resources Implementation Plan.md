# REZICS Custom Theme Full-Trust External Resources Implementation Plan

Status: Proposed

Owner: Domain / Web Platform

Prepared: 2026-08-29

Code baseline: [`86642c2ebaa767b6195636275b4c3c298ac2fa5a`](https://github.com/rezics/rezics/commit/86642c2ebaa767b6195636275b4c3c298ac2fa5a), which matched `origin/main` when this plan was prepared.

## 1. Decision

REZICS will replace the current constrained Zone stylesheet preview with a generic, full-trust Custom Theme model. Approved theme HTML, CSS, and JavaScript execute in the first-party Unit page. They are reviewed frontend code, not sandboxed third-party content.

This plan has one implementation phase:

1. **Implemented scope — `external_live`:** external HTTPS CSS and JavaScript are permitted because REZICS cannot yet ingest and host their complete dependency closure. This mode is an explicitly unsealed development preview. Core trusted member status remains the governance criterion for admission, but it is not runtime authority. Submission, review, installation, and execution are enforced through explicit Profile capabilities and ordinary resource authorization. Anonymous viewers and authenticated Profiles without the required active capabilities receive the platform fallback and never receive the theme resources.

Approval proves what reviewers inspected at a particular time; it does not prove that a remote server will return the same bytes later. The persisted contract and user-facing governance must never describe `external_live` as an immutable artifact closure.

Future self-hosting is not an implementation phase in this plan. The owning TSDoc records only the intended direction: a future contract should self-host the complete executable and style-affecting dependency closure. This note creates no current `self_hosted` manifest variant, persistence state, builder, storage system, migration, delivery milestone, or acceptance criterion. Implementing self-hosting requires a separate approved plan.

Public or anonymous execution also remains a separate product and security decision.

## 2. Why this is the right temporary compromise

The current alternative is not a reliable middle ground. The repository's styling contract scopes selectors and rejects several CSS mechanisms, but it does not establish a complete property-and-value capability system. Completing and maintaining a robust host-document CSS sandbox while also designing an isolated JavaScript application runtime would be a substantial platform program.

For REZICS's present scale, a small governance-approved cohort and complete human review can be a reasonable operational boundary. The cohort informs who may be granted access; the access system remains the only runtime proof. It is cheaper and more honest to treat an approved theme as deployed first-party frontend code than to imply that arbitrary same-document CSS or JavaScript has been made safe through partial filtering.

The temporary use of external resources is a distinct additional risk. Third-party JavaScript executes with the privileges of the containing page, and remote bytes can change after review. OWASP identifies loss of change control, arbitrary code execution, and data disclosure as central third-party JavaScript risks. SRI can pin directly referenced scripts and styles, but it does not automatically prove every dynamically discovered or imported dependency. REZICS therefore needs a resource-mode distinction instead of one ambiguous `approved` state.

## 3. Terminology

**Custom Theme**
: A reusable Unit that owns identity, localization, authorship, discovery metadata, and immutable revisions.

**Custom Theme revision**
: An immutable submitted manifest, REZICS-hosted fragments/files, review evidence, and resource policy. A revision never follows `latest` and never changes resource mode after creation.

**Top-level Unit render host**
: The Unit that owns the current route's full document presentation. A Unit shown in a card, list, search result, reference, nested Block, or embedded surface is not a render host and cannot activate presentation customization.

**Unit presentation document**
: Unit-owned Block content for semantic `header` and `footer` document-flow regions. This content is independent of a theme revision.

**Theme fragment**
: Revision-owned reviewed HTML appended to an explicit presentation slot. Theme fragments are not mutable strings stored on the host Unit.

**`external_live` resource mode**
: A reviewed manifest whose CSS or JavaScript can be fetched from external HTTPS origins at page-execution time. Review evidence records observed bytes, but the live dependency graph is not closed.

**Future self-hosting direction**
: A TSDoc-only note that a future contract should host the complete set of bytes capable of affecting executable behavior or styling. It is not a current resource mode or implementation commitment.

**Core trusted member**
: A governance classification for a small, accountable cohort selected for operational need, security awareness, review discipline, and incident-response responsibility. It guides who should receive the external-live access capability and must be periodically recertified. It is not a role, capability, database grant, or runtime authorization fact. Classification alone never permits an operation, and holding a capability does not eliminate the governance obligation.

**External-live access grant**
: An active, unrevoked, unexpired `platform.custom_theme.external_live.access` capability grant to one Profile. It is the runtime eligibility proof for v0 Custom Theme participation and execution, subject to the other operation-specific policies.

## 4. Goals and non-goals

### 4.1 Goals

- Give governance-approved designers enough freedom to implement Cnblogs/WordPress-style whole-page presentation: appended header/footer HTML, unrestricted host-document CSS, and JavaScript lifecycle code.
- Make Custom Theme identity, revision, installation, target contract, and resource mode generic across Unit kinds.
- Ship only a top-level `zone` host adapter in Phase 1.
- State in the owning TSDoc contract that `zone_page` is the next intended host adapter without promising a release date or compatibility guarantee.
- Keep Unit-owned semantic header/footer Block content separate from revision-owned HTML/CSS/JS.
- Preserve exact-revision review, explicit installation, rollback, global kill, viewer fallback, and a recovery route outside the customized surface.
- Allow external CSS/JS temporarily without misrepresenting the resulting security guarantee.
- Enforce external-live eligibility through the canonical access system while retaining core trusted member admission and recertification as governance policy.
- Record the intended future self-hosting direction in the owning TSDoc without adding an unimplemented runtime or persisted state.
- Keep request-path and recurring work bounded at the repository's 500,000,000-row planning baseline and its 3,000,000,000-row estimate.

### 4.2 Non-goals

- Protect the first-party DOM, storage, authenticated APIs, or platform UI from an approved full-trust theme.
- Make human review equivalent to a deterministic sandbox.
- Support ordinary community authors or public execution in Phase 1.
- Support activation from nested Unit renderings.
- Promise `zone_page` support in Phase 1.
- Build a public theme marketplace, payment system, iframe application platform, bounded CSS language, or AI approval system in this program.
- Implement a self-hosting builder, artifact-closure ingestion, content-addressed theme storage, or a `self_hosted` manifest/resource mode.
- Preserve the unreleased `/zone-themes` API, `zone_theme` Unit kind, old styling contract, or compatibility aliases.

## 5. Current repository baseline

At the recorded baseline:

- `ZoneThemeDocument.custom` stores `{ themeUnitId, revisionId }` inside Zone appearance data in [`libraries/block/src/domain-documents.ts`](../../libraries/block/src/domain-documents.ts).
- [`services/main/src/services/database/schema/zone-theme.ts`](../../services/main/src/services/database/schema/zone-theme.ts) defines `zone_theme`, CSS-only revisions, and image-asset bindings.
- [`services/main/src/services/api/zone-themes`](../../services/main/src/services/api/zone-themes) exposes Zone-specific submission, review, decision, kill, and revalidation routes.
- [`libraries/block/src/styling-contract.ts`](../../libraries/block/src/styling-contract.ts) and [`services/main/src/services/zone-themes/stylesheet.ts`](../../services/main/src/services/zone-themes/stylesheet.ts) implement styling contract `3.0.0`, AST validation, selector rewriting, and external-URL rejection.
- [`apps/web/features/zones/components/zone-surface.tsx`](../../apps/web/features/zones/components/zone-surface.tsx) hard-codes `ZoneHeader -> ZoneDockContent -> route children` inside `ZoneThemeContent`.
- [`apps/web/features/zones/components/zone-header.tsx`](../../apps/web/features/zones/components/zone-header.tsx) derives Menu Blocks from the Dock and mixes Unit identity with follow/manage actions.
- A custom stylesheet is returned only when the viewer is authenticated, has `platform.development_preview.access`, and has not disabled custom Zone themes. Phase 1 should preserve that release gate and add a separate external-live access capability; the development-preview capability must not become domain authority.
- The accepted architecture currently states that scripts never execute in the host page. That decision must be superseded explicitly; leaving both statements in force would make the repository contract contradictory.

The commit that introduced the current Zone theme migration, `ced5226cb2530ce3ea044b539de28f09f8b26ca3c`, was not contained by an existing root release tag when this plan was prepared. Implementation must recheck that fact. If it remains unreleased, replace the old migration cleanly and document reset/cutover instructions for development databases. If a root release tag has included it by then, preserve released migration history and add a forward migration instead.

## 6. Trust model

### 6.1 Approved code has first-party privilege

Theme CSS and JavaScript execute in the REZICS document. Approved code can:

- inspect and modify the entire page DOM;
- hide, replace, or imitate platform controls;
- read data already present in the page;
- observe user interactions available to page JavaScript;
- use browser storage available to the REZICS origin;
- issue same-origin authenticated requests subject to the platform's normal API authorization and CSRF defenses;
- contact external services allowed by the document's runtime resource policy;
- consume CPU, memory, network, and rendering resources.

No selector scope, React boundary, TypeScript type, TSDoc comment, or review status changes these browser privileges. An approved revision must be treated operationally like a REZICS frontend deployment.

### 6.2 Phase 1 adds remote supply-chain trust

In `external_live` mode, the trusted computing base also includes every remote operator capable of changing a loaded resource, its DNS and TLS delivery path, its CDN configuration, and any transitive resource it can select at runtime.

Review can record a byte snapshot and detect later drift. It cannot eliminate the interval between an upstream change and REZICS detecting or killing that revision. SRI narrows this risk for directly pinned resources: the browser compares fetched bytes with the declared digest before executing a script or applying a stylesheet. Cross-origin SRI requires CORS and `crossorigin="anonymous"`. A remote resource that changes under a pinned URL then fails closed for that load; it does not update automatically.

A root SRI value is not a claim about an entire module or stylesheet graph. Static and dynamic module imports, `@import`, runtime script injection, workers, WASM, and resources selected by code must be inventoried separately. Import-map integrity can attach integrity metadata to module URLs, but REZICS must verify its supported-browser matrix before treating it as an enforcement baseline.

### 6.3 Review is governance, not isolation

The review decision means:

> The reviewers accept first-party execution of the inspected code, for the recorded host scope and execution audience, under the recorded resource mode.

It does not mean:

> The code cannot exceed a sandbox, or all future bytes returned by external origins have been approved.

### 6.4 Phase 1 execution audience

Core trusted member admission is the human governance prerequisite for granting external-live access. The renderer does not query or infer that classification. All of the following machine-verifiable conditions are required before an `external_live` revision is emitted to a browser:

- the viewer is authenticated;
- the viewer holds the existing `DevelopmentPreviewCapability` release gate;
- the viewer has an active `CustomThemeExternalLiveAccessCapability` grant;
- the viewer preference permits custom themes;
- the current route has a registered top-level host adapter;
- the host kind is `zone`;
- the installation pins an exact revision;
- the revision has an active host-scoped approval for that exact Zone;
- the target contract and resource mode are supported;
- the revision is not killed, rejected, stale, or awaiting revalidation;
- the request is not in safe mode;
- platform customization execution is not globally disabled.

Failure of any condition returns the ordinary appearance and Unit content without theme fragments or theme resources. Public, anonymous, and authenticated viewers without both required capabilities never receive Phase 1 CSS/JS URLs in API payloads or HTML.

## 7. Capability and authorization model

### 7.1 Canonical capability vocabulary

Use `@rezics/access` as the sole capability registry. `DevelopmentPreviewCapability` remains the common release gate for every unreleased product surface. It is necessary during v0 but never sufficient for a Custom Theme operation.

Add these two external-live access capabilities:

```text
platform.custom_theme.external_live.access
platform.custom_theme.external_live.access.manage
```

Retain generic operation-specific control-plane capabilities for review and emergency kill:

```text
platform.custom_theme.review
platform.custom_theme.kill
```

Recommended exported TypeScript names:

```ts
CustomThemeExternalLiveAccessCapability
CustomThemeExternalLiveAccessManageCapability
CustomThemeReviewCapability
CustomThemeKillCapability
```

Do not add feature-specific preview, author, or install capabilities. Authoring remains subject to ordinary Unit creation/update authorization, and installation remains subject to the host Unit's theme-management permission. The external-live access capability is an additional conjunctive eligibility gate, not a replacement for those policies.

### 7.2 Operation matrix

Authorization is conjunctive and deny-by-default:

| Operation | Required authorization |
| --- | --- |
| Create a Custom Theme Unit | development-preview capability + external-live access capability + ordinary Unit-create authorization |
| Submit a revision | development-preview capability + external-live access capability + update permission on the Custom Theme Unit |
| Inspect review material | development-preview capability + external-live access capability + review capability |
| Approve or reject | development-preview capability + external-live access capability + review capability; reviewer must differ from submitter |
| Install on a host | development-preview capability + external-live access capability + theme-management permission on the host Unit |
| Execute/view Phase 1 | development-preview capability + external-live access capability + viewer opt-in |
| Grant, renew, or revoke external-live access | fresh session + external-live access-management capability; actor and target must differ |
| Kill globally | kill capability; emergency kill does not depend on external-live access eligibility |

Zone ownership or `zone.theme.manage` alone must not authorize full-trust installation. `DevelopmentPreviewCapability` alone must not authorize authoring, review, installation, execution, or kill. `CustomThemeExternalLiveAccessCapability` makes a Profile eligible to attempt those v0 operations but grants none of their resource-specific authority by itself.

### 7.3 Delegated access administration

The access delegation chain is:

```text
platform.access.manage
└── grants platform.custom_theme.external_live.access.manage
    └── grants, renews, or revokes platform.custom_theme.external_live.access
```

`platform.access.manage` should imply `platform.custom_theme.external_live.access.manage` so root platform access administrators can use the narrow workflow. The narrow management capability:

- does not imply external-live access;
- does not imply `platform.access.read` or `platform.access.manage`;
- cannot grant or revoke itself, any other capability, or any Unit permission;
- cannot target the acting Profile;
- can read only the target Profile identity fields needed for selection and the current external-live access grant, not the target's complete platform capability set;
- requires a fresh authenticated session for every mutation.

Do not authorize the existing whole-Profile platform-access replacement endpoint with this narrow capability. That endpoint accepts an arbitrary capability set and would turn narrow delegation into general platform access administration. Add a capability-specific mutation whose input cannot name a capability:

```text
PUT /platform-access/profiles/:profileId/custom-theme-external-live-access
```

```ts
type SetCustomThemeExternalLiveAccessBody =
  | {
      expectedRevision: string;
      state: "granted";
      expiresAt: string;
    }
  | {
      expectedRevision: string;
      state: "revoked";
    };
```

The server hard-codes `CustomThemeExternalLiveAccessCapability`, parses the discriminated body, verifies optimistic concurrency, and records grant, renewal, or revocation atomically with an audit event. An ordinary enabled grant must expire no later than 90 days after creation. The reserved Bootstrap platform administrator alone holds a permanent, self-issued grant installed with the complete Bootstrap policy. Renewal of an ordinary grant revokes the old lifecycle row and creates a new expiring row; it never extends stored history in place.

### 7.4 Governance policy

Core trusted member status remains the admission standard for the initial cohort. Governance owners should grant external-live access only after recording:

- the Profile's operational need and accountable identity;
- completion of the full-trust and mutable-remote-code risk briefing;
- the expected author, reviewer, installer, or test responsibilities;
- acknowledgement of safe mode, incident reporting, and credential/data-handling duties;
- the approving access manager and the recertification deadline.

External-live access managers are a smaller governance subset selected for access-administration judgment and accountability. Core trusted member classification alone does not authorize access management, and an access manager must not approve their own execution eligibility. The reserved Bootstrap platform administrator is a system-installation exception, not a precedent for delegated access managers.

Recertification occurs at least as often as the 90-day access-grant lifetime. Leaving the cohort, losing the operational need, failing review obligations, or creating an incident risk requires prompt capability revocation. Governance records explain why a grant should exist; only the active capability grant proves runtime access.

Every server operation and render projection must enforce the required capabilities and resource policy. UI hiding, governance labels, and TSDoc are explanatory layers only.

## 8. TSDoc contract

Put the maturity and trust annotation on the owning exported boundary, not on every helper. The manifest/host contract should carry `@alpha` and remarks equivalent to the following:

```ts
/**
 * Hosts an approved full-trust customization for a top-level Unit route.
 *
 * @remarks
 * Revision HTML, CSS, and JavaScript execute in the first-party REZICS
 * document without DOM, CSS, storage, network, or authenticated-request
 * isolation. Treat an enabled revision as deployed REZICS frontend code.
 *
 * The `external_live` resource mode may load CSS and JavaScript whose remote
 * bytes can change after review. Its approval covers the immutable manifest,
 * the review snapshot, the recorded host scope, and the capability-gated
 * preview audience; it does not prove an immutable transitive artifact
 * closure.
 *
 * A future contract is intended to replace live executable and style
 * dependencies with a REZICS-hosted immutable closure. This records design
 * direction only: v0 does not implement, accept, or persist a `self_hosted`
 * mode, and this comment is not a delivery commitment.
 *
 * Server-side capabilities are authoritative for submission, review,
 * installation, execution, and emergency revocation. Documentation tags do
 * not enforce access.
 *
 * V0 emits `external_live` resources only when the authenticated viewer has
 * both the common development-preview release gate and an active
 * `CustomThemeExternalLiveAccessCapability` grant. "Core trusted member" is
 * an admission and recertification policy, not a runtime authorization fact.
 *
 * Contract v0 supports top-level `zone` hosts only. The next intended host
 * adapter is top-level `zone_page`. Cards, lists, references, embedded Blocks,
 * and other nested Unit renderings never activate this customization.
 *
 * @alpha
 */
export interface UnitPresentationHostContractV0 {
  // ...
}
```

The current resource-mode literal should also be documented once at its owning exported schema. It remains a single-value contract because the implementation proves only `external_live`:

```ts
/**
 * Identifies the v0 external-live resource policy.
 *
 * @remarks
 * A future contract is intended to add REZICS-hosted executable and style
 * dependencies, but v0 neither implements nor accepts that state. Adding it
 * requires a separately approved design, schema, migration, and review model.
 *
 * @alpha
 */
export const CustomThemeResourceModeV0 = "external_live" as const;
export type CustomThemeResourceModeV0 = typeof CustomThemeResourceModeV0;
```

## 9. Target contract and activation semantics

The generic contract identifier is:

```text
rezics.unit.presentation@0
```

Version `0` communicates that this is a development-preview contract with no compatibility promise. The platform, not a theme author, registers adapters for Unit kinds.

The v0 registry contains exactly:

```text
target: rezics.unit.presentation@0
host kind: zone
activation: top-level route host only
```

The owning TSDoc records the following future direction, but it is not a v0 registry entry:

```text
target: rezics.unit.presentation@0 (or its then-current successor)
host kind: zone_page
activation: top-level Zone Page route host only
```

Support for `zone_page` requires a separate later implementation proposal; the current plan records only the intent. Installation validation rejects every unregistered host kind.

## 10. Composition model

### 10.1 Unit-owned document-flow regions

Header and footer are generic Unit presentation regions, not Dock kinds and not Zone-specific domain concepts. Store one sparse document per customized top-level host and target contract:

```text
unit_presentation_document
- host_unit_id
- target_contract
- document                 // { header: BlockDocument, footer: BlockDocument }
- latest_revision_id
- created_at
- updated_at

PRIMARY KEY (host_unit_id, target_contract)
```

The exact persistence should reuse the repository's normal Unit revision/history mechanism rather than invent mutable JSON without audit history. No row is needed when both regions use platform defaults.

The semantic render tree is:

```text
UnitPresentationHost
├── platformHeader
│   └── adapter-owned identity, navigation, and actions
├── header
│   ├── optional Unit-owned Header Block document
│   └── approved theme fragment: header.append
├── main
│   └── normal route content
└── footer
    ├── Unit-owned Footer Block document
    └── approved theme fragment: footer.append
```

For the Zone adapter:

- keep the adapter-owned Zone identity, Dock navigation, and platform actions in an invariant
  `platformHeader` that a Unit-owned Header document does not replace;
- project top-level Menu Blocks from the Dock into that platform Header while retaining Dock
  ownership and `surface = dock` semantics;
- render the remaining Dock Blocks in the main Dock composition region;
- treat the optional Unit-owned Header Block document as additive presentation content;
- keep route content in `main`;
- render the footer after main content in document order.

### 10.2 Theme-owned fragments

Phase 1 supports only two fragment slots:

```text
header.append
footer.append
```

The revision owns these HTML fragments. They are submitted, stored, hashed, and reviewed with the revision. Do not add `customHtml`, `customCss`, or `customJs` mutable columns to a Zone or `unit_presentation_document`; even a one-off private customization is represented by an unlisted Custom Theme Unit with a host-scoped revision.

Script execution is manifest-managed. `<script>` elements embedded inside an HTML fragment are not used as the lifecycle contract. The importer extracts/rejects them and requires scripts to be declared in the manifest, producing deterministic load order and cleanup behavior. This is an execution protocol, not a security restriction on what approved JavaScript may do after mounting.

### 10.3 Platform controls

Full-trust code can alter platform controls in the same document. The architecture must not claim otherwise. Recovery therefore cannot rely exclusively on an in-page button that the theme can hide or break.

Provide all three controls:

- a server-recognized `?rezics-safe-theme=1` navigation that emits no customization manifest or resource;
- an appearance/settings route that never activates Unit customization;
- a platform-wide emergency disable checked before render projection resolution.

The ordinary in-page “use default theme” control remains useful, but it is not the recovery boundary.

## 11. Typed manifest and proof boundaries

The manifest is an external input and must be parsed at runtime. Submission, reviewed evidence, and executable resolution are different states with different guarantees. Do not represent all three as one interface plus `approved: boolean`.

An illustrative contract is:

```ts
type PackagedResourceReference = { kind: "packaged"; path: string };

type SubmittedExternalLiveResourceReference =
  | PackagedResourceReference
  | {
      kind: "external";
      url: HttpsUrl;
      integrity?: SriMetadata;
      integrityWaiverReason?: string;
    };

interface SubmittedStyle<Resource> {
  source: Resource;
  media?: string;
  required: boolean;
}

interface SubmittedScript<Resource> {
  source: Resource;
  role: "classic_dependency" | "module_entry";
  order: number;
  required: boolean;
}

interface SubmittedCustomThemeManifestBaseV0 {
  schemaVersion: 0;
  targetContract: "rezics.unit.presentation@0";
  executionMode: "host_full_trust";
  fragments: readonly {
    slot: "header.append" | "footer.append";
    source: PackagedResourceReference;
  }[];
  declaredRuntimeOrigins: Readonly<{
    connect: readonly HttpsOrigin[];
    image: readonly HttpsOrigin[];
    font: readonly HttpsOrigin[];
    media: readonly HttpsOrigin[];
  }>;
}

type SubmittedCustomThemeManifestV0 = SubmittedCustomThemeManifestBaseV0 & {
  resourceMode: "external_live";
  styles: readonly SubmittedStyle<SubmittedExternalLiveResourceReference>[];
  scripts: readonly SubmittedScript<SubmittedExternalLiveResourceReference>[];
};
```

The review fetcher derives, rather than trusts, evidence such as:

```ts
interface ReviewedExternalResource {
  requestedUrl: HttpsUrl;
  finalUrl: HttpsUrl;
  redirectChain: readonly HttpsUrl[];
  observedSha256: Sha256Hex;
  observedByteLength: number;
  observedContentType: string;
  observedAt: string;
  corsAllowsAnonymous: boolean;
  effectiveIntegrity: SriMetadata | null;
  integrityWaiverReason: string | null;
}
```

The runtime resolver returns the executable state only after current database and policy checks:

```ts
interface ResolvedCustomThemeRevisionV0 {
  resourceMode: "external_live";
  executionAudience: "capability_gated_preview";
  approvalScope: { kind: "host_unit"; hostUnitId: string };
  manifest: ReviewedExternalLiveManifestV0;
}
```

V0 has no second resource branch. The schema, database row, generated API type, and frontend loader must preserve the exact `"external_live"` literal end to end. The future direction recorded in TSDoc must not appear as an accepted manifest value or resolved runtime state.

## 12. Persistence model

### 12.1 Custom Theme identity and revision

```text
custom_theme
- id -> unit.id
- created_at
- updated_at
```

```text
custom_theme_revision
- id
- custom_theme_unit_id
- target_contract
- execution_mode             // host_full_trust
- resource_mode              // external_live in v0
- manifest_document
- manifest_sha256
- source_archive_sha256
- review_state
- approval_scope             // host_unit in v0
- approved_host_unit_id
- submitted_by_profile_id
- reviewed_by_profile_id
- reviewed_at
- decision_reason
- killed_by_profile_id
- killed_at
- created_at
- updated_at
```

Required database invariants include:

- `resource_mode` is constrained to `external_live` in v0;
- `external_live` implies host-scoped approval;
- host-scoped approval implies a non-null `approved_host_unit_id`;
- reviewer and submitter differ on approval;
- killed/rejected/revalidation-required revisions cannot resolve for execution;
- approval never changes a revision's manifest or resource mode;
- a 64-character lowercase SHA-256 format check applies to every SHA-256 column;
- JSON columns are objects and are always parsed through the authoritative TypeBox contract before use.

### 12.2 Revision files

```text
custom_theme_revision_file
- revision_id
- path
- role                       // html | css | js | worker | wasm | font | svg | asset
- content_type
- sha256
- byte_length
- storage_key
- created_at

PRIMARY KEY (revision_id, path)
```

In v0 this table stores the manifest, source archive, and HTML fragments. It may also store author-provided packaged CSS/JS declared by an `external_live` manifest. It does not represent or claim a complete delivered dependency closure.

### 12.3 External resource review evidence

```text
custom_theme_revision_external_resource
- revision_id
- resource_key
- role
- requested_url
- final_url
- observed_sha256
- observed_byte_length
- observed_content_type
- integrity_metadata
- integrity_waiver_reason
- cors_allows_anonymous
- observed_at
- current_health_state       // current | drifted | unavailable | unchecked
- last_checked_at
- created_at

PRIMARY KEY (revision_id, resource_key)
```

This table is evidence and monitoring state, not an artifact-closure guarantee. Redirect chains, response headers, transitive-discovery findings, and reviewer notes belong in bounded review-evidence storage rather than unbounded columns on the request-path row.

### 12.4 External-live access grants

Reuse the existing `platform_capability_grant` lifecycle instead of creating a Custom Theme membership table. Add the two canonical enum values and definitions through `@rezics/access`, the database migration, API schemas, generated clients, localization, bootstrap policy, and tests.

The external-live access capability has stricter service policy than ordinary platform capabilities:

- ordinary grants require `expires_at` no later than 90 days after the service mutation;
- ordinary grants require `profile_id` to differ from `granted_by_profile_id` through both narrow and root workflows;
- the reserved Bootstrap platform administrator alone may hold a permanent, self-issued grant installed by the trusted Bootstrap path;
- only one active row exists for `(profile_id, capability)` under the existing partial unique index;
- renewal revokes the current row and inserts a new row in the same transaction;
- expiry or revocation makes the next server-side authorization decision deny access.

Enforce the ordinary expiry and self-grant invariants in the capability grant service. Parse the exact Bootstrap exception as a distinct `permanent` state and reject any other null-expiry external-live row at the service boundary. The management capability uses the ordinary platform grant lifecycle but does not imply external-live access.

The request-path lookup remains the existing indexed active-grant query by Profile and capability. Capability-decision caching must be request-local, or otherwise invalidated on grant changes; a cached HTML or API projection containing theme resources must be partitioned by the complete authorization result and must never be shared with a denied viewer. Revocation cannot undo code already executed in an open document, so incident response still uses revision kill, global disable, and safe navigation.

### 12.5 Installation

```text
unit_custom_theme_installation
- host_unit_id
- target_contract
- revision_id
- installed_by_profile_id
- created_at
- updated_at

PRIMARY KEY (host_unit_id, target_contract)
FOREIGN KEY (revision_id, target_contract)
  -> custom_theme_revision(id, target_contract)
```

Do not duplicate `host_unit_kind` or `custom_theme_unit_id`. The Unit row proves kind; the revision proves Theme identity. Installation always pins an exact revision and never follows a moving Theme version.

### 12.6 Zone appearance

Rename and narrow `ZoneThemeDocument` to `ZoneAppearanceDocument`. It retains safe product tokens such as color scheme, accent, density, radius, and heading scale. Remove the custom revision reference. Move hero and other semantic/decorative content to Unit-owned presentation content or a separately owned backdrop configuration.

The installation table becomes the sole source of an active Custom Theme revision. Appearance tokens remain the fallback for every failure or disabled state.

## 13. Phase 1 external-resource policy

### 13.1 What is allowed

- HTTPS external stylesheet URLs.
- HTTPS external classic scripts and ES-module entrypoints.
- Static and dynamic dependencies used by approved code.
- Runtime connections and media required by the reviewed theme, recorded as review inventory.
- REZICS-hosted manifest, HTML fragments, and any files the author can already submit.

This is intentionally full-trust. The policy does not claim to constrain what approved code can do after execution.

### 13.2 Direct resource requirements

Every directly declared external script or stylesheet must have:

- an exact HTTPS URL, not a floating shorthand;
- a recorded final URL and redirect chain;
- observed content type, byte length, digest, and review timestamp;
- `crossorigin="anonymous"` and SRI when the provider supports CORS and stable bytes;
- an explicit, reviewer-approved waiver when SRI cannot be used;
- deterministic load order and required/optional status;
- an owner and incident contact in review metadata.

Versioned/content-addressed URLs are strongly preferred. A provider's `latest`, mutable branch URL, tag-manager response, or unversioned loader requires an explicit waiver and cannot be described as pinned.

### 13.3 Transitive graph review

The automated reviewer must perform bounded best-effort discovery of:

- CSS `@import`, `url()`, fonts, SVG, and images;
- static ES-module imports;
- import maps and their integrity metadata;
- workers, shared workers, service-worker registration attempts, WASM, and dynamic-import syntax;
- runtime script/link creation and known loader patterns;
- external `connect`, image, font, frame, and media origins observed during reference renders.

Because JavaScript can compute URLs or fetch configuration dynamically, this discovery is evidence, not proof of closure. Review UI must display that limitation.

### 13.4 Review fetcher safety

REZICS's server-side review fetcher processes author-controlled URLs and therefore needs an SSRF-safe egress boundary:

- accept HTTPS only;
- reject credentials, fragments, non-default ambiguous ports, and malformed hostnames;
- resolve and reject loopback, private, link-local, multicast, metadata-service, and other non-public addresses for both IPv4 and IPv6;
- re-resolve and revalidate every redirect target;
- do not forward REZICS cookies, authorization headers, or ambient credentials;
- bound redirects, response bytes, decompressed bytes, time, concurrency, recursion depth, and total graph nodes;
- isolate fetch workers from internal networks and cloud metadata by network policy;
- record the response actually reviewed, not only the submitted URL.

### 13.5 Drift and availability

For SRI-pinned direct resources, a byte change causes browser load failure. For waived resources, changed code may execute until detection. Therefore:

- hash all direct external resources on a recurring bounded queue;
- process by keyset cursor and apply per-origin concurrency/backoff;
- mark a revision `revalidation_required` when any executable/style resource drifts or changes redirect target/content type/CORS behavior, or when any required resource becomes unavailable;
- invalidate its resolved-revision cache and fall back on subsequent renders;
- provide immediate manual kill for incidents;
- never auto-approve changed bytes;
- require a new revision or a fresh explicit review decision.

The initial monitoring objective for waived executable/style resources is a five-minute maximum scheduling interval, with alerting when queue age exceeds that objective. An unpinned imported stylesheet, module, worker, WASM payload, or other executable/style descendant makes that graph unpinned even when its root resource has SRI. Enforce a global admission bound of 1,000 active unpinned executable/style graph nodes; a full sweep is then at most 3.34 requests/second on average before retries, while the 5 MiB per-theme ceiling gives a deliberately conservative worst-case transfer envelope of about 16.7 MiB/second. Only graphs whose executable/style nodes are all integrity-pinned can use a lower-frequency availability/CORS audit. This monitoring does not eliminate the five-minute unpinned-resource risk window and must be described as detection, not prevention.

### 13.6 CSP and integrity deployment

Do not weaken the global application policy to `script-src https:` or `style-src https:`. The selected installation must participate at the request boundary so the server can emit a route- and revision-specific policy before the document loads.

Phase 1 should:

- keep the ordinary application CSP on pages with no active capability-gated external-live theme;
- add only the reviewed revision's required external sources on a qualifying top-level host response;
- use CSP reporting first when introducing the adapter;
- use nonces/hashes for REZICS-owned inline bootstrap code;
- set `object-src 'none'` and preserve the platform's other baseline directives;
- treat CSP as origin/resource-policy enforcement and telemetry, not as isolation from approved code;
- test `Integrity-Policy-Report-Only` for script/style inventory, but not make it a release dependency until the supported-browser matrix is established.

The current client-only Zone projection is insufficient for exact per-document CSP selection. The implementation must add a narrow request-boundary presentation-policy resolver; it must not move ordinary feature composition into `apps/web/app`.

## 14. Review and publication workflow

### 14.1 Submission

1. An authorized author submits the source archive, parsed manifest input, packaged fragments/files, and external URLs.
2. The server parses the manifest and derives a typed submitted representation.
3. Every submission creates a new immutable revision. Editing creates another revision.
4. The server records source and manifest digests before review.

### 14.2 Automated evidence

1. Validate target contract, resource-mode shape, file paths, MIME expectations, bounds, and ownership.
2. Fetch external resources through the isolated review fetcher.
3. Record direct resource snapshots and best-effort transitive discovery.
4. Inspect dependencies and licenses; reject known prohibited or incompatible material.
5. Render reference fixtures using a disposable reviewer identity with no production credentials.
6. Record console errors, network destinations, load failures, lifecycle cleanup failures, layout/performance measurements, and responsive/accessibility evidence.

Automated evidence informs the reviewer. It never grants approval automatically in Phase 1.

### 14.3 Human review

The reviewer must inspect:

- all submitted HTML, CSS, JavaScript, manifest entries, and diffs from the previous revision;
- direct and discovered transitive resources;
- same-origin API calls and storage access;
- external data disclosure and tracking;
- platform impersonation, credential collection, deceptive controls, and unsafe navigation;
- accessibility, reduced motion, keyboard use, and failure behavior;
- resource size, long tasks, memory, and cleanup;
- licensing, attribution, content rating, and brand use;
- SRI waivers and mutable URLs;
- the exact host Zone for a host-scoped approval.

The reviewer must differ from the submitter. Approval binds the exact revision, target contract, resource mode, host scope, review evidence digest, and execution audience.

### 14.4 Installation and execution

1. An authorized host manager selects an exact approved revision.
2. The server verifies both required platform capabilities, host kind, target adapter, approval scope, and the host Unit's theme-management permission.
3. The installation row is inserted or atomically replaced.
4. The render resolver rechecks current revision state on each cache fill.
5. Phase 1 resources are emitted only to viewers with both the development-preview release gate and an active external-live access grant.

### 14.5 Update, rollback, and kill

- Updates create and review a new revision; installations never follow `latest`.
- Rollback selects a previously approved, currently valid revision.
- Killing a revision changes revision control state and invalidates caches. It does not scan or rewrite every installation row.
- A killed, drifted, stale-contract, invalid-host, missing-resource, or unauthorized revision resolves to appearance fallback.

## 15. Browser runtime and lifecycle

### 15.1 Loading order

For a qualifying top-level host:

1. Resolve the safe Unit presentation document and appearance fallback.
2. Resolve the exact theme revision and current policy state.
3. Insert reviewed header/footer HTML fragments at their declared append slots.
4. Load styles in manifest order.
5. Load classic dependencies in explicit order.
6. Import one ES-module entrypoint and call `mount(context)`.
7. Mark the customization active only after all required resources and `mount` succeed.

Before the first theme script executes, a required-resource failure must fail closed: remove injected fragments/styles under platform control, skip mount, record telemetry, and show the ordinary fallback. After any theme JavaScript has executed, arbitrary side effects cannot be rolled back atomically. The host performs best-effort disposal and uses a full safe-mode navigation when reliable recovery is required.

### 15.2 Lifecycle API

```ts
export interface UnitPresentationContextV0 {
  readonly hostUnit: {
    readonly id: string;
    readonly kind: "zone";
  };
  readonly targetContract: "rezics.unit.presentation@0";
  readonly headerRoot: HTMLElement;
  readonly mainRoot: HTMLElement;
  readonly footerRoot: HTMLElement;
  readonly signal: AbortSignal;
}

export type MountUnitPresentationV0 = (
  context: UnitPresentationContextV0,
) => void | (() => void) | Promise<void | (() => void)>;
```

The module exports `mount`. The host calls a returned disposer and aborts the signal when leaving the top-level host, switching revisions, or entering safe mode.

Cleanup is best effort. Full-trust code can mutate global state outside platform tracking, so the contract cannot prove complete reversal. Theme enable/disable, revision switch, and safe-mode recovery should use a full navigation when reliable reset matters.

### 15.3 Resource and performance bounds

Bounds protect availability and reviewer workload; they are not a security sandbox. Initial Phase 1 limits are:

- one module entrypoint;
- at most 32 directly declared scripts and 32 directly declared styles;
- at most 128 directly declared external resources in total;
- at most 512 discovered external graph nodes per revision during review;
- at most 5 MiB compressed JavaScript plus CSS per initial load;
- at most 256 KiB total HTML fragments;
- a 10-second required-resource load timeout on the reference network profile;
- no more than one active Custom Theme runtime per document.

Exceptions require a recorded reviewer decision. Reference renders must report LCP/CLS/INP-related evidence, long tasks, total transfer, request count, and memory observations, but the exact production budgets should be calibrated from measured REZICS baselines before implementation acceptance.

## 16. Deferred self-hosting direction — TSDoc only

Self-hosting is not a delivery phase of this plan. The only current requirement is the owning TSDoc statement in [Section 8](#8-tsdoc-contract): a future contract is intended to replace live executable and style dependencies with a REZICS-hosted immutable closure.

That statement records architectural direction, not an accepted runtime state or implementation commitment. This plan must not add:

- a `self_hosted` manifest value, schema branch, generated API variant, or database state;
- a dependency-closure builder or ingestion pipeline;
- build provenance, closure-manifest, or hosted-archive persistence fields;
- content-addressed Custom Theme serving or a self-hosting-specific CSP branch;
- a migration from `external_live`, a public-launch path, or self-hosting acceptance criteria.

A later proposal must define the transitive closure boundary, ingestion and build trust model, storage and serving design, migration, capacity evidence, runtime policy, review operations, and acceptance criteria before any of those concepts enter code or persisted contracts. Until that proposal is separately approved, no current implementation should branch on or reserve an executable self-hosting state.

## 17. Capacity, performance, and scalability

### 17.1 Workload assumptions

The design has two different data classes:

- **Corpus-scale sparse host state:** `unit_presentation_document` and `unit_custom_theme_installation`. Default hosts create no row. The worst case remains one row per Unit and must be planned at 500,000,000 and 3,000,000,000 rows.
- **Governed control-plane state:** Custom Theme access grants, revisions, files, review evidence, and external-resource monitoring. Phase 1 admission is bounded to at most 1,000 active external-live access grants, 100 access managers, 100,000 active revisions, 128 direct external resources and 512 discovered graph nodes per revision, 1,000 active unpinned executable/style graph nodes, and a review queue of 10,000 before submission backpressure closes admission. Expanding those bounds requires a new capacity review.

Initial access patterns are:

- one point lookup by `(host_unit_id, target_contract)` for installation;
- zero or one point lookup for the sparse Unit presentation document;
- one point lookup by revision ID, normally served from a bounded revision-state cache;
- one indexed active-capability lookup for the viewer, shared within the request across policy checks;
- keyset review and monitoring queues by revision/resource key;
- low-frequency installation writes and revision submissions;
- no request-path reverse scan from revision to all installations;
- no offset pagination and no whole-corpus revalidation.

### 17.2 Installation storage estimate

An installation heap row plus primary key, revision foreign-key support, alignment, and row overhead is expected to occupy approximately 170–240 bytes before replication, WAL, free-space overhead, and bloat. This is an estimate to be replaced by `pg_column_size`, relation-size measurements, and representative indexes.

| Rows | Estimated heap + essential indexes |
| ---: | ---: |
| 500,000,000 | 85–120 GB |
| 3,000,000,000 | 510–720 GB |

Keep the primary read path on the leading `host_unit_id`. Hash partition/shard by `host_unit_id` before a single relation approaches operational storage, vacuum, backup, or latency limits. The target-contract value should use a compact registered identifier if measured text/index amplification is material.

### 17.3 Presentation-document storage estimate

Only customized hosts create a presentation document. At an illustrative 4 KiB average serialized document, an all-host worst case is about 2.0 TB of raw document bytes at 500 million rows and 12.3 TB at 3 billion rows, before indexes, history, TOAST overhead, replication, and bloat. Therefore:

- keep current pointers and lookup keys in PostgreSQL;
- reuse immutable Unit revision/history storage;
- move large document payloads to content-addressed object storage when measured relation/TOAST growth justifies it;
- cache by `(host_unit_id, latest_revision_id)`;
- hash partition/shard by host ID;
- bound Block count, document bytes, dependency fan-out, and render work through the Unit presentation contract.

### 17.4 Revision/resource storage estimate

At the enforced Phase 1 bound of 100,000 active revisions and 512 discovered graph nodes each, the conservative maximum active external-resource relation is 51.2 million rows. At an illustrative 400–700 bytes per row plus essential indexes, that is roughly 20–36 GB before operational overhead. A 20-node observed average is 2 million rows instead. Archive terminal evidence and large response metadata to object storage; keep only bounded current-state fields on the monitor queue.

At the existing architecture's longer-term planning cases of 1 million and 6 million live revisions, a 20-file average yields 20 million and 120 million file rows. Current v0 package bytes may use object storage when measured size or database overhead warrants it; PostgreSQL stores bounded metadata such as hashes, roles, sizes, states, and storage keys. This estimate does not pre-design future self-hosting storage.

At 1,000 continuously eligible Profiles and a maximum 90-day grant lifetime, quarterly recertification creates at most about 4,000 external-live access lifecycle rows per year before revocations and corrections. This is bounded control-plane history, not a corpus-scale relation. Retain it in the existing platform capability grant ledger and use its Profile/capability indexes; archive only if whole-ledger measurements, not this feature alone, justify a cutover.

### 17.5 Rates, latency, skew, and backpressure

Initial design targets:

- warm installation/revision resolution database time p95 below 10 ms;
- no more than three bounded data accesses for presentation resolution before ordinary content projection;
- external monitor requests bounded per origin to avoid hot-provider amplification;
- submission admission closes when review queue depth exceeds 10,000, oldest review age exceeds 15 minutes, the unpinned executable/style admission bound is reached, monitor queue age exceeds five minutes for unpinned executable/style resources, or database-pool wait p95 exceeds 50 ms;
- renderer never waits for the server-side drift monitor or live review fetcher;
- external browser-resource failure falls back and emits telemetry rather than retrying without bound.

Representative benchmarks must cover skew: a single popular revision installed on many hosts, a single external CDN used by many revisions, UUIDv7 newest-leaf write concentration, and mass kill/revalidation. Kill is a revision-state/cache-invalidation operation and must remain independent of installation count.

### 17.6 Validation before accepting database work

- Generate representative distributions rather than extrapolating from a few rows.
- Run `EXPLAIN`/`EXPLAIN ANALYZE` for installation resolution, review queues, monitor queues, and host-scoped approval checks.
- Measure heap, index, TOAST, WAL, and cache behavior.
- Test keyset batches, retry/backoff, per-origin rate limiting, and cache invalidation.
- Record thresholds for partitioning, object-storage cutover, and sharding before production growth reaches them.

## 18. API and ownership changes

Replace Zone-specific routes with Custom Theme APIs. Do not keep compatibility aliases because the current feature has not entered a release-tagged support baseline.

Suggested surfaces:

```text
POST   /custom-themes
PUT    /custom-themes/:themeUnitId/localizations/:language
GET    /custom-themes/:themeUnitId/revisions
POST   /custom-themes/:themeUnitId/revisions
GET    /custom-themes/review-queue
POST   /custom-themes/:themeUnitId/revisions/:revisionId/decision
POST   /custom-themes/:themeUnitId/revisions/:revisionId/kill

GET    /platform-access/custom-theme-external-live/profiles
GET    /platform-access/profiles/:profileId/custom-theme-external-live-access
PUT    /platform-access/profiles/:profileId/custom-theme-external-live-access

GET    /units/:hostUnitId/presentation
PUT    /units/:hostUnitId/presentation
PUT    /units/:hostUnitId/custom-theme-installation
DELETE /units/:hostUnitId/custom-theme-installation
```

The exact route grouping may follow existing repository conventions, but ownership must remain generic. The Zone render projection consumes a generic resolved presentation result through its adapter; it does not own Theme lifecycle APIs. The narrow platform-access projection exposes only Profile selection fields and the external-live access grant. It must not return or replace the target's other platform capabilities, and `CustomThemeExternalLiveAccessManageCapability` must never authorize the existing whole-Profile replacement endpoint.

Generated OpenAPI schemas must preserve `resourceMode` as the exact `"external_live"` literal. Review responses must distinguish submitted URLs, platform-derived observations, approval scope, and current health. Public/ordinary viewer projections must not leak Phase 1 resource URLs.

## 19. Frontend architecture

Create a project-owned presentation feature, for example:

```text
apps/web/features/presentation
├── model
│   ├── manifest.ts
│   ├── resolved-presentation.ts
│   └── lifecycle.ts
├── data
├── server
└── components
    └── unit-presentation-host.tsx
```

The Zone feature supplies a narrow adapter under `apps/web/features/zones`. App Router entries remain request-boundary adapters and do not absorb page composition.

`UnitPresentationHost` owns:

- semantic header/main/footer roots;
- applying Unit-owned Block documents;
- fragment insertion;
- deterministic stylesheet/script loading;
- mount/dispose/abort lifecycle;
- fail-closed pre-execution resource gating and best-effort post-execution recovery;
- telemetry;
- safe-mode awareness.

It does not claim to contain approved code. The `host_full_trust` name must remain visible in code and review data.

## 20. Documentation changes

Implementation must update or supersede:

- [`docs/architecture/zone-composition-and-theming-decisions.md`](../architecture/zone-composition-and-theming-decisions.md), especially the permanent “scripts never run” decision;
- [`docs/architecture/zone-composition-and-theming-research-report.md`](../architecture/zone-composition-and-theming-research-report.md), separating historical bounded-CSS research from the accepted trusted-code model;
- the Zone styling reference, which becomes historical or a future `bounded_style` contract rather than the active full-trust contract;
- threat model, core trusted member admission/recertification policy, delegated external-live access runbook, reviewer runbook, external-resource incident runbook, kill/safe-mode runbook, and the owning TSDoc future-direction note;
- API documentation and maintainer-facing capability definitions.

Do not delete the useful constrained CSS compiler. Move or retain it as inactive groundwork for a possible future `bounded_style` execution mode and reviewer linting. It must not reject full-trust revisions under the pretense of providing their security boundary.

## 21. Cutover plan

### 21.1 Before implementation

1. Recheck `origin/main` and release tags.
2. Confirm whether the current Zone theme migration remains unreleased.
3. Record the accepted threat model, the implemented `external_live` scope, the capability delegation chain, the core trusted member governance criteria, and the TSDoc-only future direction in an ADR.
4. Freeze new work on the Zone-specific CSS contract except critical fixes.

### 21.2 Clean model replacement

If the current migration remains unreleased:

- replace `zone_theme` with `custom_theme` in the unreleased migration history;
- remove old routes, schemas, generated clients, permissions, and aliases;
- provide a development/test database reset or one-time cutover note;
- do not ship compatibility views or translation layers.

If it has been released:

- preserve released SQL unchanged;
- add a forward migration to create the new model and migrate supported data;
- include an explicit installation cutover;
- remove runtime compatibility after the migration rather than retaining duplicate APIs.

### 21.3 Existing preview revisions

The current CSS-only revisions cannot silently become `host_full_trust` packages. Either:

- resubmit them as new Custom Theme revisions with an explicit resource mode and target contract; or
- discard/reset them in unreleased development environments.

No current approval is inherited automatically because the execution capability and review object have materially changed.

## 22. Implementation sequence

### Step 1 — contracts and architecture

- Accept the trusted-code threat model and the single implemented `external_live` resource mode.
- Define `rezics.unit.presentation@0` and the top-level host rule.
- Add the owning TSDoc with `@alpha`, explicit Phase 1 risk, and documentation-only future directions.
- Define distinct submitted, reviewed, and resolved schemas without adding an unimplemented resource branch.

### Step 2 — generic persistence

- Replace `zone_theme` with `custom_theme`.
- Add revision files, external-resource evidence, installation, and Unit presentation document storage.
- Narrow Zone appearance data and remove its revision reference.
- Add database invariants and capacity-qualified indexes.

### Step 3 — authorization and APIs

- Add the external-live access and access-management capabilities; retain the shared development-preview gate and generic Custom Theme review/kill capabilities.
- Add the narrow Profile lookup and external-live access mutation without exposing whole-Profile platform access replacement.
- Enforce ordinary non-self-grant, mandatory expiry of at most 90 days, the explicit permanent Bootstrap administrator exception, optimistic concurrency, fresh-session mutation, audit history, and root access-manager compatibility.
- Use ordinary Unit authorization for authoring and host installation, conjunctively with external-live eligibility.
- Implement allowed and denied paths for every operation and access-management transition.
- Replace Zone-specific APIs and regenerate clients.
- Ensure Phase 1 resource URLs are absent from responses to viewers without both required capabilities.

### Step 4 — generic host and Zone adapter

- Implement `UnitPresentationHost` outside `apps/web/app`.
- Register only the top-level Zone adapter.
- Add Unit-owned header/footer Block regions.
- Stop using Dock as the Header's content source.
- Implement manifest-managed fragments, styles, module lifecycle, fallback, and full-navigation reset.

### Step 5 — Phase 1 review operations

- Build the isolated external-resource fetcher and evidence model.
- Add SRI/CORS inspection, waiver workflow, dependency inventory, and reference renders.
- Add drift monitoring, backpressure, telemetry, revalidation, and incident kill.
- Add server-time safe mode and an always-unthemed settings route.

There is no self-hosting implementation step in this plan. Likewise, `zone_page` remains only the next intended adapter recorded in TSDoc; adding it requires later implementation work outside this plan.

## 23. Verification plan

### 23.1 Contract and type tests

- Submitted external manifests cannot be used as reviewed manifests without parsing and derived evidence.
- `resourceMode` accepts and emits only the exact `"external_live"` literal.
- No submitted, reviewed, resolved, generated, or persisted v0 contract contains a reserved self-hosting branch.
- Target/host kinds and slots are closed unions.
- The external-live access mutation body is a parsed discriminated union and cannot carry an arbitrary capability name.
- Canonical capability definitions and implications are derived from `@rezics/access` without a second registry.
- Generated OpenAPI types retain all discriminants and nullability.

### 23.2 Authorization tests

- Cover every capability independently and every conjunctive operation path.
- Prove `platform.access.manage` implies external-live access management, while external-live access management implies neither whole-platform access reads/management nor external-live execution access.
- Prove an external-live access manager cannot target itself, grant its own management capability, name another capability, read the target's unrelated capabilities, or call the whole-Profile replacement endpoint.
- Prove grant, renewal, revocation, expiry, stale-revision conflict, and fresh-session enforcement.
- Prove ordinary enabled access grants require an expiry no more than 90 days after mutation, while only the reserved Bootstrap administrator can hold the permanent self-issued state.
- Prove a Zone manager without external-live access cannot install, and an external-live holder without host theme-management permission cannot install.
- Prove an author cannot approve their own revision.
- Prove a development-preview viewer without external-live access receives fallback.
- Prove an external-live access holder without the development-preview release gate receives fallback while v0 is unreleased.
- Prove revoked and expired access receive fallback on the next request and cannot reuse a cross-viewer cached projection.
- Prove anonymous viewers and authenticated viewers missing either required capability never receive Phase 1 resource URLs.
- Prove emergency kill remains available to the kill capability without external-live access.
- Prove safe mode bypasses all theme resolution.

### 23.3 Persistence and migration tests

- Check exact-revision and target-contract foreign keys.
- Check the single resource-mode literal and host-scoped approval constraints.
- Check service-level non-self-grant and 90-day maximum-expiry policy through every ordinary write path, plus the exact permanent Bootstrap administrator exception.
- Check renewal revokes the prior lifecycle row before inserting its replacement and preserves a single unrevoked row.
- Check kill and revalidation resolution without installation scans.
- Replay migrations with the repository's production-equivalent workflow.
- Verify development cutover instructions against an already-applied unreleased preview database if that case remains relevant.

### 23.4 External-resource tests

- SRI match and mismatch.
- Missing/invalid CORS for pinned cross-origin resources.
- Redirect changes and redirect-to-private-address rejection.
- IPv4/IPv6 private, loopback, link-local, metadata, and DNS-rebinding cases.
- decompression bombs, oversized responses, timeouts, recursion bounds, and per-origin concurrency.
- CSS imports, static/dynamic module references, workers, WASM, and runtime resource discovery.
- drift, outage, recovery, and explicit reapproval.

### 23.5 Runtime tests

- Top-level Zone activation and nested Unit non-activation.
- Header/footer document order and append slots.
- deterministic dependency and stylesheet order.
- mount success, async failure, timeout, abort, disposer, route leave, revision switch, and safe-mode navigation.
- fail-closed required-resource handling before script execution and safe full-navigation recovery after execution begins.
- kill during an active session and on the next navigation.
- viewer preference fallback.

### 23.6 Deterministic repository checks

At minimum, implementation runs the affected focused tests followed by:

```text
task typecheck
task test
task db:check
task openapi:check
```

Run the repository i18n policy checks when implementation adds user-visible copy. Per repository policy, do not perform AI-assisted browser/screenshot/frontend acceptance unless a maintainer explicitly requests it for that task. Product theme review renders are part of the implemented review system; they do not replace maintainer acceptance of the REZICS frontend change.

## 24. Observability and incident response

Record bounded structured events for:

- external-live access grant, renewal, revocation, expiry, denial, and recertification outcome;
- submission, review, approval, rejection, installation, rollback, revalidation, and kill;
- viewer capability-decision outcome, host, revision, and resource mode at resolution, without leaking sensitive page data;
- resource load success/failure and SRI failure;
- mount duration, runtime error, unhandled rejection, long-task indicators, and cleanup failure;
- external drift, redirect change, content-type change, CORS change, and monitor queue age;
- fallback reason, safe-mode use, and global-disable activation.

Operational dashboards need:

- active and soon-expiring external-live access grants, access managers, and overdue governance recertifications;
- active `external_live` revisions by review and health state;
- installations by revision and host kind using precomputed/control-plane metrics rather than request-time scans;
- unpinned/SRI-waived resources;
- monitor and review queue age/depth;
- error and fallback rates by revision;
- kill propagation latency;
- external origin concentration and hot keys.

The incident runbook must support one-action global disable, per-Profile external-live access revocation, per-revision kill, per-host uninstall, safe-mode instructions, external-origin blocking, and evidence preservation.

## 25. Acceptance criteria

### 25.1 Implemented scope — capability-gated external live preview

The implementation is complete only when:

- the active architecture explicitly calls the feature full-trust reviewed code;
- `external_live` is persisted and typed as an unsealed resource mode;
- core trusted member status is documented as an admission and recertification governance standard, never as runtime authorization;
- external-live eligibility and delegated administration use the two canonical Profile capabilities, while operation-specific Unit and control-plane authorization remains independent;
- the management capability can affect only the external-live access grant, cannot target its holder, and does not imply execution or general platform access management;
- ordinary external-live grants have a service-enforced maximum 90-day lifetime, while the reserved Bootstrap administrator has the only permanent self-issued exception; lifecycle history remains immutable and ordinary mutations require a fresh session and audited grant/renew/revoke transitions;
- only authenticated viewers holding both the development-preview release gate and active external-live access can receive or execute external-live resources;
- only top-level Zones activate the contract;
- Header/Footer are generic Unit document-flow regions, not Docks;
- theme HTML/CSS/JS is revision-owned and immutable at the manifest/package level;
- approval is exact-revision and host-scoped;
- direct remote resources have review snapshots, SRI where possible, and explicit waivers otherwise;
- the SSRF-safe review fetcher, drift monitoring, revalidation, and backpressure work;
- required-resource failure is fail-closed before script execution, while post-execution failure triggers best-effort cleanup and safe full-navigation recovery;
- safe mode, always-unthemed settings, viewer override, global disable, rollback, and kill work;
- no ordinary/public response leaks Phase 1 resource URLs;
- capacity evidence and deterministic checks pass.

### 25.2 Documentation-only future direction

The current plan is complete only if the owning TSDoc records future self-hosting as direction without making it a current resource mode, schema branch, persistence state, implementation step, or delivery commitment. There is no Phase 2 implementation or self-hosting acceptance gate in this plan.

### 25.3 Separate public-launch decision

Public launch requires an additional explicit decision. At minimum it must consider:

- whether full-trust same-document code is acceptable for ordinary viewers;
- review capacity, separation of duties, abuse response, and turnaround targets;
- production verification of kill and safe mode;
- privacy, licensing, accessibility, and performance requirements;
- whether a future `bounded_style` or sandboxed application mode should be the public offering instead.

Any future resource-hosting design would be evaluated separately and would not, by itself, reduce the inherent privileges of approved same-document JavaScript.

## 26. Final architecture

```text
Custom Theme Unit
└── immutable revision
    ├── target: rezics.unit.presentation@0
    ├── execution: host_full_trust
    ├── resource mode: external_live // capability-gated preview, unsealed
    ├── reviewed HTML fragments
    ├── styles
    ├── scripts + lifecycle entrypoint
    ├── external-resource review evidence
    └── review, approval, revalidation, and kill state

Unit presentation document
├── Header Block document
└── Footer Block document

Unit Custom Theme installation
└── top-level host Unit + target contract -> exact approved revision

External-live access governance and enforcement
├── core trusted member criteria       // admission and recertification policy only
├── platform.custom_theme.external_live.access.manage
│   └── grants/renews/revokes, never for the acting Profile
└── platform.custom_theme.external_live.access
    ├── ordinary grant: active for at most 90 days; runtime eligibility proof
    └── Bootstrap administrator: permanent self-issued installation exception

Phase 1 adapter registry
└── zone only

TSDoc-only future directions
├── REZICS-hosted executable/style dependency closure
└── zone_page top-level adapter
```

The key architectural statement is:

> The implemented scope accepts mutable remote supply-chain risk only for a capability-gated preview cohort selected and recertified under the core trusted member governance standard. Governance explains who should receive access; active server-side grants prove who has it. Approved theme code remains full-trust first-party code, while TSDoc records self-hosting and `zone_page` only as future directions.

## 27. References

- [REZICS Zone composition, aggregation, and theming decisions](../architecture/zone-composition-and-theming-decisions.md)
- [REZICS Zone composition and theming research report](../architecture/zone-composition-and-theming-research-report.md)
- [REZICS access model](../../libraries/access/README.md)
- [NIST Role Based Access Control FAQ](https://csrc.nist.gov/projects/role-based-access-control/faqs)
- [W3C Subresource Integrity](https://www.w3.org/TR/SRI/)
- [W3C Content Security Policy Level 3](https://www.w3.org/TR/CSP/)
- [WHATWG HTML: import maps and integrity metadata](https://html.spec.whatwg.org/dev/webappapis.html#import-maps)
- [MDN: Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity)
- [MDN: Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)
- [OWASP: Third Party JavaScript Management](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html)
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP: Server-Side Request Forgery Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
