# Votes, names and reference governance

Status: target contract. [Names](catalog-names-and-authority.md),
[classification](tag-paths.md), [identity/access](identity-and-access.md) and
[ratings](database/ratings.md) own their distinct meanings. A shared tally format
does not make every consumer use the same acceptance policy.

## Vote facts and attribution

A binary judgment records -1 or 1; absence means no judgment under the declared
voter identity and scope. The vote contract declares its counting identity and
public attribution separately. A shared Agent has one judgment where the domain
counts Agents; an authenticated account is counted only where that domain chooses
private-account counting. Do not infer one account from one public Agent or merge
global and community-scoped judgments.

The common summary preserves positiveCount, negativeCount, score, voteCount,
viewerVote and asOf. `score = positiveCount - negativeCount` and
`voteCount = positiveCount + negativeCount`; stored exact aggregates protect
nonnegative totals, bounds and parity. An unavailable/stale summary is explicit;
it is not rounded into valid data. No generic `accepted` boolean is inferred from
a score. Invitations and publication acceptance retain their own state machines.

## Distinct authorities

| Target | Judgment meaning | Separate authority |
| --- | --- | --- |
| Name or alias candidate | Community preference/relevance under a declared voting scope | Name occurrence, spelling, language, source, officialness and accepted display/search selections. |
| External reference | Relevance or quality of the reference | Link identity, current availability/disclosure, evidence and curation. |
| Concept/Tag application | Scoped support, fit or spoiler judgment | Typed classification assertion and scope-specific adoption; factual classes do not require a majority vote. |
| Expression definition/application | Support for a governed conceptual expression | Structural validation, definition revision, source correlation and explicit eligibility; score cannot make an invalid definition executable. |
| Poll option | Poll-owned ballot and results policy | Poll membership/cardinality/visibility; not the shared binary tally. |
| Rating | Context-admitted observation and declared scale | Private counting identity, exact context/revision, aggregation and publication citation. |

Resource identity, capability admission and grants are never vote outcomes.
Explicit pins are curation, not additional positive votes. Wilson or another elected
ranking function orders eligible candidates with a stable tie-breaker; the model
must retain its version and expose the projection's freshness.

## Name/reference lists and pagination

Native NameRecord storage supports multiple same-language forms, many languages,
source histories and contextual names. There is no universal 128-name lifetime cap.
Product preview slots, per-command input and list response budgets are separate
from the number of valid stored names or references.

Use owner/scope/status/rank/occurrence indexes and bounded keyset pages. A ranking
change follows the declared live-keyset or generation-bound cursor policy; do not
fingerprint every name/vote in a large owner set for each page. Report continuation,
partial and stale states honestly. Current disclosure is checked after candidate
selection; a snapshot never freezes authorization.

Search consumes accepted named forms and any explicitly elected community-candidate
policy. It preserves matched spelling/language and does not equate votes with
officialness. Name or judgment changes update their affected entries incrementally
or enqueue bounded owner/entry work; no write enumerates every localization.

## Write, projection and hot-key behavior

Record each vote/change/retraction under its exact voter/scope key with CAS or
idempotency where applicable. Update the affected aggregate synchronously only
when measured cost and contention justify it; otherwise use the existing durable
outbox, idempotent reducers and explicit watermarks. One target's popularity must
not lock the Resource root or serialize unrelated names/relationships.

Derived tallies and rankings have one source and a rebuild protocol. Withdrawal
removes current eligibility without rewriting historical votes/evidence. Rebuilds
cannot resurrect withdrawn or undisclosed facts. Authority and irreducible
cardinality invariants remain synchronous command/database checks.

## Workload and capacity

Apply the 500M/3B-row baseline independently to votes, heads, names, links, evidence,
history and ranking projections. At illustrative combined heap/index widths of
144 bytes for a vote, 104 for a tally, 480 for a name and 770 for a reference, the
respective estimates are 72/432 GB, 52/312 GB, 240 GB/1.44 TB and 385 GB/2.31 TB.
These planning widths exclude WAL, replicas, free space, backups and variable text.

Actual workload must specify voter skew, high-degree targets, languages per owner,
revision/withdrawal rate, read/write mix, scan/page/byte limits and freshness budget.
Measure p95/p99, lock waits, WAL, index growth, maintenance and restore time. Use
owner-local access and separately indexed inverse/ranking paths inside one database.
Neither generated UUIDs nor hash partitioning alone prove uniqueness or eliminate
reverse-query fan-out.

The current bounded-reference implementation and its earlier fixture do not qualify
this unbounded-corpus/bounded-request target. See [implementation reference](../reference/current-implementation.md#measurements-and-reference-ranking)
and [fixture evidence](../testing/foundation.md#historical-reference-list-fixture).
The [1.4.0 cutover](../releases/1.4.0.md#vote-and-reference-cutover) remains a release
record. New layouts follow the owning forward migration/rebuild contract; online
dual-write is not required solely for old schema compatibility.

## Acceptance

Qualify two same-language names, a language outside the UI list, a high-degree
owner, independent global/community judgments, explicit classification acceptance,
stable pagination after changes, current disclosure, retraction, hot-target
backpressure and deterministic rebuild. Preserve exact tally invariants and verify
that projection lag does not turn into false truth or authorization.
