# Custom Theme full-trust external-live execution

Status: Accepted — development preview

Accepted: 2026-08-29

Owners: Domain, Security, Operations

This decision supersedes the CSS-containment and “scripts never run” parts of
[Zone composition, aggregation, and theming decisions](./zone-composition-and-theming-decisions.md).
The old styling contract remains inactive groundwork for reviewer linting and a
possible future `bounded_style` mode; it is not the security boundary for the
implemented Custom Theme runtime.

## Decision

REZICS implements a generic Custom Theme Unit whose immutable revisions target
`rezics.unit.presentation@0`. V0 has exactly one registered adapter: a `zone`
rendered as the top-level route host. Nested Units, cards, lists, references,
embedded Blocks, and Zone Pages do not activate a theme.

An approved revision uses execution mode `host_full_trust` and the single exact
resource mode `external_live`. “External live” is intentionally unsealed: the
review records observed remote bytes and policy, but does not claim an
immutable transitive artifact closure. No `self_hosted` state is accepted,
generated, or persisted.

## Trust and threat model

Approved HTML, CSS, and JavaScript execute in the first-party REZICS document.
They can inspect or change the whole DOM, imitate controls, observe interactions,
read origin storage and page data, make same-origin requests that pass normal
API authorization and CSRF checks, contact permitted external services, and
consume browser resources. A selector prefix, React boundary, TypeScript type,
review state, or CSP does not isolate this code. Operationally, approval is a
frontend deployment for one recorded host and preview audience.

`external_live` additionally trusts the remote operator, DNS/TLS/CDN delivery
path, and runtime-selected dependencies. SRI can fail closed for a pinned direct
resource, but a root digest does not seal module imports, CSS imports, workers,
WASM, dynamically computed URLs, or other runtime requests. Static discovery,
reference-render evidence, monitoring, CSP, and reporting reduce exposure and
speed detection; none prove confinement or a complete dependency closure.

Review therefore means that a human accepts first-party execution of the exact
manifest and package, with the recorded evidence digest, host scope, resource
mode, and execution audience. It does not mean the code is sandboxed or that all
future remote bytes were approved.

## Contracts and ownership

- `custom_theme` is the generic Unit subtype. Its localization and ordinary
  ownership use existing Unit behavior.
- `custom_theme_revision` stores immutable package identity, exact target,
  execution/resource modes, hashes, submitter, review state, host-scoped
  approval, and emergency state. Database triggers reject package mutation,
  deletion, and invalid review transitions.
- `custom_theme_revision_file` and review events are append-only. File bytes are
  in object storage; PostgreSQL keeps bounded metadata and hashes.
- `custom_theme_revision_external_resource` stores the submitted and final URL,
  redirect evidence, digest, MIME type, size, CORS result, SRI or waiver,
  observed time, and bounded monitor state.
- `unit_custom_theme_installation` maps one top-level host and target contract to
  one exact revision. It never follows “latest”. Killing or revalidating a
  revision requires no reverse installation scan.
- `unit_presentation_document` owns semantic Header and Footer Block documents
  with immutable history. The theme may append only revision-owned
  `header.append` and `footer.append` fragments. Dock remains a Dock.
- Zone appearance owns only safe fallback tokens and backdrop configuration.

The manifest, submitted representation, reviewed evidence, and resolved browser
projection are distinct typed boundaries. Parsing a submitted manifest never
makes it executable authority.

## Authorization and audience

`@rezics/access` is the only capability registry. Authorization is conjunctive:

| Operation | Required authority |
| --- | --- |
| Create or submit | development preview + external-live access + ordinary Custom Theme Unit create/update authority |
| Inspect or decide review | development preview + external-live access + Custom Theme review; reviewer differs from submitter |
| Install or roll back | development preview + external-live access + host `unit.theme.manage` authority |
| Receive or execute | authenticated viewer + development preview + active external-live access + viewer opt-in |
| Grant, renew, revoke eligibility | fresh session + external-live access management; actor differs from target |
| Kill or globally disable | Custom Theme kill capability; no external-live eligibility required |

The canonical capabilities are:

```text
platform.development_preview.access
platform.custom_theme.external_live.access
platform.custom_theme.external_live.access.manage
platform.custom_theme.review
platform.custom_theme.kill
```

