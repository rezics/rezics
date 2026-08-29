# Custom Theme review and incident response

Custom Theme code runs with first-party privilege. Review is deployment
governance, not sandbox certification. Source, package files, observations, and
events are immutable; updates create a new revision.

## Authority boundaries

- Authors need development preview, external-live access, and ordinary update
  authority on their Custom Theme Unit.
- Reviewers need development preview, external-live access, and
  `platform.custom_theme.review`. The reviewer must differ from the submitter.
- Host operators need development preview, external-live access, and
  `unit.theme.manage` on the exact host.
- `platform.custom_theme.kill` independently authorizes revision kill and the
  global execution switch. Keep it separate from routine review.

## Review queue and automated evidence

Read `GET /api/v1/custom-themes/review-queue?limit=25` and follow the UUIDv7
keyset cursor. The background worker leases `pending_automated` and
`revalidation_required` rows with `SKIP LOCKED`. Submission closes under queue
or monitor backpressure; do not bypass it with direct database writes.

Before a human decision, verify automated evidence covers:

- strict manifest/package parsing, paths, MIME types, file and byte bounds;
- HTTPS-only SSRF-safe fetch results for every direct and discovered node;
- submitted/final URLs and redirects, digest, byte count, MIME, CORS, time, SRI
  or explicit waiver, dependency depth, and discovery parent;
- bounded CSS imports/URLs, static/dynamic modules, import-map target/integrity
  inspection, runtime script/link creation, workers, service-worker attempts,
  and WASM discovery, with the incomplete-closure limitation shown; reject
  literal bare module specifiers because v0 does not install author import maps;
- reference fixtures in light and dark schemes at representative viewports,
  including screenshots, console/load failures, LCP/CLS/INP measurements, long
  tasks, memory, transfer, request count, accessibility findings, and cleanup;
- observed runtime connect/image/font/frame/media origins, each covered by the
  exact declared HTTPS origin inventory, plus bounded licensing findings.

Reference renders run in fresh Cloudflare Browser Rendering contexts with
service workers blocked and no REZICS session or production credentials. The
renderer receives only five-minute signed package-file URLs and the exact
reviewed/declared HTTPS-origin allowlist; Playwright routing rejects every
other network destination. The main service validates the signed renderer
response, PNG type and size, stores immutable screenshots privately, and binds
their IDs and SHA-256 digests into automated evidence. Reviewers retrieve a
current artifact through:

```text
GET /api/v1/custom-themes/:themeUnitId/revisions/:revisionId/reference-render-artifacts/:screenshotAssetId
```

That reviewer-only route verifies that the asset ID belongs to the revision's
server-generated evidence before redirecting to a short-lived private object
URL. Screenshots are never accepted inline from the human decision request.

The web Worker deployment requires a Browser Rendering binding named
`BROWSER` and the secret `CUSTOM_THEME_REFERENCE_RENDER_TOKEN`. The main review
worker requires `CUSTOM_THEME_REFERENCE_RENDERER_URL`, pointed at the web
Worker's `/__internal/custom-theme-reference-render` route, and the same token.
Rotate both sides atomically. Missing or mismatched configuration fails
automated review closed; never bypass the render requirement with manually
entered measurements.

## Human approval checklist

Inspect the complete HTML, CSS, JavaScript, manifest, source archive, and any
diff from the prior revision. Inspect direct and transitive inventory, declared
runtime origins, same-origin API calls, storage use, data disclosure and
tracking, dynamically selected destinations, workers/WASM, platform
impersonation, credential collection, deceptive controls, unsafe navigation,
accessibility, reduced motion, keyboard behavior, failure/cleanup behavior,
long tasks, memory/transfer, licensing, attribution, ratings, and brand use.

For each SRI waiver or mutable URL, confirm why stable anonymous-CORS bytes are
not available, who owns the dependency, who is the reachable incident contact,
what can change, and whether the five-minute detection window is acceptable.
Floating `latest`, branch, tag-manager, and unversioned loader URLs require an
explicit risk acknowledgement.

