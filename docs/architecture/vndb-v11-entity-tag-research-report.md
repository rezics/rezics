# VNDB v11 Entity, Tag, Spoiler, and Measurement Research Report

Status: temporary execution-tracking report. The canonical Tag-structure
architecture and evidence live in [tag-structures.md](./tag-structures.md);
the accepted judgment, spoiler, Realm-authority, and measurement contracts
live in
[entity-tag-spoiler-and-measurement-decisions.md](./entity-tag-spoiler-and-measurement-decisions.md).
This report tracks only the remaining execution: the capacity evidence still
to be gathered and the staged development-preview exit. Delete this report
after Phase 4 of the delivery roadmap ships.  
Date: 2026-08-23

## Where the decisions live

- [tag-structures.md](./tag-structures.md): identity and immutability, the
  design evidence and rejected alternatives, primary display path, search and
  indexing, the single-picker application interaction, the three product
  surfaces, effective projection, assisted proposals, governance
  observability, and the cost model.
- [entity-tag-spoiler-and-measurement-decisions.md](./entity-tag-spoiler-and-measurement-decisions.md):
  the spoiler concept separation, judgment dimensions and co-located storage,
  spoiler levels and Wilson-based aggregation, propagation and member
  override, Realm fallback policy and table shapes, Tag vocabulary policy
  flags, Entity description contract and collapse behavior, structured
  measurements, compound-search tunables, the pack import contract, and the
  migration and cutover plan.

This report intentionally restates none of it.

## Current evidence

`D:\rezics-repos\rezics-showcase-packs\packs\vndb-v11` version `0.1.0`
currently declares 8 Software Units, 65 Release Units, 82 Entity Units, and
589 Tag Units.

The current Entity records generally contain Unit metadata, Entity kind,
localized titles, and aliases. They do not carry the full VNDB character
description or structured measurements. The pack's 1,028 `unitTags` are
flattened applications containing a Unit key, Tag key, pin, and position; they
do not preserve applicability evidence, spoiler evidence, hierarchy
provenance, or direct-versus-derived presentation semantics. This is why the
association surface can technically find Tag Units while still failing to
reproduce a complete VNDB-like experience, and it is what Phase 0 fixes at
the contract level through the accepted pack import contract.

## Capacity evidence required before the Phase 0 migration

The accepted contracts fix the shapes; the migration may land only with the
capacity evidence the repository baseline requires, recorded against
500,000,000 rows and estimated at 3,000,000,000 rows per corpus-scale
relation:

- candidate relationship cardinality and distribution;
- applicability-versus-spoiler vote overlap, validating the co-located
  judgment row against separate fact tables with representative densities;
- global and per-Realm read/write rates;
- hot Unit, Tag, Path, and Realm skew;
- latency and contribution throughput targets, re-derived from the quick-add
  write amplification (one application vote fans out to at most L support
  rows and L effective upserts, L ≤ 16 and typically 2–4);
- row and index storage at both required scales for the four spoiler-bearing
  application scopes (global and Realm, Tag and Path) plus the two
  Path-definition authorities;
- aggregate write amplification and WAL/network costs;
- projection freshness requirements;
- migration and backfill costs; and
- confirmation that the async-aggregation cutover thresholds documented in
  [vote-and-reference-governance.md](./vote-and-reference-governance.md)
  remain valid for the widened judgment rows.

Risky queries require representative distributions and `EXPLAIN (ANALYZE,
BUFFERS)`. Toy fixture performance is not evidence for either required scale.
VNDB's live corpus (about 3.0k tags and 1.86M application votes, observed
2026-08) is a useful density reference point, not a substitute for the
required baselines.

## Delivery roadmap: development preview exit

Each phase has an explicit exit condition; a phase must not start before the
previous phase's exit condition holds. When Phase 4 ships, delete this
report; the two permanent documents above are the surviving record.

### Phase 0 — Contract landing and seeding

