# VNDB v11 Entity, Tag, Spoiler, and Measurement Research Report

Status: temporary working report, not an accepted architecture decision.
The canonical Tag-structure architecture — design evidence, identity,
primary display path, search and indexing, and application interaction —
lives in [tag-structures.md](./tag-structures.md); this report no longer
restates it. Delete this report after Phase 4 of the delivery roadmap below
ships.  
Date: 2026-08-23

## Purpose

This report tracks the remaining `vndb-v11` product and contract work that is
not yet covered by an accepted ADR:

- incomplete Entity summaries and descriptions, and Portable Text rendering
  with progressive disclosure;
- the distinction between a spoiler presentation style and a semantic spoiler
  classification, and the independent applicability and spoiler vote
  dimensions;
- spoiler evidence aggregation;
- Realm authority for Path definitions and applications;
- structured character measurements;
- the capacity evidence required before schema acceptance; and
- the staged development-preview exit roadmap for Tag structures.

It does not authorize a schema migration or frontend implementation; Phase 0
of the roadmap does that through an explicit ADR.

## Decisions that moved to the canonical architecture

The following are decided and documented in
[tag-structures.md](./tag-structures.md):

- Tag and Tag Path both remain Units; an application is a typed first-class
  relationship, not a Unit ("Identity and immutability").
- The evidence-based rejection of the alternative designs — community-editable
  edge DAGs, gatekeeper-approved edge DAGs, flat facets, statement qualifiers,
  and autonomous LLM hierarchies ("Design rationale and evidence").
- Primary display path selection and its projection ("Primary display path").
- Flat-Tag-only search, suggestion breadcrumbs, compound query resolution
  such as `红色头发` resolving to `发色 › 红色`, index composition, and the
  capacity bounds ("Search and indexing").