Approval binds the exact revision, `rezics.unit.presentation@0`,
`host_full_trust`, `external_live`, exact host Zone, server-generated automated
and reference-render evidence digest, owner, incident contact, risk
acknowledgements, and preview audience. The human request supplies only the
host, decision/reason, owner, incident contact, license findings, and risk
acknowledgements; the service attaches the already persisted render evidence.
Use:

```text
POST /api/v1/custom-themes/:themeUnitId/revisions/:revisionId/decision
```

Reject with a durable reason when evidence is missing or a risk is not accepted.
Never edit an accepted package or approve the submitter's own revision.

## Installation, rollback, and revalidation

Install an exact approved revision with
`PUT /api/v1/units/by-id/:unitId/custom-theme-installation`; uninstall with the
matching DELETE. Rollback is installation of a previously approved revision
that is still healthy and approved for that host. Never follow `latest`.

The monitor checks unpinned executable/style nodes within five minutes and
pinned nodes daily, using leased keyset batches and at most two concurrent
requests per origin. Drift, redirect/MIME/CORS change, or required-resource
unavailability moves an approved revision to `revalidation_required` and
causes fallback on subsequent resolution. Revalidation repeats automated and
human review; bytes never regain approval automatically.

Alert on review depth over 10,000, oldest review age over 15 minutes, unpinned
monitor age over five minutes, active unpinned-node count approaching 1,000,
database pool wait p95 over 50 ms, repeated origin failures, or fallback/error
rate changes by revision.

## Incident response

Use the narrowest action that contains the risk, escalating immediately when
scope is uncertain:

1. Record the exact host, revision, external origin, first observation,
   reporter, suspected data/credential exposure, and currently loaded audience.
2. Preserve manifest, package hashes, review events, resource observations,
   browser CSP/integrity reports, external response metadata, and relevant
   audit events. Never delete evidence.
3. For one Profile, revoke external-live access through the narrow platform
   access endpoint. This stops new eligible projections for that viewer.
4. For one host, DELETE its exact installation. This avoids a corpus scan.
5. For one revision, POST
   `/api/v1/custom-themes/:themeUnitId/revisions/:revisionId/kill` with a durable
   reason. Kill is terminal; remediation is a new revision.
6. For uncertain or platform-wide risk, PUT
   `/api/v1/custom-themes/execution-control` with `enabled: false` and a durable
   reason. This is the one-action global stop.
7. If an origin is malicious, block it at the egress/request policy boundary in
   addition to killing affected revisions; do not rely on CSP report-only mode.
8. Tell affected viewers to navigate to a full URL carrying
   `?rezics-safe-theme=1` or to the always-unthemed Settings surface. After any
   theme script ran, a full safe navigation is the reliable reset boundary.
9. Verify a fresh anonymous request and authenticated requests missing either
   capability receive no theme fragments or resource URLs. Verify direct
   packaged-file reads respect global disable, eligibility, installation
   health, and viewer opt-out.
10. Rotate credentials and follow privacy/security notification procedures if
    exposure is possible. Assign an incident owner and recovery criteria.

Recovery requires root-cause evidence, a new or explicitly revalidated revision,
fresh human approval, and verification of monitoring/kill propagation. Re-enable
the global switch only after all affected revisions/origins are contained and a
second authorized operator reviews the decision.

An active customized document probes its exact viewer-specific server policy
at most once per minute and whenever a background tab becomes visible. A kill,
global disable, lost eligibility, opt-out, or unavailable policy disposes
tracked artifacts and navigates to safe mode; an exact revision replacement
performs a clean reload. Because approved code has the same page privilege and
can interfere with browser APIs, this is best-effort acceleration, not the
security boundary. Continue to issue safe-navigation instructions during an
incident and measure kill propagation from server state change to probe/fresh
navigation fallback.

The Worker accepts only bounded structured lifecycle telemetry at
`/__rezics/presentation-runtime-report`: host/revision identifiers, fixed
phase/reason codes, durations, and resource/failure counts. It rejects extra
fields and bodies over 2 KiB, omits credentials from the client request, and
records at most 32 reports per activation. Treat client reports as untrusted
signals; correlate them with server decisions, CSP/integrity reports, and
monitor evidence.