- Land the accepted judgment contract as the single MAJOR migration defined
  in the decisions document (table replacements, `NOT VALID` constraint
  attachment with online validation, concurrent index builds, the documented
  deploy sequence), backed by the capacity evidence above.
- Expand the showcase source and catalog contract per the accepted pack
  import contract: Portable Text descriptions, structured measurements,
  hierarchy provenance with primary parents, policy flags, and
  importer-attributed judgments with honest aggregates.
- Seed Path definitions from imported hierarchies (primary chains plus
  secondary chains, exact-array deduplication, one importer definition vote
  each).

Exit: migration deployed and verified; the `vndb-v11` pack imports losslessly
and produces seeded, deduplicated definitions on a disposable fixture; the
co-location benchmark result is recorded.

### Phase 1 — Read-only complete presentation

- Build the primary display path projection and the ends-at index.
- Ship the reading summary (grouped by accepted path root, exact "N more")
  and the complete exploration surface (grouped hierarchy list replacing the
  one-Card-per-path layout), with provenance stated in text.
- Ship Entity descriptions with the accepted collapse behavior and read-only
  structured measurements.

Exit: read surfaces released to ordinary users — the development preview
capability stops gating structure reads; writes remain gated. The prototype
confirms or amends the four/six-line collapse budgets in the decisions
document.

### Phase 2 — Application contribution

- Replace the two pickers in the Unit Tag management flow with the single Tag
  input component: suggestion breadcrumbs, silent path application when one
  accepted path ends at the Tag, the inline sense chooser when several do,
  and the flat fallback when none does. The separate Structure picker is
  removed from ordinary flows.
- Ship compound query resolution with the accepted initial tunables, plus the
  alias enrichment loop for unresolved compounds.
- Ship the contribution grid with applicability judgments and staged batch
  saves; spoiler columns land in Phase 3.
- Enforce `directly_applicable` in suggestions and at the API boundary.

Exit: application writes released to ordinary users; flat `unit_tag` behavior
for path-less Tags is unchanged; quick-add write amplification is measured
against the accepted throughput targets; decomposition telemetry (trigger
rate, hit rate, added latency) is reviewed and the tunables revised in the
decisions document if needed.

### Phase 3 — Definition governance, spoiler dimension, assistance

- Open Path definition proposals and definition voting to the community in
  curation surfaces, with the pending-definition queue exposed and
  time-to-decision tracked (governance observability).
- Activate the spoiler dimension end to end per the accepted contracts:
  distribution-preserving aggregates, protection and status derivation,
  propagation with confident direct override, `default_spoiler_level`
  pre-highlighting and protection floor, viewer preference defaulting to
  hide-any, and spoiler columns in the contribution grid with the optional
  post-add judgment in the picker.
- Launch the assisted-proposal layer (candidate definitions, placement and
  alias suggestions, duplicate warnings) feeding the ordinary proposal and
  vote pipelines with provenance.

Exit: definition governance and spoiler contribution are public; assisted
proposals are measurably feeding the queues without acceptance authority.

### Phase 4 — Realm authority

- Add the Realm tables and projections defined in the decisions document
  (`realm_structure`, `realm_structure_vote`,
  `realm_structure_application_judgment`, `realm_tag_judgment`, Realm
  effective projections) with the `inherit`-by-default fallback policy.
- Preserve authority and provenance on every API result and rendered surface;
  global and Realm evidence are never merged.

Exit: the `platform.development_preview.access` gate is removed from every
structure operation; global and Realm evidence render with full provenance;
this report is deleted.

## Deferred beyond this roadmap

Explicitly out of scope until real demand or a separate decision:

- descendant-based filtering for category-only Tags, which depends on the
  versioned asynchronous closure projection described in the tag-structures
  cost model;
- measurement uncertainty, approximations, and ranges (point values only in
  the first release); and
- asynchronous worker-reliability weighting of spoiler judgments (the
  per-Profile judgment facts retained by the accepted storage make it
  possible later without a schema change).
