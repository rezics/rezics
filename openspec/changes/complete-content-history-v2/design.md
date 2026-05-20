## Context

`@rezics/history` already exists as an independent service with its own Prisma schema, read APIs, revision/event storage, and an outbox consumer. The main server writes `HistoryOutbox` rows in the same transaction as canonical content mutations, and the history service asynchronously ingests those rows into `UnitRevision`, `RevisionContent`, and `StructureEvent`.

The current product gap is not the absence of a history service. The gap is that the service is not yet complete as a wiki-grade product capability:

- Editorial revision payloads are readable but still raw and UUID-heavy in the app.
- `BookContentStructure` uses normalized node rows and a diff-based save path, but that save path does not yet produce product-useful structure history.
- The frontend has a basic history route, but not a mature timeline, detail, compare, or restore experience.
- Permission, raw-payload visibility, actor/reference resolution, and restore behavior need explicit contracts.

This design completes history v2 without replacing the existing architecture.

## Goals / Non-Goals

**Goals:**

- Preserve the current outbox-driven history service architecture.
- Store editorial history as content-addressed snapshots and structure history as domain events.
- Record BookContentStructure saves as batch structure events that reflect the existing diff-based TOC save plan.
- Provide history display data through typed contracts rather than raw JSON interpretation in app code.
- Implement revision compare primarily in the frontend using `diff`/jsdiff and React diff rendering.
- Make compare suitable for Markdown and CJK text through `Intl.Segmenter`.
- Provide a product-grade React history UI that can be implemented in one change but in many tasks.

**Non-Goals:**

- No rendered Markdown DOM diff in this change.
- No server-side compare API unless a later performance task proves it is needed.
- No full historical BookContentStructure state reconstruction in the first implementation phase.
- No automatic structure snapshot table in the first implementation phase.
- No Wikipedia-style review queue, edit approval workflow, or surgical cherry-pick revert.
- No history for engagement data such as reactions, scores, or vote counts.

## Decisions

### Decision: Compare is frontend-derived

The frontend SHALL fetch two revisions and compute compare output locally. The history service remains responsible for immutable facts: revision metadata, content payload, structure events, and ingestion state.

Rationale:

- Compare is presentation behavior and can evolve without data migration.
- Client-side compare avoids adding CPU-heavy diff endpoints to the history service.
- The app can tailor field-level, Markdown, collection, and authority diffs independently.
- The data model remains simple: store facts once, derive views many ways.

Alternatives considered:

- Server-side `POST /compare`: deferred until large payloads or mobile clients need precomputed diffs.
- Persisted diff records: rejected because diffs become stale when display rules change and complicate snapshot deletion.

### Decision: Use `diff` plus a React diff renderer

The app SHALL use `diff`/jsdiff for low-level text diff generation and a React diff renderer for display. The preferred renderer is `react-diff-view` because it consumes unified diffs and exposes split/unified rendering, hunk customization, widgets, and styling hooks. `@alexbruf/react-diff-viewer` and `@git-diff-view/react` remain acceptable evaluation alternatives during implementation if they fit React 19 and design-system constraints better.

Rationale:

- `diff` is mature, dependency-light, and already supports line, word, JSON, array, and unified patch generation.
- `react-diff-view` gives the app control over tokens, styling, collapsed hunks, and future comment widgets.
- A custom renderer from scratch would waste time on solved layout and selection problems.

Alternatives considered:

- `diff2html`: rejected as the primary UI because HTML injection and styling control are less aligned with a React design-system surface.
- Monaco diff editor: deferred because it is heavier than needed for wiki text compare and feels like a code editor rather than a content history view.

### Decision: CJK compare uses `Intl.Segmenter`

Inline text compare SHALL use `Intl.Segmenter` where available, especially for Chinese, Japanese, Korean, Thai, and other languages without whitespace word boundaries. The app MAY dynamically load `@formatjs/intl-segmenter` when native support is unavailable.

Rationale:

- Whitespace splitting is incorrect for many supported languages.
- `diffWords` accepts an `Intl.Segmenter` and can produce better token boundaries for CJK text.
- `Intl.Segmenter` is a web platform primitive, reducing custom tokenizer maintenance.

Alternatives considered:

- Character-only diff: reliable but noisy for long Chinese/Japanese prose.
- Language-specific tokenizer libraries: deferred until a specific language quality gap appears.

### Decision: Editorial history remains snapshot-based

Editorial revisions SHALL continue to store full slot-based payload snapshots in `RevisionContent`, with `UnitRevision` carrying sequence, actor, changed field keys, message, and timestamps. The canonical payload hash SHALL be based on the editorial content payload rather than mutable outbox metadata such as sequence or actor.

Rationale:

- Full snapshots make revision reads, restore, and payload deletion straightforward.
- Editorial edits are relatively low-frequency and cross multiple tables.
- UI diff can be derived from any two snapshots.

Alternatives considered:

- Store editorial diffs as primary data: rejected because it complicates restore, retention, compliance deletion, and schema evolution.

### Decision: BookContentStructure history is a batch structure event

A single TOC save SHALL write one structure event with `eventType = "book.contentStructure.batch"` and a payload containing an ordered `operations[]` list. Each operation describes a domain change such as node create, update, move, delete, link, unlink, or bulk replace.

