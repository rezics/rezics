# Rating and event-time acceptance

Owners: M02/M04/M06/M09, followed by frontend acceptance. Contracts:
[rating contexts and history](../architecture/database/ratings.md),
[event-time discovery](../architecture/database/event-time.md),
[workload envelope](../architecture/database/temporal-capacity.md).
All cases below are required target specifications pending executable
qualification. Document checks and worked arithmetic do not count as SQL,
API, rendered, population or production-capacity acceptance.

## Rating meaning and persisted state

| Case | Required behavior |
| --- | --- |
| RATE01 | Create company, model-family and exact-version targets without new per-class score services; classify through Tags and score each under the same generic capability with independent target semantics. |
| RATE02 | Create standing, daily and per-experience contexts in one Realm; retain independent question/scale/population identities and reject implicit cross-context aggregation. |
| RATE03 | Correct a standing observation several times; retain one identity and first-submission cohort, immutable revisions and one effective contribution. Metadata-only correction does not advance evaluation time. |
| RATE04 | Submit the same daily score on two successive days; create two observations under the same context. Same-day correction creates a revision, not a third observation. |
| RATE05 | Retry a per-experience operation after commit-before-response; return its original observation/occasion. Another intentional experience gets a new identity even with equal value/time. |
| RATE06 | Race two submissions for the same rater/target/context/day using separate connections; enforce the slot key and return existing-slot/conflict rather than creating a second contribution or silently overwriting. |
| RATE07 | Race corrections with the same expected revision; only one advances the head. Reuse an operation key with changed input and reject it. |
| RATE08 | Change label/help text without changing meaning; preserve context. Change question, scale semantics, target granularity, cadence or population; create an explicitly related new context and preserve old references. |
| RATE09 | Change only a context's default aggregation; retain context and observations, advance policy/read generation and preserve explicitly saved query selection. |
| RATE10 | Switch represented Entities controlled by one principal; do not multiply votes. Separate institutional/autonomous-evaluator contexts must enforce their own admitted counting rules. No public response reveals the private counting key. |
| RATE11 | Revoke participation/context authority while a resolved write waits; current fences reject the mutation without an observation, revision or accepted partial aggregate. |
| RATE12 | Retire a context; reject new observations, preserve authorized history and explicitly permitted correction/withdrawal. A new context revision cannot evade slot uniqueness. |
| RATE13 | Cross midnight and DST in a pinned context zone; periods match the server calendar, including 23/25-hour days. Change viewer zone without granting another vote. |
| RATE14 | Reject a future daily period and unauthorized backfill; an admitted late entry retains submission time and correct evaluation period. A historical recorded cut cannot see later backdated input. |
| RATE15 | Correct an old observation's score/text; it does not become the newest observation merely because its revision was written last. A dedicated redate updates the right old/new buckets with explicit history. |
| RATE16 | Withdraw or restrict the latest observation; do not silently resurrect an older public score in latest-per-rater. Restore explicitly with current authority; preserve independent eligible observations in historical analysis. |
| RATE17 | Publish/repost/convert a review with exact-rating or explicitly live references; do not create another observation or silently replace an exact cited revision. |
| RATE18 | Merge/split target identities or change classification; preserve original observations/history, detect counting collisions and use governed resolution without automatic sum/transfer. |

## Rating query and recovery

| Case | Required behavior |
| --- | --- |
| RATE19 | A has observations 2, 2, 8; B has 6. Latest-per-rater mean is 7, mean-per-rater is 5 and pooled-observation mean is 4.5. Corrections are not extra observations. |
| RATE20 | A has thirty 10s; B one 1. Observation mean is 301/31; equal-rater latest/history means are 5.5. Report 2 raters and 31 observations with the correct denominator. |
| RATE21 | Latest representatives remain integer scale values; mean-per-rater can be fractional. Preserve raw observation bins and explicitly defined representative bins without rounding away meaning. |
| RATE22 | Query a bounded evaluation range; a rater with only earlier observations contributes nothing. Empty complete result has null mean and zero counts; pending projection is not a zero day. |
| RATE23 | Compare a standing submission-cohort chart, evaluation-period chart and historical-as-of chart after a correction; each uses its declared clock/revision population. |
| RATE24 | Compute a month from per-rater sufficient state, including overlapping daily raters; do not average daily global means or sum daily distinct-rater counts. |
| RATE25 | Drill into a bucket using the same normalized query/generation; visible contributors agree with the metric. Changed context/range/scale/generation invalidates the old cursor. |
| RATE26 | Restrict one observation or target while a cache, export and delayed worker retain its data; block unsafe aggregate/count/history disclosure immediately, then publish a safe generation. |
| RATE27 | Redeliver correction/withdrawal deltas and reclaim an expired worker lease; no double decrement, negative count, stale generation activation or processing-time rebucketing. |
| RATE28 | Rebuild after outbox expiry or restore; authoritative observations/revisions suffice, and erasure/revocation frontiers prevent resurrection before reads resume. |
| RATE29 | Return counts above JavaScript's safe integer range without truncation; preserve rational/decimal accumulation and declared rounding. |
| RATE30 | Exceed timeline cells, candidate work or exact-range request budgets; return typed rejection, continuation or admitted background progress. A prefix is never reported as the whole population. |
| RATE31 | Cancel/crash an exact custom-range job; keep its input manifest, progress and receipt, never activate incomplete output, and permit bounded retry under current authority. |
| RATE32 | Hold every individual's score fixed while the responding population changes; raw daily summaries change, but no response claims individual opinion change or event causation. |
| RATE33 | Request history mean for standing scores after several revisions; use one effective observation per rater, not one sample per edit. Explicit historical-as-of views retain their recorded-cut semantics. |

