# Native merge qualification

Merge manifests read the native pair, participation/self bindings, existing
redirects and operation locks inside their transaction. Request snapshots batch
reviews, operations and rule references for the requested IDs. Queries sharing
that transaction client run sequentially; independent worker transactions may
still run concurrently.

The pair probes return at most two rows each. Request views retain two reviews,
one operation and at most 32 rule references per requested ID. Sequential execution retains those query/row bounds and adds no storage or indexes
at the 500M baseline or 3B estimate. It removes
concurrent-client queuing without replacing bounded batch reads with per-item
application queries. This is not sustained-load qualification.

The [public reference fixture](../../../../../../docs/testing/foundation.md#public-reviewed-merge-reference-fixture)
creates real accounts and native public Publishing identities, obtains two
independent reviews, claims its own operation and executes canonicalization.
The database validates the redirect's reviewed pair and archive revision.
All of this runs in a rollback fixture and must emit no concurrent-client warning.

The public fixture qualifies that canonicalization slice. The
[native merge fixture](../../../../../../docs/testing/foundation.md#native-merge-review-and-reconciliation)
separately qualifies private review admission and reconciliation. Application-time
reviewer fences, restart/recovery and large-scale workloads remain in the broader
program; creating a redirect does not prove those later phases.

## Private pair review

A platform review capability does not make private catalog identities readable.
A review may supply `readGrants.source` and `readGrants.target`, each containing
an exact grant ID and revision. The server binds each selection to the actual
human account's Self Entity and checks `catalog.read` against that side's native
reference before loading it. Wrong target/principal, stale revision, expiry or
revocation fails; `catalog.edit` may imply read under the shared policy. Each
selected grant is locked through the vote transaction. After manifest reads and
all grant waits, one current-statement deadline check covers both selections; a
source grant that expired while waiting on the target cannot admit the vote. Selections are recorded
in the review audit details, and do not alter the request's general authority.

These selections apply only to the read phase of review. They cannot authorize
merge writes or become the worker's execution authority. Public/creator reads
without a selection retain their ordinary policy. Reviewers remain distinct by
Auth account, independently of Entity/persona selection.

An archived merge source follows the canonical target's current audience under
`retainedAccess: target_readers`. Source-only creator or grant authority cannot
bypass that policy after canonicalization. Direct identity reads and SQL read
predicates use the same boundary. An ordinary, unmerged archive retains its
existing policy.

The review checks at most two selected grants with indexed account, Self, grant
and native-identity probes. An archived source adds a redirect lookup and target
read predicate; ordinary published rows avoid that redirect probe in list
predicates. Query latency and canonical-chain depth remain workload acceptance
items at 500M/3B; no new persistent indexes or table columns are added.

Reconciliation outcomes such as `binding_changed` are domain codes, not SQLSTATEs.
The database error classifier accepts only the five-character uppercase/digit
[SQLSTATE format](https://www.postgresql.org/docs/18/errcodes-appendix.html), while
still searching wrapped causes. A changed binding rolls back its attempted move
and records an actionable reconciliation item; it must not escape as a fatal
database error or silently count as completed work.

An independent source-binding correction may explicitly choose another current,
writable identity in manual mode. It still requires authority over the existing
binding and the new target, stays within its native owner and advances the binding
and policy revisions. Automatic/review-mode rebinding from a merged source stays
restricted to the canonical target; the archived source cannot be reactivated.
Merge reconciliation compares the captured revision. A correction committed before
inventory is absent from the source’s current projection and remains untouched.
A correction committed after inventory causes a revision conflict for operator
review. Retaining that correction records its exact current revision without moving
it back; retry cannot move a binding that no longer targets the source. Once the
items are resolved, the explicit operation retry resumes settlement/finalization.

## Qualification commands

Run `task services-main:db:merge:check` on a prepared disposable database with no
unfinished merge jobs. Completed history is allowed; the fixture creates new
identities, refuses to drain unrelated jobs and requires all admitted operations
to finish. It covers default copy/rebind choices, the alternate retain/pause plan,
more than 128 items, source binding drift after inventory, independent rebinding
before/after inventory, exact-revision human resolution and explicit operation retry.

`task services-main:db:private-merge-review:check` adds wrong target/principal,
incomplete, stale, revoked and expired read-grant cases, including expiry while
waiting on the other grant. It also compares point reads with SQL disclosure
predicates for retained sources. Its ordinary cases roll back; the separate
expiry-wait actors remain only in the disposable target.

## Worker recovery and executor authority

Every page calls the current platform admission check, including the account's
sign-in state, then locks and verifies its admitted human Self-binding revision.
The broader `unit.merge` capability implies proposal permission through the shared
vocabulary; it does not skip account admission. Suspension, closure, lost platform
permission and a changed Self binding stop the operation in `action_required`.
The graph locks and reconciliation receipts remain available for an explicit
operator retry with current authority. Account restrictions are not automatically
retried as transient database failures.

`task services-main:db:merge-recovery:check` verifies an actual fixture-owned
worker process killed after its structure-page writes but before transaction
commit. Uncommitted items, counters and cursors roll back. Reclaiming the expired
lease issues a new token; the old worker cannot advance it. Replaying a page whose
commit acknowledgement was lost adds no duplicate receipt, and finalization
releases its graph locks once. Suspension, closure and stale Self revisions are
also tested while the worker waits on the exact account/binding lock, followed by
restoration and explicit retry. See the [pinned recovery evidence](../../../../../../docs/testing/database/merge-recovery-evidence.json).

These checks use the existing one-account/one-Self indexed fences and four-operation
claim bound; they add no persisted rows or indexes beyond existing audit/state
transitions. The 500M/3B queue and receipt workload still requires corpus-scale
qualification. This fixture proves the structure-page crash and finalization
boundaries, not every phase, canonicalization failure point, reviewer application
fence or disaster-recovery restore.