`platform.access.manage` implies the narrow access-management capability. The
narrow capability implies neither execution nor general platform access reads
or writes. Its API cannot name an arbitrary capability, cannot target the
actor, and returns only Profile selection fields plus the external-live grant.
Ordinary active grants expire within 90 days. The one reserved Bootstrap
platform administrator instead holds a permanent, self-issued grant as part of
the complete Bootstrap platform policy; this exception does not apply to other
Profiles holding `platform.access.manage`. Renewal of an ordinary grant revokes
the old immutable lifecycle row and inserts a new row in the same audited
transaction.

“Core trusted member” is the human admission and recertification standard. It
is never inferred by the renderer and is not an authorization fact. See
[External-live access governance](../operations/custom-theme-external-live-access.md).

## Resolution and recovery

The resolver emits resources only when every condition holds: authenticated
viewer, both preview capabilities, viewer opt-in, registered top-level Zone
adapter, exact installation, exact current host approval, supported contract,
healthy approved revision, no safe-mode request, and global execution enabled.
Every failure returns ordinary appearance and Unit content without theme
fragments or resource URLs. Resolved responses are private and viewer-specific.

The server recognizes `?rezics-safe-theme=1`; Settings is always unthemed; and
the kill capability controls a platform-wide execution singleton. Before any
theme script executes, a required-resource failure removes injected resources
and fragments and skips mount. After script execution, cleanup is necessarily
best effort, so reliable recovery navigates to a full safe-mode document.

An open customized document rechecks its exact viewer-specific presentation
policy every 60 seconds and when a hidden tab becomes visible. Fallback policy
forces best-effort disposal and safe-mode navigation; an exact revision change
forces a clean document reload so request-time CSP is recalculated. This
accelerates kill, global-disable, revocation, expiry, opt-out, and drift
propagation, but full-trust code can interfere with client APIs, so fresh
server navigation remains authoritative.

The host loads fragments, ordered styles, ordered classic dependencies, then
one module entry point whose `mount(context)` may return a disposer. It aborts
and disposes on route leave or revision replacement. Only one runtime may be
active per document, and required loads time out after ten seconds.

## External-resource controls

Direct resources require an exact HTTPS URL and either canonical SRI metadata
or an explicit waiver. The reviewer records an owner, incident contact, final
URL and redirects, MIME type, size, digest, time, anonymous-CORS result, and
reference-render evidence. Modules and cross-origin SRI require anonymous CORS.

The review fetcher rejects credentials, fragments, non-443 ports, local or
ambiguous hostnames, and non-public IPv4/IPv6 answers. It resolves every hop,
connects to the validated address, revalidates redirects, sends no ambient
credentials, and enforces one absolute timeout across DNS and every redirect
hop while also bounding redirects, encoded/decoded bytes, graph depth,
graph bytes, nodes, global concurrency, and per-origin concurrency. Network
policy must additionally keep review workers away from private networks and
cloud metadata.

Automated review invokes an authenticated internal Cloudflare Browser
Rendering route. Fresh contexts block service workers and network requests
outside the exact signed-package, reviewed-redirect, and declared-origin
inventory. Two fixed viewport/color-scheme fixtures collect bounded screenshots,
console/load failures, runtime destinations, LCP/CLS/INP-related measurements,
long tasks, transfer, request count, memory observations, accessibility
findings, and cleanup. The main service validates renderer output and PNG bytes,
stores private immutable screenshot objects, and persists their IDs and hashes
in append-only evidence. Human decision input cannot supply or replace that
evidence.

Dependency discovery inventories CSS imports/URLs, static and dynamic modules,
import-map targets and integrity metadata, workers, service-worker attempts,
runtime-created script/link URLs, and streamed WASM with an explicit statement
that discovery is incomplete. V0 does not install author import maps, so a
literal bare module specifier fails automated review; URL module specifiers are
required. The monitor uses a keyset/lease queue with
per-origin concurrency. Unpinned executable/style nodes are scheduled within
five minutes; pinned resources receive a daily availability/CORS audit. Drift,
redirect/MIME/CORS change, or required-resource unavailability moves an
approved revision to `revalidation_required`; an optional outage is recorded
and skipped until recovery. Changed bytes are never auto-approved.

