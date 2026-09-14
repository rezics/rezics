# Event identity, Tags and occurrence-time discovery

Status: selected target contract. M02 owns semantic classification, typed facts
and contextual acceptance; M04 owns concrete catalog event structures; M09 owns
temporal indexes and query execution. [Acceptance](../../testing/ratings-and-event-time.md)
and [capacity](temporal-capacity.md) cover their composition. A source event
table or generic date value alone does not qualify this capability.

## Classification and identity

Semantic classification uses the existing Tag/Expression/Application contract.
Catalog classification assertions and class-definition adapters refer to that
same governed vocabulary and accepted application evidence; they must not become
a second independently editable classification authority. Property, predicate,
role and structural-capability definitions still have their own typed contracts.
Those contracts are not automatically satisfied by applying a Tag.

An `Event` classification Tag denotes the category. A particular model launch,
company announcement, outage or convention is a concrete referent with a stable
native reference. A named-event topic Tag can denote that referent through an
explicit, governed `denotes` binding using D03 facts and concrete REF integrity.
The binding has one accepted referent per Tag meaning; a semantic retargeting
creates a new Tag meaning/identity rather than silently moving historical uses.
Several vocabulary terms may denote the same event. They do not create several
events or several copies of its occurrence date.

Reference-owner events already cataloged under the native event structure keep
their identities. No new owner or physical table is created merely because
another event category is introduced. Existing release/broadcast event structures
remain authoritative for their actual domain occurrences. A generic temporal
adapter exposes those same occurrences with their complete identity/revision
keys; it does not create a competing editable event copy. Generic links needing
a standalone referent use an explicitly registered identity or exact occurrence
reference and binding, not an unchecked scalar ID.

Examples:

- An AI company and model have independent references and Tag classifications.
  Their ratings use [rating contexts](ratings.md), not specialized AI score tables.
- A launch event can identify the company, model and exact released version
  through role-bearing participants in one association revision.
- Posts can adopt a named-event topic Tag. An event-date query resolves its
  accepted binding to the event's effective date; it never reads the Tag's
  creation time as the event date.
- A recurring conference's series and each dated occurrence are distinct.
  Repeated occurrences are not collapsed because their title or participants
  match. An indefinite recurrence rule does not expand infinitely on read.

## Temporal facts and one writer

The authoritative temporal description is a revisioned typed occurrence fact
or native structural revision, with scope, provenance and acceptance. Each
adapter declares its single writer. Source-managed native columns and their
claim/decision update atomically through that writer. A generic projection or
Tag binding never creates a second writable date field.

Distinguish actual occurrence, planned schedule, announcement/publication date,
recorded/imported time and the validity interval of a claim. A claim recorded
today can describe an event last year. Its assertion validity is not automatically
the event's duration. Store event state separately: scheduled, occurred,
cancelled and unknown have different meanings. Passing a scheduled date does
not prove occurrence. A reschedule revises the plan and preserves prior evidence;
an observed actual date is separately recorded. Occurred is not inferred from
the absence of a cancellation flag.

The temporal value preserves:

- date-only versus an exact instant, calendar and precision (year/month/day),
  original source expression and uncertainty;
- point event versus a duration with start/end, including explicitly open ends;
- local time with known IANA zone/offset versus an unresolved local clock time;
- unknown, unobserved, conflicted, unavailable and inapplicable states.

Use exact `timestamptz` values only for known instants. A date-only event keeps
its civil date, not a fabricated midnight UTC instant. A month-only point event
means an unknown day within that month, not an event lasting the entire month.
Do not turn year-only values into January 1 or convert unknown bounds to infinity
unless an explicitly open interval was asserted. A closed exact duration must
have ordered bounds; inclusive civil end dates normalize to a half-open search
range while retaining their source precision. Fictional/calendar-specific dates
retain their context; unsupported conversions are explicit query-unavailable
states rather than fake Gregorian timestamps.

Store normalized possible bounds and precision/uncertainty metadata as derived
search values with the exact source decision/revision. Exact durations and
uncertain point dates may share a candidate envelope but not a match rule.
Default search returns definite matches; `possible` explicitly includes candidate
dates whose uncertainty allows the requested relation. Result explanations
identify exact, reduced-precision, uncertain and conflict states without claiming
a possible match is an exact occurrence.

## Elected query operations

Event queries accept classification/topic, participant-role constraints, authority
scope, actual/planned/date role, temporal relation, query range, calendar/time-zone
interpretation, certainty mode, sort and keyset continuation. Default temporal
role is actual occurrence. Planned events require explicit selection and are
visibly labeled. Date-only predicates use civil bounds; instant predicates use
explicit-zone boundaries. Cross-type queries require the caller's declared date
interpretation and an applicable adapter; there is no implicit server-local zone.

