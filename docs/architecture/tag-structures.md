# Tag structures

Rezics represents a structured Tag relationship as a community-immutable
generic `structure` Unit. The first semantic structure kind is
`tag.hierarchy_path`: an ordered path of two to sixteen Tag Units from broader
to more specific.

This document is the canonical architecture for Tag structures. It records the
implemented storage and governance model, the evidence behind the design
choices, and the adopted search and interaction design that ships with the
development preview exit. Proposals that still require their own ADR (the
spoiler vote dimension, Realm Path authority, structured measurements) and the
staged exit plan live in the temporary
[VNDB v11 research report](./vndb-v11-entity-tag-research-report.md).

Sections below marked "Adopted design" describe accepted target behavior that
is not fully implemented yet; everything else describes the implemented
system.

## Development preview boundary

Tag paths are not released to ordinary users. Dedicated hierarchy, structure,
application, vote, and `tag-structures` search operations require
`platform.development_preview.access` in addition to their ordinary API scope
and domain authorization. Mixed Unit Tag responses omit structures before
querying them when the caller lacks the capability, while continuing to return
released flat and Realm Tag data.

The frontend mirrors this decision by removing path routes, search controls,
management controls, and rendered paths. That client behavior is presentation
only; the backend remains authoritative on every request.

The staged exit from this boundary is the delivery roadmap in the
[VNDB v11 research report](./vndb-v11-entity-tag-research-report.md).

## Design rationale and evidence

### What a Tag path is in prior art

A Tag path is a pre-coordinated subject string over a concept vocabulary. The
components of this design have long-lived precedents:

