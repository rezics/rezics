# Rating contexts, history and time distributions

Status: selected complete target contract. M06 owns rating meaning and commands;
M09 owns bounded statistics and discovery. Standing, daily and per-experience
ratings are all selected scope. Implementation order may start with the
Steam-style view, but that view alone does not complete this contract. See
[acceptance](../../testing/ratings-and-event-time.md) and
[capacity](capacity.md). Existing mutable Score rows are implementation evidence,
not the target's history or context model.

## Context, observation and revision

A rating context identifies a question, eligible population, target granularity,
scale and evaluation cadence under a governance scope. It is distinct from a
Realm, semantic Tag, presentation filter and aggregation query. Several contexts
can coexist in one Realm. AI companies, model families and exact model versions
are ordinary typed targets of this shared capability; classifying something as
AI does not create another score service or confer voting eligibility.

| Identity | Meaning and continuity |
| --- | --- |
| Context | One evaluation contract, such as current overall opinion, today's experience, or an individual use. Daily and per-experience questions have different context identities. |
| Context revision | Exact question wording, scale contract, target/population rules, calendar policy and default aggregation configuration. Sealed revisions remain resolvable. |
| Observation | One person's evaluation of one target in one context and evaluation slot. A new day or intentional new experience creates a new observation within the existing context. |
| Observation revision | A correction, withdrawal, restoration or visibility change to that same observation. Only its selected effective revision contributes to ordinary statistics. |

An edit to a label or help text can preserve context meaning. Changing the
question, target granularity, population, scale meaning or cadence creates a new
context with an explicit predecessor relationship; old observations are not
reinterpreted. Changing only the default aggregation creates a versioned policy
revision and read generation, retaining the context and observations. A scale
change is not justified by both scales having ten numeric choices. No implicit
normalization combines incompatible contexts or scales.

The evaluation slot is server-validated:

- `standing`: one durable observation for the rater/target/context. Updating an
  opinion revises it; original submission time stays fixed.
- `daily`: one observation per rater/target/context/calendar period. Same-day
  correction revises it; tomorrow's explicit submission creates another, even
  when its value is unchanged.
- `experience`: one observation per rater/target/context/occasion. An occasion
  is an intentionally recorded use, with an identity and evaluation time. A
  request retry cannot invent a new occasion; another intentional use can.

A new observation is not automatically a new context. Context creation is an
authorized configuration operation, never an implicit effect of a score edit,
new day, review publication, new UI tab or changed graph filter. Typed binding
to an existing experience/event is optional and must satisfy its role contract;
an experience need not fabricate a catalog Event or social Publication.

## Time and history

Store the evaluation instant or period, server-recorded submission instant,
immutable original submission instant, revision sequence/time and exact context
revision separately. Real instants use `timestamptz`; daily periods use a
calendar date plus the pinned IANA time zone and resolved half-open UTC bounds.
Public daily contexts default to UTC. A different context zone is explicitly
configured; changing browser/profile time zone does not change the period key.
A calendar day is not a rolling 24-hour cooldown and may span 23 or 25 hours.

Standing evaluation time is the time the current opinion was explicitly stated;
correcting metadata alone does not advance it. Daily evaluation order follows
the period, and per-experience order follows the declared experience time.
Stable observation IDs break equal-time ties. Revision time selects the version
of one observation, not its order among observations. Correcting an occasion's
time uses a dedicated redate command, history and aggregation invalidation;
ordinary text/value editing cannot silently move an observation to another day.

Public daily submission defaults to the currently open period; an existing
observation can be corrected or withdrawn later with an expected revision.
New backdated daily submissions require an explicit context admission policy
with a finite late-entry horizon. Future periods are rejected. Per-experience
backdating is explicitly declared and retains the actual submission time.
Late entries/corrections recompute their affected buckets; the response exposes
the new generation/freshness. Closed periods are not a promise of immutable
public totals: corrections, moderation and disclosure can change them.

No submission means no observation, not zero, a carried-forward daily value or
an automatic repeated vote. A withdrawal remains the effective state of that
observation. Ordinary `latest` selection ranks observations before checking the
selected observation's availability: withdrawing or making the latest private
does not silently resurrect an older public opinion. Restoration is explicit,
appends a revision and rechecks current authority. Historical analytics retain
other independently eligible observations; erasure can remove their payloads
under the shared erasure contract.

## Aggregation policy

Resolve one target, context, compatible scale, audience and time selection
before reduction. The server returns the resolved policy and generation even
when the client omitted them. Contexts do not inherit company scores from
models, family scores from versions, or scores from a publication's children.
Comparisons return separately labeled series. A cross-context synthesis needs
its own explicit metric contract and is not an ordinary score aggregate.

Aggregation has two stages: reduce each rater's eligible observations, then
aggregate the resulting representatives across raters. The platform default is
`latest_per_rater` followed by an equal-rater arithmetic mean. A context explicitly
asking about accumulated experience can select `mean_per_rater` as its versioned
default. Both operations are supported; the display and API name the selected
method. Defaults do not remove the alternative or overwrite saved advanced
selection. Heuristic reputation weighting is not part of these raw summaries.