| Operation | Meaning and selected access path |
| --- | --- |
| `starts_in` / `occurs_on` | An event's start/point lies in the half-open range; a day is one such range. Exact starts use a B-tree over scope, temporal property/contract, temporal role, normalized start, event key. Uncertain possible-start queries use range candidates and the typed certainty predicate. |
| `overlaps` | A duration intersects the range, or a point lies inside it. Use a GiST range candidate index with typed exact/possible residual checks. |
| Chronological sort | Accepted normalized start and immutable event key; possible matches retain their approximate sort basis. Use the matching ordered index and explicit continuation. |
| Named-event topic date | Resolve the accepted Tag-to-event binding and reuse its temporal projection. Reverse bindings and Tag applications have indexed, paged access. |

For an uncertain point, `definite starts_in` requires its entire possible envelope
to lie within the query range; `possible starts_in` requires intersection. For
an uncertain duration, definite overlap needs the asserted endpoint constraints
to guarantee intersection for every allowed realization; a mere envelope overlap
is only possible evidence. The typed predicate evaluator must preserve that
distinction. Unknown/conflicted dates are not silently admitted as accepted
matches; an explicitly requested diagnostic view reports them separately.

The server-owned Filter field registry exposes these operations and their allowed
target/calendar combinations. A saved Filter cannot declare a new index or
operator. A candidate plan must correlate all role conditions to the same accepted
association revision and combine Tag and temporal constraints within its work
budget. Selective and dense Tag/date combinations have separate measured plans.
GiST candidates do not automatically supply chronological ordering.

Responses include event reference, accepted temporal decision/revision, date
role, original precision, normalized query interpretation, match certainty,
state, permitted participant/provenance summaries and projection generation.
Cursors bind the normalized query, scope, time interpretation, ordering and
generation. Date corrections may require a cursor restart; they cannot silently
skip or duplicate events under an old cursor. Unknown date is not the earliest
date. Date-known and date-unknown lists have separate explicit ordering behavior.

An event timeline returns events, deduplicated by event identity/occurrence.
A content search constrained by event dates returns content, deduplicated by
content identity while preserving each permitted event match reason. Two topic
Tags for the same event must not double-count it or its matching post. These
result modes cannot silently replace each other's denominator or pagination.

## Lifecycle and interaction

Use ordinary typed-fact/native-revision commands for source-free authoring,
proposals, acceptance, correction, withdrawal and restoration. Conflicting
sources remain evidence under the existing decision model. Applying `Event`
does not authorize date edits or automatically adopt every source date.

Changing an event date invalidates its temporal projection and paged reverse
topic dependencies. A newer generation supersedes stale worker output; retries
cannot reapply an old date. Current disclosure checks apply to event metadata,
topic bindings, participants, matches and counts. When an aggregate or projection
cannot safely exclude restricted evidence, report pending/unavailable rather
than leak a hidden event through a date facet or count.

The editor distinguishes a category Tag, a named-event topic and the concrete
event being described. Show whether a user is correcting that event's date,
recording another occurrence or choosing another referent. The ordinary path
uses a question/date/state summary; advanced precision, uncertainty, calendars
and evidence remain inspectable and survive ordinary edits. A label rename
cannot retarget the event or discard an approximate date. Implemented copy uses
typed locale resources.

An event marker can accompany a rating chart using a bounded event query with
the chart's date interpretation. It supplies temporal context only. It neither
changes rating context identity nor causes an average change by definition.
Opening the marker reveals its source, precision and related target/version;
opening a score bucket uses the rating contract's separate contributor query.

## Evidence and limits

Primary sources reviewed September 14, 2026:

- [MusicBrainz Event](https://musicbrainz.org/doc/Event) and
  [event search](https://musicbrainz.org/doc/MusicBrainz_API/Search/EventSearch)
  distinguish event dates, participants, cancellation and searchable Tags.
  Its music/activity scope does not define every REZICS incident or announcement.
- [Library of Congress EDTF, February 4, 2019](https://www.loc.gov/standards/datetime/)
  distinguishes reduced precision, uncertainty and intervals. It informs the
  value contract, not a promise that every EDTF form/calendar is natively indexed.
- [W3C n-ary relations](https://www.w3.org/TR/swbp-n-aryRelations/) supports
  preserving the event and correlated participant roles;
  [SOSA/SSN, 2017 Recommendation](https://www.w3.org/TR/2017/REC-vocab-ssn-20171019/)
  separates phenomenon and result times. REZICS retains relational ownership.
- [PostgreSQL 18 range indexes](https://www.postgresql.org/docs/18/rangetypes.html#RANGETYPES-INDEXING)
  support overlap/containment candidates. Bounds, partial-date certainty,
  authorization and combined Tag/date query costs remain REZICS obligations.

Parsing dates from labels, indexing `created_at` as occurrence time, independently
editing dates on both Tag and event, and inferring actual occurrence from a
planned schedule are rejected. Query-plan, source conversion, concurrency,
revocation and rendered interaction acceptance remain pending implementation.
