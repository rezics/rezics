# Entity, Tag, spoiler, and measurement decisions

This document records the accepted design decisions that resolved the
`vndb-v11` research discussion. The Tag-structure architecture and the
evidence behind these choices live in [tag-structures.md](./tag-structures.md);
implementation is tracked by the staged roadmap in the temporary
[research report](./vndb-v11-entity-tag-research-report.md). These decisions
bind implementation; changing one requires updating this document.

Two principles run through every decision below. Existing mechanisms are
reused instead of invented: Wilson confidence, the `voteSummary` contract,
advisory-lock projection refreshes, trigger-enforced bounds, and the
documented release cutover sequence. And wherever one error direction is
recoverable and the other is not, the default errs on the recoverable side.

## Spoiler and concealment mechanisms

Three mechanisms answer three different questions and never feed each other:

| Mechanism | Declared by | Granularity | Viewer spoiler preference applies |
| --- | --- | --- | --- |
| Semantic classification | community judgments | Tag, Path, and association applications | yes |
| Content spoiler labels | author, Realm curation, platform correction | one authored document | yes |
| Concealment marks | the author | spans inside rich content | no — always explicit reveal |

A semantic spoiler classification is a community judgment about an
application relationship — “this Tag, Path, or appearance applies to this
Unit, and knowing that association reveals a minor or major spoiler.” It
affects discovery, filtering, grouped presentation, API results, Realm
policy, and safe-by-default disclosure.

A content spoiler label is a whole-document statement about one authored
post-kind Unit (“this review reveals major spoilers”), defined in “Content
spoiler labels” below.

A concealment mark is authored inside rich content and hides one span or
block until the reader explicitly reveals it. The mark carries two equally
legitimate uses: concealing a genuine spoiler, and pure presentation effects
such as punchlines, puzzle answers, easter eggs, and interactive reveals. The
system does not distinguish, detect, or infer between those uses, which fixes
the following consequences:

- A mark is never evidence in any direction. Mark presence or density never
  feeds classification aggregates, never derives a content label, and never
  appears in search or filter predicates. Imports convert source spoiler
  markup into marks without producing any spoiler judgment, and the absence
  of marks proves nothing either.
- The viewer spoiler preference never auto-reveals marks. Auto-expansion
  would destroy every stylistic use, so marks require explicit per-span
  interaction at every preference level.
- Composition is ordered and one-way: a content label gates the whole
  document first; a revealed document still conceals each mark individually;
  revealing either never mutates the other.
- Accessibility and terminology stay neutral: assistive technology announces
  a concealed region with a reveal action rather than asserting a spoiler.
  Product copy may keep the familiar spoiler name; the contract semantics are
  concealment.
- Moderation heuristics and telemetry must not treat marks as spoiler or
  risk signals; stylistic uses make any such signal noise.

Spoiler protection never depends on presentation state (for example
description collapse), and presentation marks never feed classification
aggregates.

Two adjacent axes are deliberately not spoiler mechanisms, and not each
other:

- Age suitability of the subject matter is the existing
  `unit.content_rating` column (`general`, `r15`, `r18`, `r18g`) with the
  per-Profile accepted-ratings preference and its existing filtering
  semantics. A character Unit from an adult work is `r18` because of what it
  is about, even when everything it renders is inoffensive.
- Workplace display safety of the rendered surfaces is the NSFW display
  label defined below. It judges at-a-glance conspicuousness, not semantic
  explicitness: an `r18` erotic prose post can stay unlabeled because a
  glance at a page of text reveals nothing, while a far lower-rated image
  can carry the label because one glance at it is already the problem.
  The same character Unit is not NSFW while its imagery stays safe. Rating
  gates who should view the subject; NSFW gates how it renders on a screen
  and what discovery systems may show. Neither field ever derives the other
  automatically.