- Library of Congress Subject Headings are ordered pre-coordinated strings
  ("Japan—History—Meiji period") maintained for over a century across tens of
  millions of records. The Library's own
  [pre- versus post-coordination study](https://loc.gov/catdir/cpso/pre_vs_post.pdf)
  records Svenonius's conclusion that pre-coordinated context "is needed for
  disambiguation, suggestibility, and precision" and builds better browsing
  domains — which is exactly what paths are used for here: presentation,
  grouping, and sense disambiguation.
- [MeSH](https://www.nlm.nih.gov/mesh/meshhome.html) separates a concept
  (descriptor) from its hierarchy positions (tree numbers): one concept, many
  tree positions. The Tag Unit / Path Unit split mirrors that separation.
- [SKOS](https://www.w3.org/TR/skos-reference/) models polyhierarchy through
  `skos:broader`; a path materializes one broader chain without forcing a
  single-parent tree.
- The voted application edge is a reified statement in the sense of
  [RDF 1.2](https://www.w3.org/TR/rdf12-concepts/) and of Wikidata's statement
  model: judgment-specific metadata attaches to a relationship without
  changing the identity of its endpoints.

### Why definitions are immutable and voted

Two alternative shapes were evaluated against real-system evidence.

Community-editable edges (Wikidata's `subclass of` graph) decay at scale.
Studies from 2024–2026 document the outcome of a decade of open edge editing:
87.5% of 17,819 classes in multi-level taxonomies flagged for classification
problems, with the problems persisting years after first measurement
([Semantic Web Journal](https://doi.org/10.3233/sw-243562)); cycles, absurd
transitive chains such as "city → spatial entity → geometric object →
mathematical object", taxonomy depth of 20, and only 4% of four million
classes instantiated ([WiKC](https://arxiv.org/abs/2409.04056)); pervasive
class-order violations ([extended AAAI 2025
study](https://arxiv.org/abs/2411.15550)); and editor-facing diagnostic
tooling as an active research area
([2025 diagnosis study](https://arxiv.org/abs/2511.04926)). The structural
cause matters most for a voted system: editing one edge silently re-routes the
meaning of every inherited application below it, so previously recorded votes
stop meaning what their voters asserted. Immutable path definitions make every
vote permanently refer to the exact chain it was cast on, and make cycles and
silent re-parenting impossible by construction.

Gatekeeper-approved edges work in production but bottleneck on gatekeeper
labor. VNDB requires moderator approval for every new tag and trait
([d10](https://vndb.org/d10)), and its community reports months-long approval
backlogs
([discussion](https://intfiction.org/t/making-ifdbs-tag-system-more-like-vndb/72653)).
AO3 sustains its canonical-tag structure only with more than 400 volunteer
wranglers plus over 30 supervisors, minimum weekly commitments, and three to
four recruitment rounds per year
([committee description](https://www.transformativeworks.org/committees/tag-wrangling-committee/)),
and its two-week wrangling target slips to a month under load
([admin post](https://archiveofourown.org/admin_posts/12131)). Danbooru routes
alias and implication changes through forum Bulk Update Requests that only
admins can approve
([tag_relationship.rb](https://github.com/danbooru/danbooru/blob/master/app/models/tag_relationship.rb),
[BUR overview](https://deepwiki.com/danbooru/danbooru/4.1-tag-relationships-and-bulk-updates)).

Definition votes replace gatekeeper attention with aggregated independent
judgments: the cost of one structure decision drops from one trusted person's
review to any N users' votes, and Wilson lower-bound ranking already handles
small vote counts conservatively. This is the property that makes a
community-governed hierarchy scale past the VNDB/AO3/Danbooru staffing model.

### Why contribution input stays post-coordinated

Library science tested "make contributors write pre-coordinated strings" and
retired it for non-specialists: OCLC built FAST specifically because LCSH
string synthesis was too costly to learn and apply
([O'Neill & Chan, IFLA 2003](https://webdoc.sub.gwdg.de/ebook/aw/2003/ifla/vortraege/iv/ifla69/papers/010e-ONeill_Mai-Chan.pdf),
[OCLC FAST](https://www.oclc.org/research/areas/data-science/fast.html)), and
FAST remains actively maintained today (change files through
[2026-02](https://fast.oclc.org/fastChanges/)), so the lesson is current
practice rather than history.

Rezics therefore keeps the two roles strictly apart: ordinary contributors
search and pick flat Tags, the system attaches paths, and path authoring
exists only in curation surfaces. The "Search and indexing" and "Application
interaction" sections below are the binding consequence of this rule.

### Platform reference points

- VNDB (live schema observed 2026-08,
  [query.vndb.org/schema](https://query.vndb.org/schema)): roughly 3.0k tags,
  3.6k parent edges each with a designated primary parent, 1.86M tag
  application votes, and inheritance materialized as a 1.51M-row view. Its
  trait vocabulary (~3.3k) carries ~2.99M applications that are deliberately
  not voted — direct edits against a moderated vocabulary — and traits render
  with root-group breadcrumbs such as "Eyes > Green"
  ([dumps documentation](https://vndb.org/d14)). Tags carry per-tag
  `defaultspoil`, `searchable`, and `applicable` policy flags. Tagmod removed
  its default +2 vote so users state judgments explicitly
  ([commit](https://g.blicky.net/vndb.git/commit/?id=e6c2be19a5e0ab85827b3b7bd96afa29f7157e31)).
  Functional reference surfaces:
  [VN/Page.pm](https://code.blicky.net/yorhel/vndb/src/branch/master/lib/VNWeb/VN/Page.pm),
  [VN/Tagmod.pm](https://code.blicky.net/yorhel/vndb/src/branch/master/lib/VNWeb/VN/Tagmod.pm),
  [Tagmod.js](https://code.blicky.net/yorhel/vndb/src/branch/master/js/contrib/Tagmod.js),
  [Chars/Page.pm](https://code.blicky.net/yorhel/vndb/src/branch/master/lib/VNWeb/Chars/Page.pm),
  [sql/func.sql](https://code.blicky.net/yorhel/vndb/src/branch/master/sql/func.sql).
  A whole-view refresh is viable at 1.5M rows and not at this repository's
  500,000,000-row baseline; the incremental effective-Tag projection here is
  the required adaptation, not overdesign.
- Bluesky's composable moderation validates subscription-based independent
  authorities at 34M-account scale — 307 labelers whose community labels
  (34.5M) outnumber official labels (12.3M) in an April 2025 snapshot
  ([network study](https://doi.org/10.5281/zenodo.18351518)) — while showing
  that volunteer authorities are operationally fragile: the fifty most
  followed labelers average roughly 2,300 subscribers and rely on precarious
  volunteer funding
  ([governance study](https://link.springer.com/article/10.1007/s44382-025-00018-9)).
  Realm-scoped Tag behavior must therefore default to inheriting global
  outcomes as an explicit policy state and must never require per-Realm
  decisions before a Realm is usable.
- Shopify's open product taxonomy evolves slowly under explicit governance
  (quarterly CalVer releases, community pull requests, an owning internal
  team: [repository](https://github.com/Shopify/product-taxonomy)) while
  application assignment runs fast and automated with human-in-the-loop
  taxonomy evolution — tens of millions of daily classification inferences
  ([engineering report](https://shopify.engineering/evolution-product-classification),
  [ICLR 2025 recap](https://shopify.engineering/leveraging-multimodal-llms)).
  The definition-vote versus application-vote split matches this division of
  slow governed structure from high-volume application.
- LLM taxonomy research has converged on paths as the unit of structural
  validation and on human-in-the-loop acceptance
  ([ReLTEx](https://arxiv.org/abs/2608.10970),
  [WiKC](https://arxiv.org/abs/2409.04056)), and evaluations report LLM
  degradation on deeper and more specialized taxonomy levels (surveyed in
  ReLTEx). That admits an assisted proposal layer and rules out autonomous
  restructuring authority.
- Interaction evidence: hierarchy-grouped faceted browsing of large
  collections has strong usability evidence
  ([Hearst, Flamenco](https://people.ischool.berkeley.edu/~hearst/papers/flamenco.pdf));
  tags participate in multiple valid chains, so single-parent trees are
  insufficient
  ([Schmitz, WWW 2006](https://www.ambuehler.ethz.ch/CDstore/www2006/www.rawsugar.com/www2006/22.pdf));
  collaborative tagging converges to stable distributions while system design
  shapes the vocabulary
  ([Golder & Huberman](https://arxiv.org/abs/cs/0508082),
  [Marlow et al., HT06](https://faculty.washington.edu/farkas/HCDE510-Fall2012/MarlowEtAl-TaggingSystems.pdf)).

### Alternatives considered

- Community-editable edge DAG: rejected. Documented decay and vote-meaning
  drift under open editing (Wikidata evidence above).
- Gatekeeper-approved edge DAG: rejected. Approval labor is the scaling
  bottleneck and conflicts with community governance (VNDB, AO3, Danbooru
  evidence above).
- Flat tags plus facets only: rejected as the storage model; its input-side
  lesson is adopted in the interaction design. Deep grouped browsing is a
  product goal, and bounded paths (typical depth two to four) already behave
  like shallow facet chains.
- Statement-plus-qualifier application, recording the sense as a free
  qualifier on a flat Tag application: rejected. Expressively equivalent to a
  path application, but loses exact-array deduplication and definition-level
  voting, so the same governance surface returns with weaker guarantees.
- Autonomous LLM-maintained hierarchy: rejected as an authority; adopted as a
  proposal layer (see "Assisted proposals").

## Identity and immutability

The exact ordered member UUID array, structure kind, and definition version
form the current definition identity used for deduplication.
`unit_structure_member` and `unit_structure_edge` are database-generated
projections of that header. They provide referential integrity and inverse
indexes but are not independently editable.

The database validates that a new Tag path:

- has distinct members;
- contains only active, approved, public Tag Units; and
- satisfies the bounded path length.

After insertion the header, members, and edges reject ordinary direct
mutation. The submitter receives attribution and an initial positive vote, but
no editing authority; the Community Profile owns the Unit.

The application edge stays a typed first-class relationship rather than a
Unit: it carries votes, provenance, state, and presentation consequences, but
creating a Unit per application would multiply Unit lifecycle, indexing,
authorization, search, and event costs without adding useful identity. A
shared product or API contract can discriminate the two application targets
without weakening physical foreign keys:

```ts
type SemanticApplicationTarget =
	| { kind: "tag"; unitId: UnitId; tagId: UnitId }
	| { kind: "tagPath"; unitId: UnitId; pathId: UnitId };
```

The sole mutation exception is an administrative correction by a Profile with
the platform `unit.edit` capability. The API requires the last observed
`updatedAt` value and a non-empty correction reason. The database then
replaces the ordered members through a transaction-local guarded path,
rebuilds member, edge, and effective-Tag projections, and records both a Unit
revision and an audit event. The Structure Unit identity, definition votes,
applications, and application votes are preserved.

The correction is rejected atomically if it duplicates another exact path,
contains an existing application target, or would turn a positive Structure
application into support that conflicts with the same Profile's negative
direct Tag vote. Community endpoints never receive the guarded mutation
authority.

## Two independent global votes

`unit_structure_vote` answers whether an immutable definition is a valid path.
It drives Tag hierarchy pages and search discoverability.

`unit_structure_application_vote` answers whether that structure applies to one
target Unit. A positive vote supplies one positive judgment for every member
Tag. A negative vote rejects the application only; it does not cast negative
votes on the member Tags.

Realm-scoped definition and application votes are intentionally deferred. They
must be modeled as separate authorities and aggregates rather than merged into
the global scores. The proposed Realm authority and the proposed independent
spoiler dimension are tracked in the
[VNDB v11 research report](./vndb-v11-entity-tag-research-report.md).

## Primary display path

Adopted design; ships with the development preview exit.

Every Tag with at least one accepted path has exactly one primary display
path:

- eligible definitions are structures whose final member is that Tag and
  whose definition score is positive;
- eligible definitions rank by the Wilson lower bound of their definition
  votes with the documented confidence, score, vote count, then UUID
  tie-break; and
- the top-ranked definition is the primary display path.

The primary display path is what search suggestions, quick-add application,
and default grouped presentation use. Other accepted paths remain one
disclosure away ("N other paths") and fully available in provenance. This
mirrors VNDB's designated primary parent while keeping every alternative
chain first-class.

The selection is maintained as a bounded projection of one narrow row per Tag
(`tag → primary structure`), refreshed when a definition-vote aggregate
changes for a structure ending at that Tag. The refresh cost is proportional
to the number of accepted paths ending at that one Tag; an ends-at inverse
index (final member to structure) keeps the lookup indexed. Imports may seed
the initial ranking signal — for example VNDB's `main` parent flag — as
ordinary attributed definition votes, never as a separate authority.

## Search and indexing

Adopted design; ships with the development preview exit.

### Principles

Input surfaces search Tags, never Structure definitions. Hierarchy appears in
search as context on a Tag suggestion, not as a separate searchable thing or
an input mode. Structure search remains available to curation, management,
and deduplication surfaces behind their existing authorization; it is removed
from ordinary application flows.

### Suggestion shape and ranking

A Tag suggestion row presents the localized title, the primary display path
as a breadcrumb ("发色 › 红色" beneath the title "红色"), and the usage count.
Suggestions rank by exact title match, exact alias match, prefix match, then
infix match, with usage count descending inside each band. When nothing
matches, the surface offers the existing Tag creation flow so free vocabulary
growth continues to feed the ordinary Unit lifecycle instead of dead-ending.

Breadcrumb reads are bounded: one batched indexed join per suggestion page
(page size × path length ≤ 16 member title lookups) through the primary-path
projection, with member titles derived live from Tag localizations exactly as
the presentation layer already does.

### Search document composition

Tag search text stays what the reference governance already defines: the
Unit's localized titles plus admitted aliases (score of at least 3, or
pinned), per
[vote-and-reference-governance.md](./vote-and-reference-governance.md).

Ancestor terms are deliberately not copied into descendant search documents.
The vocabulary is a corpus-scale relation (planned at 500,000,000 rows and
estimated at 3,000,000,000 like every other corpus relation), so a hot root's
descendant set is unbounded; copying ancestor text would turn one alias or
localization change on a root Tag into an unbounded fan-out of descendant
document refreshes. Compound discovery is solved at query time and through
alias enrichment instead.

### Compound query resolution

Goal: a query like `红色头发` ("red hair") must resolve to the Tag `红色`
("red") in its `发色 › 红色` ("hair color › red") context without the user
searching paths, and "red hair" must behave the same way in spaced languages.

- Stage 1 — direct match. The existing title and alias search answers the
  query. If the community or the assisted-proposal layer has already admitted
  `红色头发` as an alias of the leaf Tag, resolution ends here.
- Stage 2 — bounded decomposition, only when the settled (debounced) query
  returns fewer direct hits than a small threshold. The query is split into
  two parts: contiguous two-part splits for unspaced CJK text under a length
  cap, token bipartitions for spaced languages under a token cap. Each side
  probes titles and aliases for a bounded number of candidate Tags. For each
  candidate pair, an indexed conjunction probe finds accepted structures that
  contain both Tags with one of them as the final member; that final member
  is returned as the suggestion, with the matching path as its breadcrumb
  context. For `红色头发`, the split `红色 | 头发` matches the Tag `红色` and
  an alias of `发色`, and the conjunction finds the accepted structure ending
  at `红色`.
- Miss path — alias enrichment. Unresolved compound queries become alias
  proposals through the existing alias proposal and vote pipeline (community
  submissions and the assisted-proposal layer), so hot compounds migrate into
  Stage 1 direct hits over time. No new authority or bypass is created.

Index support: the existing `unit_structure_member` inverse index by member
Unit, the definition header for final-member and acceptance checks, and the
ends-at index introduced for the primary-path projection. Every probe is an
indexed lookup; no stage scans the corpus.

Cost bound: decomposition runs only on settled queries below the direct-hit
threshold, never per keystroke. With the length cap the split count is
bounded (at a 32-character cap, at most 31 splits, so at most 62 side
probes), pair-conjunction probes run only for splits where both sides
matched, and every probe is a B-tree or PGroonga index seek. Worst-case work
is a fixed small number of index probes per query, independent of corpus
size. Exact caps and thresholds are prototype tunables recorded in the
research report's open decisions.

## Application interaction

Adopted design; ships with the development preview exit.

### One Tag input component

Ordinary application flows have exactly one Tag picker. There is no separate
Structure picker and no flat-versus-structure mode switch. Mode tabs were
considered and rejected: a structure mode re-imposes the pre-coordination
burden that the FAST evidence retired, splits one vocabulary across two
search targets, and makes the common case pay for the rare one.

Selecting a suggestion applies it with at most one extra decision:

- exactly one accepted path ends at the Tag: the application is written
  through that path silently. The contributor typed a flat Tag; the system
  recorded the precise sense.
- multiple accepted paths end at the Tag: an inline sense chooser lists them
  as breadcrumb chips — primary path preselected, Wilson-ranked, a bottom
  sheet on small viewports. One extra tap resolves the sense. This turns the
  known polyhierarchy flaw of blanket parent inheritance (a VNDB vote
  propagates into every parent sense whether or not it applies) into a
  single bounded choice that appears only when senses actually diverge.
- no accepted path ends at the Tag: the flat `unit_tag` application is
  written exactly as today. Nothing about paths is surfaced.

The chooser lists only paths that end at the selected Tag: applying a longer
path would assert member Tags the contributor did not choose.

Optional per-application judgments (for example the proposed spoiler level)
attach after the application as non-blocking affordances; the absence of a
judgment is the absence of evidence, not a vote. The spoiler dimension itself
remains a proposal in the research report.

Write amplification: a quick-add through a path writes one application row
(first application only), one application vote, at most L support rows, and
at most L effective-projection upserts, with L bounded at 16 and typically
two to four. The accepting ADR must re-derive contribution throughput targets
from this amplification against the vote-governance baselines.

### Surfaces

Three surfaces divide the product, in line with the VNDB reference surfaces
listed above:

- Reading summary (Unit association surface): sections grouped by accepted
  path root, spoiler-safe defaults, `Summary` and `All` modes, exact "N more"
  disclosure, and navigable group, path, and Tag identities.
- Complete exploration: a grouped hierarchy list — not one Card per path —
  reusing the inline path primitive
  ([tag-structure-path.tsx](../../apps/web/features/tags/components/tag-structure-path.tsx))
  for each row, with `direct`, `derived from Path`, `accepted in Realm`, and
  `inherited from global` stated in text or accessible labels rather than
  color alone, keyset pagination by group, and virtualization for long
  groups.
- Contribution: a dense grouped grid on desktop (the contributor's judgments
  beside community evidence and provenance), accordions on mobile, staged
  edits with an unsaved count and bounded batch submission. A Path row votes
  on the entire path application; its projected member Tags are read-only
  evidence unless the contributor explicitly opens a direct Tag application.

Structure authoring — proposing new definitions and voting on definitions —
lives only in curation surfaces reached from Tag pages and management views,
never inside the application picker.

## Effective Tag projection

Direct Tag applications remain authoritative facts in `unit_tag`. Positive
structure-application votes create provenance rows in
`unit_tag_structure_support`.

Database-maintained `unit_effective_tag` and `unit_effective_tag_vote` tables
collapse those sources:

- a Tag context exists when it has a direct application or any structure
  support;
- a profile's direct Tag vote takes precedence;
- otherwise any number of positive structure paths becomes exactly one
  positive effective vote for that profile, target Unit, and Tag; and
- a negative direct vote and positive structure support from the same profile
  cannot coexist.

Tag aggregates and Tag filtering read the effective tables. Current Search joins them when a
relational Filter requests Tag or Structure predicates; PGroonga contains no copied Tag document.
Provenance remains available for explanation and rebuilding.
Projection refreshes and aggregate refreshes take transaction-scoped advisory
locks keyed by the affected target, Tag, Structure, and Profile dimensions.
Application-vote changes and administrative definition corrections share the
Structure-definition lock, so a correction rebuilds from a committed vote set.
Unrelated votes remain concurrent while same-key recomputation cannot lose a
concurrent committed change.

## Presentation and hierarchy

A structure is rendered on a Unit only when both its definition score and its
application score are positive. Rendered structure members are omitted from
the flat global Tag list. Rejected or truncated structures do not suppress flat
Tags.

A Tag page reads only accepted adjacent edges. It displays a bounded set of
direct children and one additional bounded hop for each child. Duplicate edges
from multiple paths collapse to the strongest accepted definition and are
ranked with the Wilson lower bound, then stable score, count, and UUID
tie-breakers.

When one effective Tag has multiple accepted paths, the default presentation
shows the primary display path and discloses "N other paths"; every source
stays available in provenance details.

Search filters accepted structures through the authoritative effective relations. Display titles
are derived live from ordered member Tag localizations and accepted aliases. Member localization,
lifecycle, alias, and definition-vote changes update those authoritative rows directly; there is no
search invalidation or dependent structure document.

## Assisted proposals

Adopted design; ships after the contribution surfaces (see the roadmap).

An assisted-proposal layer may generate candidate path definitions (including
seed candidates from imported hierarchies), placement suggestions for new
Tags, duplicate and redundancy warnings, alias suggestions for unresolved
compound queries, and localization suggestions. Every output enters the
existing proposal, lifecycle, and vote pipelines as an attributed proposal
with provenance. The layer holds no acceptance authority and runs entirely
off the request path. This is the division that current LLM taxonomy research
supports — reliable systems pair generation with structural validation and
human acceptance ([ReLTEx](https://arxiv.org/abs/2608.10970),
[WiKC](https://arxiv.org/abs/2409.04056)) — and the Wikidata evidence above
is the record of what unsupervised structural authority produces.

## Governance observability

Adopted design; ships with the definition-governance surfaces.

Vote-based governance has no single approval bottleneck, but it can starve:
a pending definition that nobody votes on is the vote-system analogue of
VNDB's months-long moderation backlog and AO3's slipped wrangling windows.
Pending-definition queue depth and time-to-decision are therefore first-class
operational metrics, and contribution surfaces expose pending definitions to
concentrate community attention instead of hiding the queue in management
views.

## Cost model

Let `L` be path length, bounded at 16.

- Definition creation, member/edge projection, and one positive application
  vote are `O(L)`.
- A quick-add through a path writes one application row (first application
  only), one application vote, at most `L` support rows, and at most `L`
  effective-projection upserts.
- An administrative correction is `O(L + A×L)`, where `A` is the number of
  positive application votes whose support provenance must be rebuilt. It is a
  rare platform-authorized operation and does not add cost to ordinary reads or votes.
- Projection locking is partitioned by logical key; a vote contends only with
  another change that can affect the same effective fact or aggregate.
- Exact-path deduplication is a B-tree lookup on the bounded UUID array.
- Inverse membership and adjacent navigation use indexed narrow tables.
- Effective Tag lookup is keyed by `(unit_id, tag_id)`; per-profile vote
  deduplication is keyed by `(unit_id, tag_id, profile_id)`.
- The primary display path is one narrow projection row per Tag; a refresh
  costs one ranking pass over the accepted definitions ending at that Tag,
  through the ends-at index.
- Suggestion breadcrumbs are one batched indexed join per suggestion page,
  bounded by page size × `L`.
- Compound query decomposition is a fixed small number of index probes per
  settled query (length-capped splits, candidate-capped sides, conjunctions
  only for matching pairs); no stage scans the corpus.
- Unit rendering reads a bounded number of accepted structures plus a bounded
  flat Tag list.
- Tag hierarchy reads indexed one-hop edges twice. It does not maintain a
  transitive closure or run an unbounded recursive query.

This favors the common write/read paths while keeping the rare “Tag plus all
descendants” query out of the core storage cost. If descendant workloads become
material, a versioned asynchronous closure projection can be added without
changing structure identity or votes.
