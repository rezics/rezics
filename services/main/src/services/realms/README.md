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
records the executable API and race cases. Native roster presentation/paging, broader ownership transitions, transitive
Realm access subjects and exact disclosure fences require remaining qualification.
