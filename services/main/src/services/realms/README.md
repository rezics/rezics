# Realm membership

Realm membership uses the authenticated account's current Self Entity. Selecting
an organization as an acting identity does not enroll that organization or confer
its control permissions. Realm grouping/governance and the Collection/Zone subsite
composition retain their [separate responsibilities](../../../../../docs/architecture/realm-collection-zone.md).

`joinRealm` owns admission in the write transaction. It takes the shared current
Realm-rule/history fence before account and membership checks. Rule publication
and Realm history commit take the matching exclusive fence, following the
[transaction advisory-lock contract](https://www.postgresql.org/docs/18/explicit-locking.html#ADVISORY-LOCKS). Policy is read in a
current statement after admission to that fence. The command locks and rechecks
account contribution eligibility, sign-in state and the captured Self binding
revision. A key-share lock preserves the concrete Realm identity; an existing
membership row is locked for update before its state is used.

A join requires a published, approved, non-deleted Realm and the existing private
Realm join policy. New open joins become active; new approval joins become pending.
Already active members stay active if the Realm later requires approval. Muted
members cannot remove their mute by joining again. Banned and removed members
cannot rejoin themselves. An unchanged membership is not rewritten.

When no membership row was visible, another transaction may still win its unique
key before insertion. The conflict action preserves an existing active/muted
state and refuses banned/removed rows. A rejected admission writes no follow or
rule acceptance. This uses PostgreSQL's conflict-update predicate and its
[returning behavior](https://www.postgresql.org/docs/18/sql-insert.html#SQL-ON-CONFLICT):
a conflicting row that fails the predicate is locked but not returned.
The command records one follow and, for implicit-on-follow
rules, the current acceptance in the same transaction. Explicit required consent
must name the current rule revision. No external delivery occurs as part of joining.

Departure and moderator commands also recheck the account and Self binding in
their transaction. Departure takes the resource-access fence before checking
ownership; an owner cannot leave. Active/pending membership is removed, while
muted/banned/removed rows remain as moderation evidence. Follows and rule
acknowledgements are removed in either case. Leaving and rejoining cannot erase
a moderator's restriction.

Member updates recheck `realm.members.manage` in the write transaction, including
the resource fence that conflicts with grant revocation and ownership changes.
The target membership is locked before the owner check and update. An owner
cannot be made inactive. The state, eligible internal notification and Realm-scoped audit
record commit together; an earlier cached capability result cannot admit the write.

The active-member aggregate decrements an existing counter with `UPDATE`.
A negative `INSERT` value is invalid before `ON CONFLICT` can apply its update.
Decrements with a missing counter and underflow fail instead of clamping or recreating
a plausible count; parent-Realm deletion may remove the aggregate through its FK cascade.
The native projection fixture checks activation, muting, deletion, relocation,
missing/underflow rejection and parent deletion.

## Roster reads

Roster reads recheck the account, captured Self revision and `realm.members.read`
in their transaction. They hydrate public native Entity names and avatars in a
bounded batch. A private Auth name is never a roster label. Missing or non-public
Entity presentation yields null name, language, avatar and address; the authorized
Realm membership reference remains visible. Presentation languages retain native
BCP 47 tags instead of being forced into the authoring-language enum. Canonical
address projection uses the caller's transaction.

The live cursor is the last consumed `profileId`, supplied as `afterProfileId` on
the next request. Members are ordered by immutable profile UUID. Output is capped
at 100. Without a state filter, candidate work is the requested limit plus one;
with a state filter, at most 512 candidates plus one lookahead are read before
filtering. An empty filtered page can therefore carry `nextCursor`; only null
means exhaustion. This is live keyset traversal, not a frozen historical roster.
Only returned members are hydrated. No whole-roster sort or count is needed.

## Workload and qualification

Retain the 500,000,000-row baseline and 3,000,000,000-row estimate for potentially
large membership relations. Admission uses account/Self/Realm primary keys, one
Realm/member primary key, the latest-rule index and at most one exact acceptance
key. It does not scan a roster or copy membership history. The change adds no
storage or indexes; it removes unnecessary rewrites for repeated active/muted
joins. Existing follow and aggregate writes remain part of the cost.

Use 100 joins/changes per second normally and 2,000 globally at peak, spread
across Realms, with a 200 ms p95 admission target excluding transport. These are
planning assumptions. A new join uses at most 12 application SQL statements plus
existing trigger work: budget up to 24,000 application statements/s at peak.
Join request memory is constant in roster size; join responses contain only membership state.
Departure still deletes the account's acknowledgements across that Realm's rule
history. This owner-indexed cleanup needs a bounded withdrawal/erasure protocol
before scale acceptance; its cost is not covered by the join statement budget.
The unchanged membership tuple and three indexes are budgeted at roughly 256-320
bytes per row including page headroom: 128-160 GB at 500M or 768-960 GB at 3B,
before WAL, replication and maintenance copies. These are estimates to qualify
against representative data, not storage measurements from this fixture.

The shared Realm fence permits independent admission checks while publication
waits for admitted joins. Same-member changes and aggregate counter updates can
still contend. Sustained admission above the 200 ms p95 target requires reviewing
contention on the counter row and account enforcement history. A hot-Realm growth path
is a bounded striped member counter with an explicit read/repair contract; roster
storage can route by Realm while account-facing lookup needs its own maintained
projection. Qualify their FK, cutover and reconciliation behavior before use.
Measure fence hold/wait time and hot-Realm write latency under sustained load; local two-connection checks do not establish 500M/3B throughput.
[Foundation verification](../../../../../docs/testing/foundation.md#realm-membership-admission)
records the executable API and race cases. Broader ownership transitions,
transitive Realm access subjects and exact disclosure fences require remaining qualification.

Roster candidate extraction is O(log N + K) on the Realm/member primary key, with
K at most 513; PostgreSQL may choose the narrower profile index when a Realm
dominates the relation. Monitor actual buffers and filtered rows under skew. At
5,000 roster pages/s, budget up to 505,000 candidates/s without state filtering
or 2,565,000/s for sparse filters, plus at most 500,000 public Entity summaries/s.
These are upper-bound planning rates, not measured throughput. Random heap access
can touch one page per candidate; low-latency reads at that extreme require
Realm-local storage/cache locality or a qualified covering projection. The
100 ms p95 read target remains a load gate. No new indexes or stored rows are
required by this change at the 500M/3B scales. Bounded candidate metadata and
at most 100 names/avatars keep application memory independent of roster size;
long authority histories and address ancestry retain their separate owner budgets.