The request boundary keeps the baseline CSP and adds only origins from the
selected reviewed revision. It preserves `object-src 'none'`, reports CSP
violations, and deploys `Integrity-Policy-Report-Only` for script/style inventory.
CSP is telemetry and destination policy, not isolation from approved code.

## Availability bounds and backpressure

Per revision: one module entry, at most 32 scripts, 32 styles, 128 direct remote
resources, 512 discovered graph nodes, 64 MiB total review-graph transfer, 64 MiB
of submitted runtime files, 5 MiB initial CSS/JavaScript, 256 KiB HTML fragments,
a separately bounded 20 MiB source archive, and 256 package files. Every stored
runtime file contributes bounded license evidence; every stored CSS, JavaScript,
and worker file participates in dependency discovery even when it is not a
manifest root. Submission
admission closes when review depth exceeds 10,000, a queued review is older than
15 minutes, an unpinned executable/style monitor is more than five minutes
late, active revisions reach 100,000, or the process-local one-minute database
pool-wait p95 exceeds 50 ms. Active unpinned executable/style graph nodes are
globally bounded at 1,000. Serialized admission rechecks, worker leases, and
`SKIP LOCKED` keep those limits race-safe and provide bounded parallelism and
retry.

Automated review claims four revisions by default and never more than 16 per
process. A maximally wide 512-node graph needs 64 eight-request waves; at the
absolute ten-second graph-fetch deadline plus the 45-second Browser Rendering
deadline, the conservative lease envelope is about 11.4 minutes, so the worker
uses a 15-minute lease. Browser-account concurrency must be at least the chosen
batch or the batch must be reduced. At the default batch, the browser-only
upper-bound service rate is about 0.089 revisions/second per continuously busy
worker (`4 / 45`); the hard batch ceiling is about 0.356 revisions/second
(`16 / 45`) before graph-fetch and storage time. Workers scale horizontally by
claiming independent rows with `SKIP LOCKED`; queue-age admission prevents an
undersized renderer fleet from accepting unbounded work.

## Capacity qualification

Sparse host state is corpus-scale: at most one presentation row and one
installation row per Unit. Planning covers both 500 million and 3 billion rows.
The representative fixture measured about 285 bytes per installation including
all current indexes. Capacity planning therefore uses 280–360 bytes, or
140–180 GB and 840 GB–1.08 TB respectively before replication, WAL, free space,
and bloat. An illustrative 4 KiB presentation document is about 2.0 TB and
12.3 TB of raw payload at those baselines, before history and TOAST overhead.

Control-plane admission is explicitly bounded to 1,000 eligible Profiles, 100
access managers, 100,000 active revisions, 10,000 queued reviews, and 1,000
active unpinned executable/style nodes. At 512 graph nodes per active revision,
the conservative external-resource maximum is 51.2 million rows; at an
estimated 400–700 bytes including essential indexes, that is approximately
20–36 GB before operational overhead. A 20-node observed average is 2 million
rows.

On 2026-08-29, the disposable migration fixture qualified 200,000 revisions
(exactly 100,000 active and 100,000 terminal), a 10,000-row mixed review queue,
186,666 external-resource rows, 10,000 installations and presentation
documents, 1,000 Themes, and representative collection skew. `EXPLAIN ANALYZE`
selected the intended indexes for review paging (0.438 ms), the queue-boundary
probe (7.047 ms), automated review (0.037 ms), monitoring (0.098 ms), Theme
history (0.423 ms), host resolution (0.049 ms), and presentation lookup
(0.028 ms). The one-row active-revision boundary probe took 71.373 ms on the
cold, 50%-selective table; PostgreSQL correctly preferred a sequential plan at
that saturation. It transfers one row rather than 100,000 IDs. If its measured
p95 exceeds 100 ms or contributes to the existing 50 ms pool-wait admission
threshold, replace the probe with a transactionally maintained control-plane
counter before raising the active bound.