| Method | Representative and denominator |
| --- | --- |
| `latest_per_rater` | Last observation in the selected evaluation range, using its effective revision; one eligible representative per private counting identity. No older observation outside the range fills a missing value. |
| `mean_per_rater` | Arithmetic mean of each rater's eligible effective observations in the explicit range, then equal weight per represented rater. Revisions of one observation never become extra samples. |
| `observation_distribution` | Raw effective observations in the range, each counted once; denominator is observations, not people. This is a labeled analysis view, not the default headline. |

For selected values x(i,j), let n(i) be rater i's observation count and N the
number of represented raters. The history mean is
`sum_i(sum_j(x(i,j)) / n(i)) / N`; pooling all submissions instead computes
`sum_i,j(x(i,j)) / sum_i(n(i))`. A history mean weights experiences equally within
each person; it does not infer duration weighting or give an unobserved day a
value. A time-weighted interpretation requires a different declared metric.

Example: A records 2, 2, 8 and B records 6. Latest-per-rater yields 7;
mean-per-rater yields 5; pooled observations yield 4.5. These are intentionally
different answers. The empty result has null mean and zero counts, not mean 0.
Return rater count and observation count separately. Account identity is a
counting rule, not proof of unique natural persons or representative sampling.

Preserve scale/category counts. Latest-per-rater histograms count selected
representatives at their actual scale value. Mean-per-rater representatives may
be fractional: return declared numeric bin boundaries or the exact representative
values in bounded detail, never round them into fictitious original ballots.
Return the raw observation histogram separately when requested. Accumulate exact
sums/counts; define decimal serialization and final rounding in the scale contract.
Serialize counts outside JavaScript's safe integer range as decimal strings.
No integer cast may silently narrow a database `bigint` count.

A standing context has only one effective observation per rater, so its
mean-per-rater view does not average correction revisions. Historical-as-of
reads can show earlier standing opinions; counting each edit as another experience
would require a different context and is not a history-average shortcut.

An all-time latest score reports the ages of represented evaluations. It must
not be labeled today's opinion. A recent view uses an explicit evaluation-time
range; an as-of view additionally selects the effective revisions at a recorded
cut. Backdated input was not known before its recorded submission. Current
disclosure/erasure still overrides historical availability. Population changes
between days do not establish that the same people changed their minds, and a
nearby event marker does not establish causation.

An exact recorded cut or exported snapshot is server-resolved against a complete
revision/read generation and committed frontier. A client timestamp or the
largest UUID is not proof of a consistent database snapshot. Queries state which
historical cuts they can reconstruct and return unavailable outside retained
history; no old snapshot overrides current erasure/disclosure.

## Time distributions and drill-down

The Steam-style submission-cohort view groups standing observations by their
immutable first-submission day and uses the effective rating revision at the
query cut. A correction moves that observation's value within its original
bucket; it is not a new rating or a new rater. The chart describes the current
distribution of ratings submitted then, not the score displayed then. A
historical-as-of view is separately named. Restoring a withdrawn standing score
does not reset its first-submission cohort.

Daily and per-experience charts normally use evaluation time and their selected
context. A submission-time activity view is separately selectable and labeled.
Day/week/month display buckets do not change observation identity or voting
cadence. A weekly/monthly mean-per-rater result must be reduced over the requested
range; it cannot be obtained by averaging daily means or summing daily unique
rater counts. Snapshotting an unchanged standing opinion is not daily participation.

Requests name target references, context, time basis, range, time zone, display
granularity, per-rater reduction, scale and optional historical cut. The server
normalizes them, applies policy and bounds the work. Results include bucket
bounds, resolved context/policy/scale, rater and observation denominators,
histograms/means, generation, processed frontier, coverage and partial/unavailable
state. Empty complete buckets can be rendered as zero counts; an incomplete
projection cannot be rendered as an empty day.

Drill-down uses the identical context, time basis, reduction, audience and
generation. It lists the contributing observation/revision or representative
with permitted provenance and a stable keyset cursor. A new generation requires
an explicit restart; aggregate counts must not silently disagree with the
selected population. Hidden observation IDs, authors or counts are not exposed.

## Commands and interaction contract

The shared API/SDK/MCP capability supplies context discovery, action resolution,
submission, correction, withdrawal/restoration, history, context management,
aggregate queries and contributor drill-down. Resolution returns current context
identity/revision, target, evaluation slot, existing observation/revision when
permitted, allowed action and its effect on statistics. A write supplies that
context, action, expected revision/slot and idempotency key. The server revalidates
them in the write transaction; resolution is not a lasting authority grant.

| Action | Required input and effect |
| --- | --- |
| Correct existing evaluation | Observation ID, expected revision and allowed field changes; append one revision, preserve observation/context identity. |
| Record another day/experience | Existing context ID and validated new period/occasion; create one observation. A collision returns the existing-slot outcome rather than silently revising it. |
| Evaluate a different question | Explicitly choose an existing different context, or create one with context-management authority; preserve prior context observations. |
| Change aggregation | Read policy selection, or authorized versioned context-default change; do not create, revise or move observations. |