## Event identity, dates and queries

| Case | Required behavior |
| --- | --- |
| TIME01 | Create an Event category Tag, a concrete event and a named-event topic binding; one governed event date supplies discovery. Renaming the Tag does not alter date or event identity. |
| TIME02 | Two Tags denote the same event; event search returns one event and content search deduplicates a post while retaining its permitted match reasons. No duplicate writable date authority exists. |
| TIME03 | Reclassify event semantics through Tag applications; preserve property/structural-capability validation and reject an incompatible role independently from Tag acceptance or actor permission. |
| TIME04 | Expose a native release/broadcast occurrence through the temporal adapter with complete concrete keys and source revision; do not manufacture another editable event. |
| TIME05 | Record actual occurrence, planned schedule, announcement date and imported/recorded time separately. Passing the scheduled date or missing a cancellation flag never proves occurrence. |
| TIME06 | Query a full date, month-only point, year-only point, multi-day duration, open interval, uncertain date and unknown date; retain precision and definite/possible/unknown outcomes. |
| TIME07 | A month-only point can possibly match a day within that month but is not a definite match for that day or a month-long duration. An exact duration uses overlap semantics instead. |
| TIME08 | Query exact instants and civil dates across zones and DST; reject unsupported conversions, ambiguous local clocks and incompatible calendars without fabricated UTC instants. |
| TIME09 | Race two accepted-date corrections or source/human decisions; current value is atomic with the accepted decision, old evidence remains, and stale worker output cannot restore the previous date. |
| TIME10 | Combine event date and actor/model/version roles; all conditions match the same accepted association revision. Unrelated binary edges cannot produce a match. |
| TIME11 | Reschedule/cancel and later record actual occurrence; default actual queries and explicit planned queries return their own dates/states with appropriate history. |
| TIME12 | Query repeated conference occurrences with equal titles/participants; preserve their distinct identities, dates and series relationship without infinite recurrence expansion. |
| TIME13 | Correct a date while paginating; cursor generation forces explicit restart when needed, with no silent duplicates/skips. Unknown-date entries do not sort as invented earliest dates. |
| TIME14 | Hide event, binding or evidence during search/facet/export; no hidden date, count, participant or match reason leaks from a stale permissive projection. |
| TIME15 | Exhaust mixed Tag/date/participant scan and sort budgets, including dense GiST candidates; preserve examined progress and explicit incomplete state. |
| TIME16 | Withdraw a source date while another source/human support remains; follow scoped acceptance and single-writer rules, not last-import-wins. |
| TIME17 | Roundtrip native events with partial dates, context calendars, exact temporal roles, topic bindings and source provenance; unknown and cancelled states survive. |

## Experience acceptance

Implement after backend acceptance, using scoped Storybook screenshots and
interaction tests under the existing verification boundary. Full-application
or human-study acceptance requires its own authorized workflow.

| Case | Required behavior |
| --- | --- |
| TEMPUI01 | Before submission, an ordinary user can identify the question, target/version and day/experience, and whether this changes an existing observation, adds one under the same question or uses another context. |
| TEMPUI02 | Correcting shows the existing value/date. Switching contexts names material differences. Changing a display filter/aggregation never silently creates a context or rating. |
| TEMPUI03 | A stale revision, slot collision or changed context preserves the draft and offers the valid next action; it cannot auto-convert into another experience. |
| TEMPUI04 | Cards/charts name latest-versus-history reduction, time basis/range, rater/observation denominator and freshness. Fractional representatives and empty/pending states remain truthful. |
| TEMPUI05 | Open history, revise an old observation, return to current summary and drill into a bucket; observation/revision identity and selected population stay understandable and consistent. |
| TEMPUI06 | Edit an API-created advanced context/filter with uncertainty/calendar/custom aggregation; ordinary controls preserve its meaning or route to a capable editor. |
| TEMPUI07 | An event editor distinguishes correcting a date, adding another occurrence and choosing another referent. Category Tag, named topic and concrete event are identifiable. |
| TEMPUI08 | An event marker on a rating chart exposes its date precision, state and target/version context without claiming causation or changing rating context. Keyboard/list alternatives support the same actions. |

## Qualification evidence

Use source-free produced IDs, two independent PostgreSQL connections, current
identity/Realm policy and exact source fixtures. Expected reductions come from
the fixture definitions, not a second call to the query under test. Exercise
ordinary and malicious/stale operations through public API, SDK and permitted
MCP adapters. Source aggregates never create native raters.

Record plans and row/index/WAL measurements for both temporal candidate orders,
hot contexts/targets/raters, sparse tails, large distinct-rater windows, corrections,
privacy invalidation and restore. The [capacity envelope](../architecture/database/temporal-capacity.md)
defines request/worker budgets, 500M/3B assumptions and intervention criteria.
Include all three cadences and both personal reduction methods in integrated G4
acceptance; completing only the standing submission histogram is insufficient.