Spoiler status stays contextual (relative to the content's subjects) and
layered across authorities, which is why spoilers use labels and judgments
rather than another intrinsic Unit column.

## Judgment dimensions and storage

### Semantic targets

| Target | Applicability vote | Spoiler vote | Global | Realm |
| --- | ---: | ---: | ---: | ---: |
| Tag applied to Unit | yes | yes | yes | yes |
| Path definition | yes | no | yes | yes |
| Path applied to Unit | yes | yes | yes | yes |
| Subject association (appearance) | no | yes | yes | deferred |

A Path definition asks whether the ordered semantic path is valid. A Path
application asks whether that path describes a particular Unit. Spoiler
status belongs only to statements about a particular Unit. A subject
association's existence is consent-curated rather than voted, so it carries
the spoiler dimension only (see “Association spoiler classification”).

### Independent judgments in one sparse row

For every Tag or Path application target and authority, a Profile holds at
most one judgment row:

```text
fit_vote           nullable -1 | 1
spoiler_level      nullable 0 | 1 | 2
fit_updated_at
spoiler_updated_at
check: fit_vote is not null or spoiler_level is not null
```

Each mutation updates only its own dimension with its own timestamp,
authorization, and optimistic state; clearing both dimensions deletes the
row. `unknown` is the absence of a spoiler judgment, never an aggregating
vote value, so abstentions cannot dilute evidence. A Profile may classify the
spoiler level without casting an applicability vote, provided the candidate
application relationship exists.

Co-location is the accepted layout, not separate per-dimension fact tables:
VNDB stores applicability and spoiler in one `tags_vn` row per user and
target ([live schema](https://query.vndb.org/schema)), which is production
evidence that the two vote populations overlap heavily, and co-location
avoids duplicating the wide composite key and its indexes. The planning row
width grows from 144 to roughly 160 bytes: about 80 GB at 500,000,000 rows
and 480 GB at 3,000,000,000 rows before free space, WAL, replicas, and
secondary indexes — within the documented vote-relation envelope. Phase 0
validates this layout against separate tables with representative vote
densities before the migration lands.

Table naming follows the widened semantics: `unit_tag_judgment`,
`unit_structure_application_judgment`, and `realm_tag_judgment` replace the
`*_vote` names for spoiler-bearing targets. `unit_structure_vote` (Path
definition validity) stays a pure binary vote with no spoiler dimension.
Direct permission-gated relations (`realm_unit_tag`) and private relations
(`profile_unit_tag`) stay outside the judgment contract.

## Spoiler levels, aggregation, and confidence

Spoiler classification uses exactly three levels: `0 notSpoiler`,
`1 minorSpoiler`, `2 majorSpoiler`. Three levels match the granularity VNDB
has sustained in production; finer scales sharpen the adjacent-class
confusion that ordinal aggregation research documents.

Aggregates preserve the evidence distribution per authority —
`notSpoilerCount`, `minorSpoilerCount`, `majorSpoilerCount`, `viewerVote`,
`confidence`, `status` — and never collapse to a mode or average. Two derived
answers serve two different questions, both computed with the existing Wilson
machinery and its ranking `z` constant.

The protection level decides what is hidden by default. It errs safe using
Wilson upper bounds — protect until the community confidently refutes:

```text
n = 0                            → protection = Tag default_spoiler_level
                                   (none when the Tag has no hint)
WilsonUB(major / n) ≥ 0.5        → protect at major
WilsonUB((major+minor)/n) ≥ 0.5  → protect at minor
otherwise                        → no protection
```

One `major` vote protects immediately (upper bound 1.0); one `major` against
nine `notSpoiler` releases protection (upper bound ≈ 0.40 at 95%).

The status label states the community conclusion. It requires confidence
using Wilson lower bounds:

```text
n = 0                             → unknown
WilsonLB(major / n) ≥ 0.5         → majorSpoiler
WilsonLB((major+minor)/n) ≥ 0.5   → minorSpoiler
WilsonLB(notSpoiler / n) ≥ 0.5    → notSpoiler
only one level has votes          → that level, with its low confidence and
                                    count exposed
otherwise                         → disputed
```

Viewer preference has three settings — show all, hide major, hide any — and
defaults to hide any.

More sophisticated worker-reliability or ordinal inference stays an
asynchronous option off the request path. The supporting research:
[Davani et al., TACL 2022](https://aclanthology.org/2022.tacl-1.6/) on
disagreement as signal;
[Zhou et al., ICML 2014](https://proceedings.mlr.press/v32/zhouc14.html) on
ordinal adjacent-class difficulty;
[Wan et al., ACL 2019](https://aclanthology.org/P19-1248/) on per-work
spoiler variation; the
[LeWiDi-2025 shared task](https://doi.org/10.18653/v1/2025.nlperspectives-1.16)
and the [perspectivist survey](https://arxiv.org/abs/2601.09065) on
distribution-preserving evaluation of ordinal judgments; and
[GUSD, ECML-PKDD 2025](https://arxiv.org/abs/2504.17834) on genre-level
spoiler norms and stable per-user spoiler bias, which is why per-Profile
judgment facts are retained for possible asynchronous reliability weighting.

## Spoiler propagation and member override

A Path application's spoiler protection covers every member Tag it projects:
a derived member's presence on the Unit is evidence of the path association,
and over-hiding is recoverable while revealing is not.

The effective protection for one `(unit, tag, authority)`:

```text
direct spoiler evidence on the Tag reaches a confident status
                                  → the direct conclusion governs, in either
                                    direction (it may lower a derived level)
otherwise                         → max(direct protection, every accepted
                                    path application's protection)
```

The confidence gate for overriding is the status rule above — no separate
threshold exists. Multiple accepted paths projecting the same member combine
with `max`; every source summary stays intact in provenance, and nothing is
merged destructively.

A member Tag can be overridden in each authority independently, but only
through direct Tag evidence. A Path application is atomic: there is no
per-member exemption inside it. This keeps definition and application votes
auditable and matches the existing invariant that a Profile's negative
direct Tag vote and positive path support cannot coexist.

## Association spoiler classification

“This Entity appears in this work” can itself be the spoiler: a hidden
antagonist leaks from a character list even when every fact about the
character is protected. The spoiler-bearing statement is the association,
not the Entity.

- Storage: `subject_association_judgment` holds one spoiler-only judgment
  row per Profile and association (`association_id`, `profile_id`,
  `spoiler_level` 0 | 1 | 2, timestamps), cascading with the association.
  Association existence is consent-curated, so no applicability dimension
  exists; this is the degenerate single-dimension form of the shared
  judgment row.
- Aggregation, protection, and status reuse the Wilson rules above
  unchanged. The first release ships the global authority only; Realm-scoped
  association judgments are deferred.
- Protection applies when rendering the association, never the Unit. A
  work's surfaces conceal the protected appearance row — including its role,
  because “secretly the primary character” is itself a spoiler — behind the
  viewer preference. The Entity's own page renders normally while its
  appearance rows toward each work are protected individually. Catalog
  identity Units never carry an intrinsic spoiler state.
- Scope: `subject_association` only. Credit attributions and series
  relations can adopt the same pattern when demand exists.

## Content spoiler labels

A content spoiler label is a whole-document spoiler statement about one
authored post-kind Unit (post, reply, review, excerpt, wiki page). Its
implicit scope is the post's `subjectUnitId`; a reply inherits its root
post's subject. Labels have real consequences — they hide content — so every
assertion is a deliberate, authorized act. No vote can create or remove one,
which also removes the vote-brigade path that could strip protection from a
correctly labeled document.

### Registry

The registry holds four bootstrap Tag Units: the three content-spoiler
levels (none, minor, major) and the NSFW display label defined in the next
section. Their fixed identities join the bootstrap manifest beside the
existing official identities, are owned by official Profiles (which excludes
ordinary community editing), are excluded from Unit merges, and are verified
by readiness inspection. Because the identifiers are literal constants,
database triggers inline them to enforce the guards below. The registry is a
strictly bounded control set (at most 16 identities).

### Write paths and guards

| Writer | Mechanism | Scope | Authorization |
| --- | --- | --- | --- |
| Author | pinned `unit_tag` on their own post | global | Unit ownership |
| Realm | `realm_unit_tag` | that Realm's surfaces | `realm.tags.manage` |
| Platform correction | pinned `unit_tag` | global | moderation capability plus a `governance_decision` audit |

- Content-spoiler tags apply only to post-kind Units; a trigger rejects
  other targets and the API returns a typed error, so catalog Units can
  never receive a spoiler label. The NSFW label defines its own, wider
  applicability in its section.
- Registry `unit_tag` rows must be pinned, and judgment rows on registry
  tags are rejected: the tag itself is the level, and applicability voting
  does not exist for labels.
- Rows created under platform authority require platform authority to modify
  or remove; `unit.tag-curation.manage` alone is insufficient for them. The
  database enforces this through the established guarded transaction path,
  keyed on the literal registry identifiers and official Profile identities.
  Mislabeling corrections flow report → Realm curation or platform
  moderation.
- Registry tags are excluded from ordinary Tag picker suggestions and from
  the flat Tag landscape. The composer offers a single-select level control
  that creates, replaces, or removes the author's pinned row, and rendered
  surfaces present the label as part of the warning treatment.

### Resolution and rendering

```text
author or platform pinned registry row     → protects at its level
realm_unit_tag row, inside that Realm      → protects at its level
effective level = max(active sources); none counts 0
no row at all = undeclared; renders normally
```

Label lookup never enumerates a Unit's tags. The author and platform rows
ride the bounded pinned read (at most 16 rows) that cards already perform;
Realm rows are keyed probes on the fixed registry identifiers (at most four
per Unit and context). A capped enumeration is not an acceptable lookup: the
primary key orders by random Tag UUID, so any truncation window can silently
miss a registry row. Full tag-list queries, where they exist, may carry a
defensive internal limit (10,000 rows) as an adversarial bound; label
resolution never reads them.

The viewer spoiler preference gates labeled documents as warning cards:
metadata stays visible, and the body and preview reveal per item.
Enforcement covers every exposure — feed cards, search snippets, quotes and
embeds, and notification preview text.

## NSFW display label

The fourth registry Tag is the NSFW display label: a single binary flag
stating that rendering this Unit's surfaces is inappropriate for a work or
public screen. The criterion is what a glance at the rendered surface
exposes — the conspicuousness of imagery and presentation — not the semantic
rating of the content, so highly rated text often carries no label while
lower-rated imagery often does. Applying it is the judgment of the
authorized writers below; the platform defines no objective threshold. It is
orthogonal to `unit.content_rating` (see “Spoiler and concealment
mechanisms”), never derived from it in either direction, and carries no
spoiler semantics.

- Applicability: any public content Unit — posts and catalog Units alike.
  Display safety is an intrinsic property of what a surface renders, so
  labeling a catalog Unit NSFW does not conflict with the rule that catalog
  Units carry no intrinsic spoiler state.
- Write paths and guards reuse the content-label matrix: pinned `unit_tag`
  under Unit curation authority (the author on their own posts; Unit
  curators and platform moderation elsewhere, `unit.tag-curation.manage` is
  deliberately not grantable to all authenticated Profiles), `realm_unit_tag`
  under `realm.tags.manage` for Realm surfaces, and platform correction with
  a `governance_decision` audit. The pinned requirement, judgment rejection,
  and platform-row protection apply unchanged; there is no vote path.
- Resolution is presence-based: any active source marks the Unit NSFW.
  Lookup rides the same pinned read and fixed-identifier probes as the
  spoiler labels.
- Rendering: visual surfaces — cards, covers, avatars, galleries, preview
  imagery, embeds — blur with explicit per-item reveal. The viewer NSFW
  preference defaults to blurred with an account-level always-show opt-in,
  independent of the spoiler preference.
- Discovery consequences: the label feeds adult-content signals on public
  surfaces — SafeSearch-style rating metadata and suppression of social and
  preview imagery — alongside the existing adult presentation suppression in
  [unit-landing-seo.md](./unit-landing-seo.md), which already models adult
  responses as `presentation: null`. Notification previews and search
  snippets suppress NSFW imagery under the same enforcement rule as spoiler
  labels.

## Realm authority

### Fallback policy

Each Realm has one Tag-authority policy switch, `inherit` or `isolate`,
defaulting to `inherit`. A Realm must be fully usable with zero local Tag
decisions; every Realm surface degrades to the inherited global outcome, not
to an empty state.

Outcome resolution per target and dimension:

- a local decision exists when the Realm aggregate score is non-zero:
  positive is `acceptedInRealm`, negative is `rejectedInRealm`;
- a zero score — no votes or a tie — means no local consensus: with
  `inherit` the outcome is `inheritedFromGlobal`, with `isolate` it is
  `undecided`; and
- the spoiler dimension falls back independently: any Realm spoiler evidence
  makes the Realm protection level govern (a Realm may legitimately decide an
  association is not a spoiler for its audience); none inherits the global
  protection level. Local applicability with inherited spoiler is a valid
  mixed state.

Every result carries its state label. Global and Realm counts are never
merged; Profile Realm subscriptions compose presentation, never scores.

### Required capabilities and table shapes

A Realm can accept or reject a public Path definition, vote on whether a Path
applies to a Unit, and independently classify that application's spoiler
level. Realm-derived effective Tags remain separate from global effective
Tags, and APIs and UI preserve authority and provenance on every result. Path
Units remain public identities: a Realm contextualizes a Path, it does not
clone the Path or its member Tags.

Realm-scoped storage uses typed tables that mirror the existing
`realm_tag_context` gating pattern, not a generic semantic-context table, so
foreign keys prove that a referenced Unit is the required Tag or Structure
kind:

- `realm_structure` — the Realm's adoption row for one Path definition
  (primary key `(realm_id, structure_id)`, optional Realm-bound context
  post, permission-gated creation);
- `realm_structure_vote` — Realm definition acceptance votes, gated by the
  adoption row;
- `realm_structure_application_judgment` — `(realm_id, unit_id,
  structure_id, profile_id)` with the sparse two-dimension judgment row,
  gated by the adoption row and referencing the Unit directly, mirroring how
  `realm_tag_vote` references Units today;
- `realm_tag_judgment` — replaces `realm_tag_vote`, keeping the
  `realm_tag_context` gate; and
- Realm effective projections (`realm_unit_effective_tag` and its support
  rows) — the same incremental machinery as the global tables, in separate
  relations, partitioned by the documented `hash(realm_id, unit_id)` routing
  key.

## Tag vocabulary policy flags

Two curated, audited, non-voted policy fields join the `tag` relation. Both
are vocabulary policy set through curation capabilities — low-volume
editorial decisions, not community votes.

`directly_applicable boolean default true` marks whether a Tag may be applied
to Units directly (the equivalent of VNDB's `applicable`). Category-only
Tags with `false` are excluded from application suggestions — the picker
offers to browse into their children and paths instead — and the API rejects
direct application with a typed error. Path membership is unaffected:
interior classification nodes are exactly what the flag exists for.
Filtering by a category Tag through its descendants depends on the deferred
closure projection described in the tag-structures cost model and is decided
together with it.

`default_spoiler_level smallint` (nullable; 0, 1, or 2) is the equivalent of
VNDB's `defaultspoil`. It pre-highlights the suggested chip when a
contributor opens the optional spoiler judgment, and it serves as the
protection floor while a target has zero spoiler evidence. It is never
written as a vote and never enters aggregate counts.

## Entity description

An Entity description is complete, localized Portable Text rather than a
summary assembled from adjacent facts. Import preserves supported paragraphs,
links, emphasis, lists, and explicit spoiler presentation marks; unsupported
source markup is converted or rejected deliberately, never silently flattened
into escaped HTML. The description explains who or what the Entity is;
structured metadata exposes facts such as measurements, roles, credits, and
relationships, and the description does not repeat every adjacent metadata
value.

Rendering collapses long descriptions with a CSS line clamp: four lines below
the small breakpoint, six lines at and above it, with a one-line tolerance —
content exceeding the budget by a single line renders uncollapsed rather than
hiding one word behind a control. The expand/collapse control is a localized,
keyboard-accessible in-place button with `aria-expanded`, appears only when
content overflows, and toggles without a height transition. The clamp is
purely visual: assistive technology reads the full document, stored Portable
Text blocks are never truncated or sliced, and search indexing, APIs,
exports, and editing always use the full description. Spoiler presentation
marks hide and reveal independently of collapse state, so spoiler protection
never depends on the clamp. The four/six-line budgets are confirmed by the
Phase 1 prototype.

## Structured measurements

Measurements are typed facts in a dedicated Entity measurement relation, not
formatted description strings:

```text
entity_id
context_unit_id     nullable
height_millimetres  nullable
weight_grams        nullable
bust_millimetres    nullable
waist_millimetres   nullable
hips_millimetres    nullable
source and provenance fields
```

- Cardinality is bounded and trigger-enforced: one canonical set
  (`context_unit_id` null) plus at most eight contextual sets per Entity, in
  the same style as the existing 128-reference cap.
- The context identity is another Unit — the Software, Release, or other
  Unit under which the variant holds — with
  `UNIQUE NULLS NOT DISTINCT (entity_id, context_unit_id)`. No free-text
  discriminator and no new Entity-variant concept.
- Values are positive integers in canonical millimetres and grams; `null`
  means unknown. The first release stores point values only; uncertainty,
  approximations, and ranges stay unmodeled until real demand exists.
- Governance is direct editing with Unit revision and audit history, not
  votes — the model VNDB's trait system sustains across millions of
  applications. The UI localizes units and formats the bust–waist–hips
  sequence; import decodes source HTML entities before validation; Portable
  Text never owns or parses these values.

## Compound-search decomposition tunables

Initial values for the staged resolution defined in
[tag-structures.md](./tag-structures.md), kept in one configuration constant
set and revised from prototype telemetry (decomposition trigger rate, hit
rate, added latency):

- trigger: settled (debounced) query with fewer than 3 direct hits;
- decomposition caps: unspaced CJK queries up to 16 characters (at most 15
  contiguous two-part splits); spaced queries up to 6 tokens with contiguous
  bipartitions only;
- per-side candidates: top 4, ranked exact, then alias, then prefix, with
  usage count inside each band;
- conjunction probes: at most 32 per query, stopping at the cap;
- results: at most 5 decomposed suggestions, appended after direct results
  and visually marked with their path breadcrumb; and
- budget: roughly 62 indexed seeks worst case, with an added-latency target
  below 30 ms at p95 on a warm cache.

## Pack import contract

One principle governs imported evidence: aggregates start honest. A source
site's community score is provenance, never fabricated votes.

- Entity descriptions convert VNDB formatting codes to Portable Text, with
  source spoiler codes becoming presentation marks; unconvertible markup is
  rejected explicitly.
- Measurements import into the structured relation with source HTML entities
  decoded before validation.
- Tag records carry parent arrays (first element primary), `applicable` and
  `searchable` mapping to `directly_applicable`, `defaultspoil` mapping to
  `default_spoiler_level`, and the source category as a root-grouping seed.
- Hierarchy seeds Path definitions: the primary parent chain per applied Tag
  becomes the primary candidate definition, secondary parent chains become
  additional candidates, exact-array deduplication is left to the database,
  and each definition receives one attributed importer definition vote.
- Each imported Unit–Tag application creates the application row plus a
  single importer-Profile `fit` judgment; the source spoiler average rounds
  to one importer spoiler judgment. The source aggregate score is displayed
  as import provenance only.
- Each imported character appearance creates its subject association plus
  one importer spoiler judgment taken from the source's per-work character
  spoiler flag.
- Import is idempotent, upserting by source identifier and recording source
  URL and import time.

## Migration and cutover

The judgment contract lands in a single MAJOR RomVer release with no
compatibility aliases, following the deployment sequence established by the
vote-and-reference cutover:

1. Drain or pause writes on the affected paths.
2. Replace tables in one migration window: `unit_tag_vote` →
   `unit_tag_judgment` (copy `value` to `fit_vote`, `spoiler_level` null),
   `unit_structure_application_vote` → `unit_structure_application_judgment`,
   `realm_tag_vote` → `realm_tag_judgment`. Structure-side rows are small
   inside the development preview; the flat Tag vote copy is the only
   at-scale rewrite. Constraints attach `NOT VALID` with transactional online
   validation; replacement indexes build concurrently. The same window
   creates `subject_association_judgment`, installs the content-label
   registry guards (post-kind domain, pinned requirement, judgment
   rejection, platform-row protection), and extends the bootstrap manifest
   with the three registry Tag Units verified by readiness inspection.
3. Deploy API and frontend together; old binaries are incompatible with the
   judgment response shapes.
4. Verify aggregate parity, cursor invalidation, and lock waits; resume
   writes. Rollback is the previous binary plus a database restore.

Spoiler aggregates backfill by full recomputation at cutover time — spoiler
evidence is import-scale when the contract lands — while the aggregation
machinery itself is implemented incrementally for corpus scale.
Asynchronous-aggregation cutover invents nothing new: spoiler and fit
aggregates share the partitioned vote-event outbox design and the exact
observable thresholds documented in
[vote-and-reference-governance.md](./vote-and-reference-governance.md).