Before submission, the GUI must make these distinctions understandable without
requiring database terminology. Show the evaluation question, target/version,
day or experience, and whether the action updates an existing evaluation,
records another evaluation under the same question, or switches to a different
question. Show the existing value/date when correcting it. A different context
shows what changed, including scale, cadence or population when applicable.
Use an inline action summary and clear action label; a mandatory confirmation
dialog for every ordinary score is not required.

Changing a selector never silently creates a context, retargets a saved rating,
or turns a correction into another vote. Preserve advanced API-created context
and aggregation state. Stale context/revision, closed period and denied actions
preserve the draft and return typed outcomes with a way to refresh or choose a
valid action. No duplicate-error fallback auto-creates an experience.

Charts and cards display the question, range, latest-versus-history method,
people-versus-observations denominator and freshness. History distinguishes
observation entries from their revisions. A Post can explicitly cite an exact
rating revision or request a labeled live view; publishing/reposting that Post
does not submit another rating. Visible strings belong to typed locale resources
when implemented; this document specifies meaning, not production copy.

## Persistence, authority and projections

Context definitions/revisions, observations/revisions and per-rater heads are
owned by the rating module with concrete REF/XREV contracts. Do not implement
ratings as unrestricted knowledge assertions: eligibility, duplicate keys,
withdrawal and aggregation are participation invariants. Public Agent attribution
and private accountability keys follow the shared access model. Default community
ratings count authenticated human principals; represented Agents cannot multiply
one principal's contribution. Institutional ratings or autonomous evaluator
populations require distinct explicitly admitted contexts and counting rules.
Imported provider aggregates remain `source_statistic`, not native observations.

Uniqueness applies to counting identity/target/context/evaluation slot. Context
semantic version changes cannot evade that key inside a continuing context.
Serialize slot writes and expected revision checks with current authority fences;
commit revision, effective head and durable projection work atomically. Retrying
the same operation returns its receipt; reusing its key for changed input fails.
Context retirement denies new observations but preserves authorized history and
explicit correction/withdrawal policy. Deletion, merge and reclassification do
not combine contexts or double-count formerly distinct identities automatically.

Maintain sparse per-rater/target/context state and time projections, with
idempotent revision deltas and striped target aggregates. Repeated experiences
need rater-period sufficient statistics; distinct-rater sets and latest selection
are not additive across arbitrary ranges. Use the budgeted query paths in
[the temporal workload envelope](temporal-capacity.md). Correction, redate,
withdrawal and visibility changes invalidate the affected generations. Broker
receipt time never determines the observation's bucket. Retain authoritative
history separately from bounded outbox retention so rebuilding remains possible.

Permission reduction must suppress affected aggregate/disclosure paths before
acknowledging a safe public read; an audience-unsafe generation returns pending
or unavailable until repaired. A stale permissive count is not acceptable even
when raw rows are hidden. No user-selectable filter supplies independent business
authorization. Account erasure and restores use the shared erasure frontier.

## Evidence and qualification limits

Primary sources reviewed September 14, 2026:

- [Steamworks review API](https://partner.steamgames.com/doc/store/getreviews?l=english)
  distinguishes created/updated timestamps; [review documentation](https://partner.steamgames.com/doc/store/reviews?l=english)
  distinguishes recent and lifetime summaries. The submission-cohort correction
  policy above is REZICS's decision, not a claim about undocumented Steam internals.
- [Letterboxd FAQ](https://letterboxd.com/faq/) retains ratings on earlier diary
  entries and counts one recent rating per member in the film average. REZICS
  adopts the observation/current-summary distinction, not its undisclosed
  weighting or automatic promotion of an edited old diary entry.
- [IMDb ratings FAQ](https://help.imdb.com/article/imdb/track-movies-tv/faq-for-imdb-ratings/G67Y87TFYYP6TWAV),
  updated February 9, 2026, describes one replaceable title rating per user.
  This is a current-opinion precedent, not a daily-observation contract.
- [Bakdash and Marusich, 2017](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2017.00456/full)
  distinguishes within-person and between-person analysis of repeated measures.
  It motivates preserving those populations; it does not validate a community
  sentiment estimator or require running a correlation model on score requests.
- [W3C SOSA/SSN, 2017 Recommendation](https://www.w3.org/TR/2017/REC-vocab-ssn-20171019/)
  separates observation subject, phenomenon time and result time;
  [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) specifies calendar/time-zone
  distinctions; [Apache Beam windowing](https://beam.apache.org/documentation/programming-guide/#watermarks-and-late-data)
  explains processing-time lag and late results. These inform semantics and
  recovery, not a requirement to introduce RDF, a calendar service or Beam.

Mutable-only scores, copied daily snapshots, one Realm per day and pooled
submissions as an unlabeled headline were rejected for the distinctions above.
Source precedents and arithmetic examples do not qualify SQL concurrency,
representativeness, production capacity or human understanding. All three rating
cadences, UI distinctions and aggregation methods require the owning acceptance
cases before this complete target is claimed implemented.
