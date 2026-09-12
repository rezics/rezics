# Following

`unit_follow` records an Entity's interest in a target. Personal ordering, favorites
and delivery choices belong to its Auth account in `account_follow_preference`.
Following grants neither access nor membership; downstream delivery rules remain
independent. The command accepts the authenticated account, its Self Entity and
request authorization together, and rejects disagreement between those identities.

Every personal read or mutation locks the account and active Self binding and
compares the admitted authorization revision. Closed/suspended accounts and stale
Self authority cannot read or change private Following state. Creating a public
follow requires contribution eligibility. Settings, presentation and unfollow
require write eligibility: silence can block a new follow while allowing private
preference changes, whereas bans/suspensions block both mutation classes. Account
eligibility is checked again before a mutation finishes, so a scheduled restriction
that becomes active during a row wait causes rollback.

Target-dependent operations hold the shared resource fence before locking the
native target row. Read authorization uses the current transaction rather than a
cached pre-transaction decision. Follow and delivery-setting writes recheck target
read eligibility after their remaining work, including preference-row waits. A
grant that expires during the wait cannot authorize the finished mutation.
Unfollow and private presentation edits remain available for the account's own
choice when target access has disappeared, subject to current account eligibility.

Private lists retain a 512-choice scan budget, authorize targets in batches of at
most 500, and return at most 100 entries. A filtered page can be empty while its
cursor advances past the scanned choices. The native Self, account and target
lookups use their existing keys; this authority change adds no rows or indexes.
At the 500,000,000-row baseline and 3,000,000,000-row estimate, stored Follow and
preference cardinalities and index costs are unchanged. A point mutation adds
current account/target probes and one final account recheck; grant-dependent writes
add one final target recheck. For a rate W mutations/s, budget up to 2W target
admissions and 2W account-action checks in addition to the existing writes. For L
full list scans/s, target validation can cover up to 512L choices. These are work
bounds, not measured throughput. Hot accounts/targets, authorization fan-out,
contention and corpus-scale latency remain part of backend workload acceptance.

[Foundation verification](../../../../../docs/testing/foundation.md#following-current-authority)
records real PostgreSQL transitions, exact lock-wait cases, HTTP flows and the
private-lifecycle regression. No schema migration is needed for these authority
checks.