- The single Tag input component, silent path application, the inline sense
  chooser, the flat fallback, and the three product surfaces ("Application
  interaction").
- The assisted-proposal layer and governance observability.

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
reproduce a complete VNDB-like experience, and it is what Phase 0 of the
roadmap fixes at the contract level.

## Entity description

### Content contract

An Entity description should be complete, localized Portable Text rather than a
plain summary assembled from adjacent facts. Import must preserve supported
paragraphs, links, emphasis, lists, and explicit spoiler presentation marks.
Unsupported source markup must be converted or rejected deliberately rather
than silently flattened into escaped HTML.

The description and the factual metadata table answer different questions:

- the description explains who or what the Entity is; and
- structured metadata exposes facts such as measurements, roles, credits, and
  relationships.

The description should not repeat every adjacent metadata value merely because
the source includes a prose infobox line.

### Rendering and collapse

The Entity overview should render the Portable Text document and initially
collapse long descriptions. The exact line budget remains a product decision;
a practical prototype should test approximately four mobile lines and six
desktop lines.

Required behavior:

- do not truncate or slice the stored Portable Text blocks;
- expose an explicit expand/collapse action only when content overflows;
- preserve links and inline semantics when expanded;
- avoid a height transition that becomes expensive for very large documents;
- keep the control localized and keyboard accessible; and
- ensure collapsed content is not accidentally announced as visible content by
  assistive technology.

This is progressive disclosure, not data loss. Search indexing, APIs, exports,
and editing must continue to use the full description.

## Two meanings of “spoiler”

The product currently risks conflating two different concepts.

### Spoiler presentation mark

A spoiler presentation mark is authored inside rich content. It hides or
reveals a particular span or block. It is local to that document and controls
presentation. Examples include hiding one sentence in an Entity description or
one block in a review.

This mark does not prove that a Tag–Unit relationship is semantically a spoiler,
does not receive community votes, and does not participate in Realm Tag
governance.

### Semantic spoiler classification

A semantic spoiler classification is a community judgment about an application
relationship, for example:

- “this Tag applies to this Unit, and knowing that association reveals a minor
  spoiler”; or
- “this Tag Path applies to this Unit, and the association reveals a major
  spoiler.”

It affects discovery, filtering, grouped Tag presentation, API results, Realm
policy, and safe-by-default disclosure. It is not merely a CSS variant.

The exported TypeScript boundaries should eventually receive concise TSDoc
explaining this distinction. That documentation work was explicitly deferred;
TSDoc must not be used as a substitute for a typed runtime contract or
authorization enforcement.

## Vote dimensions

### Required semantic targets

| Target | Applicability vote | Spoiler vote | Global | Realm |
| --- | ---: | ---: | ---: | ---: |
| Tag applied to Unit | yes | yes | yes | yes |
| Path definition | yes | no | yes | yes |
| Path applied to Unit | yes | yes | yes | yes |

A Path definition asks whether the ordered semantic path is valid. A Path
application asks whether that path describes a particular Unit. Spoiler status
belongs only to the second statement.

### Independent user judgments

For every Tag or Path application, the user should be able to set or clear:

- applicability: `fits` or `doesNotFit`; and
- spoiler level: `notSpoiler`, `minorSpoiler`, or `majorSpoiler`.

The two votes require independent mutations, timestamps, authorization,
optimistic state, and aggregate summaries. A user may classify the spoiler
level without also casting an applicability vote, provided the candidate
application relationship exists.

`unknown` is absence of a spoiler judgment, not an aggregating vote. Treating it
as a vote would let abstentions dilute evidence. VNDB reached the same two
conclusions in production: its tagmod removed the default vote so users state
judgments explicitly, and its spoiler control defaults to no judgment.

### Logical separation and physical storage

Separate semantics do not require duplicate physical keys. A candidate design
is one sparse per-Profile judgment row per target and authority:

```text
fit_vote          nullable -1 | 1
spoiler_level     nullable 0 | 1 | 2
fit_updated_at
spoiler_updated_at
```

Each mutation updates only its own dimension. The row is deleted when both
dimensions are null. Aggregates and API contracts remain separate.

This layout should be benchmarked against separate fact tables. Co-location can
save repeated Unit, Tag/Path, Profile, and Realm keys when vote populations
overlap; separate tables may be more efficient when the populations and access
patterns differ significantly. VNDB stores applicability and spoiler in one
`tags_vn` row per user and target, which is production evidence that the two
vote populations overlap heavily; the final choice still requires
representative vote density and write-amplification measurements.

The current name `unit_tag_vote` would become misleading if it stores multiple
judgment dimensions. Any rename or replacement is a persisted-contract change
and requires an explicit RomVer migration and cutover plan.

## Spoiler aggregation

Spoiler classification is ordinal and subjective. The system should preserve
the evidence distribution rather than reduce it immediately to a mode or
average:

```text
notSpoilerCount
minorSpoilerCount
majorSpoilerCount
viewerVote
confidence
status: unknown | notSpoiler | minorSpoiler | majorSpoiler | disputed
```

An initial bounded projection can turn one ordinal vote into two cumulative
binary observations:

```text
anySpoiler   = spoilerLevel >= minorSpoiler
majorSpoiler = spoilerLevel >= majorSpoiler
```

This preserves the invariant that every major spoiler is also a spoiler and can
reuse bounded confidence calculations. Unknown or disputed results should use
spoiler-safe presentation defaults without being represented as a false major
consensus.

More sophisticated worker-reliability or ordinal aggregation must remain an
asynchronous option rather than request-path work. Relevant research includes:

- [Dealing with Disagreements: Looking Beyond the Majority Vote in Subjective
  Annotations](https://aclanthology.org/2022.tacl-1.6/), which shows that
  systematic annotator disagreement can contain useful information;
- [Aggregating Ordinal Labels from Crowds by Minimax Conditional
  Entropy](https://proceedings.mlr.press/v32/zhouc14.html), which models the
  particular difficulty of distinguishing adjacent ordinal classes;
- [Fine-Grained Spoiler Detection from Large-Scale Review
  Corpora](https://aclanthology.org/P19-1248/), which reports that spoiler
  distributions vary by work and author;
- the [LeWiDi-2025 shared
  task](https://doi.org/10.18653/v1/2025.nlperspectives-1.16) and the
  [perspectivist modeling survey](https://arxiv.org/abs/2601.09065), which
  document the field-wide move from majority-vote collapse toward
  distribution-preserving and per-annotator evaluation, now including ordinal
  judgments; and
- [GUSD](https://arxiv.org/abs/2504.17834) (ECML-PKDD 2025), which measures
  genre-specific spoiler rates and stable per-user spoiler bias — empirical
  support for Realm-level spoiler norms and for keeping per-Profile vote
  facts so reliability weighting stays possible asynchronously without a
  schema change.

No aggregation threshold is accepted by this report.

## Realm support for Tag Paths

Realm support must cover Path definitions and applications rather than only
flat Tag applications.

Required capabilities:

1. A Realm can accept or reject the definition of a public Path Unit.
2. A Realm can vote on whether a Path applies to a Unit.
3. A Realm can independently classify the spoiler level of that application.
4. Realm-derived effective Tags remain separate from global effective Tags.
5. APIs and UI preserve authority and provenance on every result.

Path Units should remain public identities. A Realm contextualizes a Path; it
does not clone the Path and its member Tags.

Global and Realm scores must never be merged. If a Realm is allowed to use a
global result when it has no local decision, that is an explicit policy state,
not vote aggregation:

```text
acceptedInRealm
rejectedInRealm
inheritedFromGlobal
undecided
```

`inheritedFromGlobal` is the load-bearing default. The Bluesky labeler
evidence recorded in [tag-structures.md](./tag-structures.md) shows that
volunteer authorities are operationally fragile; a Realm must be fully usable
with zero local Tag decisions, and every Realm feature must degrade to the
inherited global outcome rather than to an empty state.

The existing `realm_unit_tag` is a direct permission-gated Realm relation and
must not be overloaded as the community-voted candidate assertion. Independent
spoiler votes reveal the need for a real Realm application target, such as a
typed Realm Tag application and a typed Realm Structure application, with
foreign keys that prove the candidate relationship exists.

Realm context eligibility also needs a deliberate contract. A generic semantic
Unit context could unify Tag and Path behavior, but separate typed context
tables may provide stronger database guarantees that a referenced Unit is the
required Tag or Structure kind.

## Path projection and spoiler propagation

An accepted Path application can project effective member Tags for browsing and
filtering; the projection mechanics and their invariants are documented in
[tag-structures.md](./tag-structures.md). The projection must retain
application authority, direct versus derived origin, Path identity,
applicability summary, spoiler summary, calculation time or version, and any
truncation or policy state.

A Path application's spoiler classification can conservatively protect its
derived members. A direct Tag application may provide more specific evidence,
but the system must not destroy conflicting source summaries by prematurely
merging them.

The final viewer policy remains undecided. Candidate choices include using the
maximum accepted spoiler level across enabled sources for safe disclosure, or
allowing a more specific direct application to lower a Path-derived level under
strict confidence rules. The safe-disclosure maximum is the recommended
starting default — an error that over-hides is recoverable, an error that
reveals is not. Whatever rule is selected must preserve the original global
and Realm evidence and be explainable in the UI.

## Structured measurements

The source-style string:

```text
Measurements Height: 155cm, Weight: 39kg, Bust-Waist-Hips: 75-57-78cm&#x20;
```

should not be stored or rendered as one HTML-escaped description fragment.
Height, weight, bust, waist, and hips are independently queryable typed facts.

### Proposed direction

Use a dedicated Entity measurement table or measurement-set table with
canonical units, for example:

```text
entity_id
context_unit_id nullable
height_millimetres nullable
weight_grams nullable
bust_millimetres nullable
waist_millimetres nullable
hips_millimetres nullable
source/provenance fields
```

The UI localizes units and formats the bust–waist–hips sequence. Import decodes
source HTML entities before validation. Portable Text should not own or parse
these values.

Open modeling questions include:

- whether one Entity can have multiple measurement sets for age, form, route,
  or edition;
- whether the context should be another Unit, an Entity variant, or a bounded
  typed discriminator;
- how uncertainty, approximate values, ranges, and unknown values are
  represented; and
- what provenance and correction workflow applies.

The table must have a documented active-row bound per Entity. A single canonical
set is cheap, but an unbounded history or variant list becomes corpus-scale. If
multiple sets are supported, pagination, uniqueness, lifecycle, and capacity
must be designed before release.

## Capacity and performance

The repository requires planning at 500,000,000 rows for every potentially
corpus-scale relation and an estimate at 3,000,000,000 rows. Existing vote
governance estimates approximately 144 bytes per binary vote row, or about 72
GB at 500 million rows and 432 GB at 3 billion rows before free space, WAL,
replicas, and secondary indexes. The bounded request-path costs of the
structure system itself — projections, search, decomposition, quick-add write
amplification — are documented in the
[tag-structures cost model](./tag-structures.md).

The proposed system introduces up to four spoiler-bearing application scopes:

- global Tag application;
- Realm Tag application;
- global Path application; and
- Realm Path application.

It also introduces global and Realm Path-definition authority without a spoiler
dimension.

Before schema acceptance, the ADR must record:

- candidate relationship cardinality and distribution;
- applicability-versus-spoiler vote overlap;
- global and per-Realm read/write rates;
- hot Unit, Tag, Path, and Realm skew;
- latency and contribution throughput targets, re-derived from the quick-add
  write amplification (one application vote fans out to at most L support
  rows and L effective upserts, L ≤ 16 and typically 2–4);
- row and index storage at both required scales;
- aggregate write amplification and WAL/network costs;
- projection freshness requirements;
- migration and backfill costs; and
- observable async-aggregation cutover thresholds.

Risky queries require representative distributions and `EXPLAIN (ANALYZE,
BUFFERS)`. Toy fixture performance is not evidence for either required scale.
VNDB's live corpus (about 3.0k tags and 1.86M application votes, observed
2026-08) is a useful density reference point, not a substitute for the
required baselines.

## Unresolved decisions

Decisions still requiring an ADR or product prototype:

- exact collapsed-description line budgets and overflow interaction;
- accepted spoiler levels, aggregation thresholds, and confidence policy;
- co-located versus separate vote fact tables;
- Realm fallback-to-global policy details beyond the `inheritedFromGlobal`
  default;
- Realm application and context table shapes;
- a Tag applicability policy for category-only Tags (the equivalent of VNDB's
  `applicable` and `searchable` flags), so path-interior classification nodes
  are not applied as leaves;
- a per-Tag default spoiler hint (the equivalent of VNDB's `defaultspoil`)
  that pre-fills the optional spoiler judgment without becoming a vote;
- compound-search decomposition tunables: the direct-hit threshold, query
  length and token caps, and per-side candidate caps;
- duplicate-source and spoiler-propagation policy;
- whether Path member Tags can be independently overridden in each authority;
- measurement-set cardinality and context identity;
- pack import changes needed to retain descriptions, measurements, hierarchy,
  relevance, spoiler level, and provenance; and
- migration, backfill, compatibility, and async cutover plans.

## Delivery roadmap: development preview exit

The staged plan below replaces the earlier delivery sequence. Each phase has
an explicit exit condition; a phase must not start before the previous phase's
exit condition holds. When Phase 4 ships, delete this report; the canonical
architecture in [tag-structures.md](./tag-structures.md) is the surviving
record.

### Phase 0 — Contract acceptance and seeding

- Accept the ADR that fixes application identities, vote dimensions, spoiler
  evidence shape, projection invariants, and measurement cardinality, with
  the capacity evidence listed above.
- Expand the showcase source and catalog contract so imported evidence is not
  lost before rendering: descriptions as Portable Text, structured
  measurements, hierarchy provenance, relevance, and spoiler level.
- Seed path candidates from imported hierarchies: VNDB's parent arrays (whose
  first element is the primary parent) become candidate definitions along
  primary chains plus secondary chains, imported as attributed definitions
  with ordinary initial definition votes and importer provenance — never as a
  separate authority.

Exit: ADR accepted; the `vndb-v11` pack imports losslessly and produces
seeded, deduplicated definitions on a disposable fixture.

### Phase 1 — Read-only complete presentation

- Build the primary display path projection and the ends-at index.
- Ship the reading summary (grouped by accepted path root, exact "N more")
  and the complete exploration surface (grouped hierarchy list replacing the
  one-Card-per-path layout), with provenance stated in text.
- Ship Entity descriptions with progressive disclosure and read-only
  structured measurements.

Exit: read surfaces released to ordinary users — the development preview
capability stops gating structure reads; writes remain gated.

### Phase 2 — Application contribution

- Replace the two pickers in the Unit Tag management flow with the single Tag
  input component: suggestion breadcrumbs, silent path application when one
  accepted path ends at the Tag, the inline sense chooser when several do,
  and the flat fallback when none does. The separate Structure picker is
  removed from ordinary flows.
- Ship compound query resolution (Stage 2 decomposition) and the alias
  enrichment loop for unresolved compounds.
- Ship the contribution grid with applicability judgments and staged batch
  saves; spoiler columns wait for the spoiler dimension.

Exit: application writes released to ordinary users; flat `unit_tag` behavior
for path-less Tags is unchanged; quick-add write amplification is measured
against the accepted throughput targets.

### Phase 3 — Definition governance, spoiler dimension, assistance

- Open path definition proposals and definition voting to the community in
  curation surfaces, with the pending-definition queue exposed and
  time-to-decision tracked (governance observability).
- Land the independent spoiler dimension with distribution-preserving
  aggregates and spoiler-safe viewer defaults; add spoiler columns to the
  contribution grid and the optional post-add spoiler judgment to the picker.
- Launch the assisted-proposal layer (candidate definitions, placement and
  alias suggestions, duplicate warnings) feeding the ordinary proposal and
  vote pipelines with provenance.

Exit: definition governance and spoiler contribution are public; assisted
proposals are measurably feeding the queues without acceptance authority.

### Phase 4 — Realm authority

- Add Realm Path definition acceptance, Realm application votes, and Realm
  spoiler classification as separate authorities and aggregates, with
  `inheritedFromGlobal` as the zero-maintenance default.
- Preserve authority and provenance on every API result and rendered surface.

Exit: the `platform.development_preview.access` gate is removed from every
structure operation; global and Realm evidence render with full provenance;
this report is deleted.