Rationale:

- The existing save path already computes the diff between submitted tree and current node rows.
- One batch event maps to one user save and keeps the per-Unit sequence readable.
- Operations remain detailed enough for product UI and future reconstruction.
- UI can collapse or expand one save naturally.

Alternatives considered:

- One event per node operation: rejected for v2 because large saves would flood timelines and consume many sequences.
- Full tree snapshot per save: rejected because it hides move/update semantics and wastes storage on large novels.

### Decision: Restore is normal edit semantics

Editorial restore SHALL load a prior revision into the normal edit flow and save it as a new current revision. Structure rollback to an arbitrary sequence is deferred; small TOC fixes use the existing editor and produce normal batch events.

Rationale:

- Normal save paths preserve permission checks, locks, validation, search updates, and history.
- A restore creates new history instead of deleting later revisions.
- This matches wiki/Confluence-style user expectations.

Alternatives considered:

- Dedicated `revert` mutation that rewrites history: rejected because it introduces ambiguous semantics and bypass risk.

### Decision: Reference and actor resolution are display contracts

History payloads continue to store IDs. The product UI SHALL resolve actor and referenced Unit display data through batch APIs with stable fallback states: `OK`, `DELETED`, `GONE`, and `RESTRICTED`.

Rationale:

- History remains structurally correct and avoids denormalized display drift.
- Deleted or private referenced Units can render predictably.
- Multiple history surfaces reuse the same query and fallback cache.

Alternatives considered:

- Copy display names into every revision: rejected due to storage bloat, temporal coupling, and compliance cost.

### Decision: Raw payload is debug data, not public product UI

Public viewers SHALL be able to open revision detail and compare views for visible Units. The app-facing product UI SHALL avoid raw JSON payload panels in these public surfaces, including unknown-slot compare fallback. Authorized raw payload access remains a backend/API capability for maintainers, admins, or explicit debug permissions, but it is not required in the public compare surface.

Rationale:

- The project schema is open source and stored IDs are not secret by themselves.
- Product risk is leaking private content, user data, migration-only fields, or confusing internal structures into normal reader/editor flows.
- Product-grade compare should prefer semantic display and product-safe changed indicators over raw schema dumps.
- Keeping raw payload inspection out of public history UI simplifies visibility gates while preserving service-level authority controls for future admin/debug tools.

Alternatives considered:

- Show raw fallback to every authorized editor inside compare: rejected for this phase because it makes product UI depend on internal payload shape.
- Hide revision detail/compare from public viewers: rejected because visible history is a core wiki-grade product capability.

### Decision: One large change, many task phases

This change remains one OpenSpec change because the user-facing outcome is one coherent product capability. Implementation SHALL be broken into contract, server, history service, API client, UI primitives, UI pages, and verification tasks.

Rationale:

- The cross-package contracts need one shared design.
- Splitting too early would force artificial coordination between backend and frontend changes.
- Tasks can still be implemented incrementally.

## Risks / Trade-offs

- [Risk] Frontend diff rendering may become slow for very large Markdown fields. → Mitigation: cap visible diff size, collapse large hunks, lazy-render heavy panels, and keep room for a future server-side compare endpoint.
- [Risk] Browser `Intl.Segmenter` behavior can vary by runtime. → Mitigation: use native support by default and add optional dynamic `@formatjs/intl-segmenter` polyfill when deterministic behavior is required.
- [Risk] Batch structure events are less directly queryable than one event per node. → Mitigation: keep operations structured and typed inside the batch payload; later indexing can be added without changing the authoring model.
- [Risk] Existing revisions have UUID-only actors and references. → Mitigation: all product UI uses resolver fallbacks and handles missing display data gracefully.
- [Risk] Restore through normal edit forms may encounter locked fields or stale validation. → Mitigation: restore obeys the same authority gate as a normal edit; blocked fields are surfaced before save.
- [Risk] History remains eventually consistent after save. → Mitigation: UI copy and loading states acknowledge ingestion lag; admin surfaces expose failed outbox rows.

## Migration Plan

1. Extend contracts for structure batch events, reference resolution, compare view models, and permission indicators.
2. Update `BookContentStructure` save to emit a history outbox batch event in the same transaction when mutations occur.
3. Ensure the history service ingests the batch event idempotently into `StructureEvent`.
4. Add actor/reference resolution endpoints and API client wrappers.
5. Build frontend diff primitives and compare helpers behind route-local usage.
6. Replace the basic history page with product-grade timelines, revision detail, compare, and restore affordances.
7. Add Storybook or app-level fixtures for timeline, compare, empty, lagging, and restricted states.
8. Run package tests and route/browser verification for desktop and mobile widths.

Rollback strategy:

- If UI work regresses, keep the new backend event recording and temporarily hide new history UI entry points behind route/component fallback.
- If structure event ingestion fails, disable the BookContentStructure outbox writer while retaining canonical TOC saves.
- No destructive data migration is required for first rollout.

## Open Questions

- Should `@formatjs/intl-segmenter` be installed immediately, or dynamically added only after testing target browsers?
- Should `book.contentStructure.batch` include a `before` subtree for deletes by default, or only minimal node metadata plus descendant count?
- Should the first implementation include a one-time "seed current TOC state" event for books that already have content structures?