Measured heap plus indexes were about 226.3 MB for revisions (roughly 1.13 KiB
per row), 119.2 MB for external resources (roughly 638 bytes per row), 2.85 MB
for installations (roughly 285 bytes per row), and 4.33 MB for empty
presentation documents (roughly 433 bytes per row). These cached local results
qualify plan shape and storage math, not production latency; promotion still
requires environment-specific skew and concurrency measurements.

Each automated render creates exactly two screenshot objects. At 100,000
active revisions this is 200,000 objects: about 0.4 TiB at an illustrative
2 MiB per screenshot, with an enforced worst-case envelope of about 1.9 TiB at
10 MiB per screenshot. The 1 million and 6 million longer-term revision cases
are 2 million/12 million objects, about 3.8/22.9 TiB at the illustrative size
or 19.1/114.4 TiB at the hard per-object bound, before revalidation history and
replication. Screenshots stay in partitionable object-storage prefixes; the
database and append-only review events retain bounded IDs, hashes, sizes, and
measurements. Retention or archival may remove an object only under an approved
evidence policy, never merely because a newer render replaced current evidence.

Request paths are point lookups by `(host_unit_id, target_contract)`, revision
ID, and current Profile capability, with keyset review/monitor queues. Warm
presentation resolution targets p95 below 10 ms and at most three bounded data
accesses before ordinary content projection. There is no offset pagination,
whole-corpus revalidation, request-time installation fan-out, or renderer wait
on external review work.

An active full-trust page probes its authoritative policy immediately, at most
once per 60 seconds, and when it becomes visible again. At the 1,000-Profile
capability bound, one visible themed tab per Profile is about 16.7 point-lookups
per second; three tabs is about 50 per second. Requests do not overlap within a
tab, carry no theme-origin inventory, and are private/no-store. Before raising
the capability bound or shortening the interval, load-test the authenticated
policy path with the expected tab skew and add edge abuse controls; do not
convert this safety probe into a whole-corpus scan or fan-out.

Browser runtime reports are untrusted operational signals. The client emits at
most 32 structured reports per activation and omits credentials; the Worker
accepts at most 2 KiB and only fixed lifecycle/resource/failure fields. CSP and
integrity reports, reference evidence, drift observations, and authoritative
server decisions remain separate corroborating sources.
Normal activation emits three lifecycle/resource reports, so 1,000 Profiles
opening three tabs together produces about 9,000 small reports; the defensive
per-activation ceiling makes the same synchronized burst at most 96,000. The
endpoint writes neither database rows nor a queue, and edge log sampling,
retention, and rate limits must absorb or shed that telemetry independently of
presentation policy and review correctness.

Before a single host-state relation reaches operational storage, vacuum,
backup, or latency limits, hash-partition/shard by `host_unit_id`. Move large
presentation payloads to content-addressed object storage when measured TOAST
or relation growth warrants it. Archive terminal and bulky evidence while
retaining bounded current monitor fields. Expansion past any control-plane
admission bound requires a new capacity review with representative skew,
`EXPLAIN ANALYZE`, relation/index/TOAST/WAL measurements, and per-origin load
tests.

## Cutover and compatibility

The prior Zone-theme migration was never included in a supported release tag,
so it is replaced rather than adapted. There are no `/zone-themes` aliases,
`zone_theme` Unit kinds, compatibility views, or approval inheritance. Preview
CSS revisions must be discarded or explicitly resubmitted as a new
host-full-trust package. Development databases that applied the old migration
follow the [development cutover note](../operations/custom-theme-development-cutover.md).

## Deferred decisions

A future contract is intended to replace live executable/style dependencies
with a REZICS-hosted immutable closure. This is TSDoc-only direction, not a
schema branch, persisted value, build pipeline, migration, or commitment.
Likewise, `zone_page` is only the next intended top-level adapter.

Public launch requires a new explicit decision about same-document privilege,
review capacity and separation of duties, abuse response, privacy, licensing,
accessibility, measured performance, and whether a `bounded_style` or sandboxed
application mode is a better public product.

## References

- [W3C Subresource Integrity](https://www.w3.org/TR/SRI/)
- [W3C Content Security Policy Level 3](https://www.w3.org/TR/CSP/)
- [W3C Subresource Integrity 2](https://www.w3.org/TR/sri-2/)
- [OWASP Server-Side Request Forgery Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Third Party JavaScript Management](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html)
