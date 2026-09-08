# Software and Program HTTP contracts

The catalog software and program plugins expose their existing canonical owner
commands. Generic resource creation, lifecycle, names and identifiers remain in
the catalog resource API. Software endpoints cover fixed details/history/restore,
release components including animation, correlated release discovery, participation
contexts and exact staff/voice credit revisions. Program endpoints cover all four
fixed structures, ordered episode occurrences and exact component history/restore.

Mutations retain owner revision checks and independent component revision/history
checks. Program histories are ordered by component sequence. Historical references
to now-private Programs/episodes are filtered before pagination and cannot be used
to restore an inaccessible snapshot. Public DTOs omit raw identity/Auth attribution.
Source absence or ownership does not become an implicit grant.

Pages admit at most 100 rows and 2,000,000 serialized bytes. Scope-bound cursors
include the native owner/collection and reject cross-collection use. Native
current/history lookup uses indexed owner/key predicates; release component head
lookups are one bounded lateral seek per admitted key in a single SQL request,
not a scan of component lifetime. Multi-query current projections hold a shared
owner snapshot lock so values cannot pair with another mutation's revision.
Existing 500M/3B software/structure storage and shard plans apply; HTTP fixtures
do not establish production throughput or browser acceptance.

`check-catalog-domain-api.ts` passed 134 assertions through real Elysia request
validation, session cookies and PostgreSQL on the isolated Atlas target. It checks
anonymous/other-account denial, stale owner/child edits, software details and
component restoration, animation, version/release discovery, contexts/credits,
Program structures/occurrences, malformed/cross-scope cursors, and historical
foreign-episode privacy. Fixture resources remain only in that disposable target;
fixture sessions are removed. Two focused wire-pagination tests cover byte-budget
continuation and cursor validation. Backend and script TypeScript checks passed.
