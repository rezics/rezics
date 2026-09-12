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

## Canonical targets

A public Follow stores one restrictive `target_reference_id`. Its private
preference references the same `(follower_entity_id, target_reference_id)` pair;
that composite FK prevents a preference without the corresponding public fact.
Neither relation stores a second native target UUID. Commands and responses use
native Unit IDs, resolving the immutable reference inside the current authorized
transaction. Removal and inspection do not allocate missing references.

Reference UUIDs form a separate namespace. The self-follow backstop compares the
reference's concrete native target with the follower Entity, so equal surrogate
and Entity UUID bytes are not mistaken for self-follow. New follows cannot target
a merged source; previously recorded references remain original. Unfollow removes
the preference through its parent FK and retains shared reference values.

The counter trigger derives its native target and concrete FK alternative from
the reference. It does not skip increments/decrements merely because routing is
fenced for repair. The native follower-count projection remains rebuildable from
public Follow facts. Private account erasure removes preferences without deleting
other accounts' choices or shared reference anchors.

Private cursors use version 4 and order by favorite, position and reference UUID,
matching the account-leading index. Descending favorite order explicitly uses
NULLS LAST, matching the physical index and avoiding a sort of the candidate range. Returned items retain native IDs. The cursor
encoder selects only its declared fields, including when a filtered scan supplies
an internal candidate with additional metadata. Official defaults, Realm producers,
feed preference and followed-Tag selection use the same canonical target mapping.
Each existing native-ID Follow predicate adds one indexed bridge lookup; feed
Realm preference already caps its candidate Realms at 32, so this adds at most 32
bridge probes per admitted feed candidate. Scalar native-ID lookup uses the
reference bridge's expression index and fails
closed on a conflicting multi-owner result instead of picking an arbitrary row.

At the 500M/3B planning scales, assume one private preference per public Follow.
Reserve 96 heap plus 144 index bytes for a Follow, and 160 heap plus 352 index bytes
for its preference: 376 GB/2.256 TB for the pair populations before WAL, replicas,
bloat and maintenance copies. The preference estimate allows ordinary position
length and page headroom; near-maximum 512-byte positions require a larger envelope.
A 10% distinct lifetime target fraction adds 16.4 GB/98.4 GB for the foundation's
328-byte shared-reference allowance, giving 392.4 GB/2.3544 TB in this standalone
scenario. Charge shared references once across consumers, including references
retained after choice removal. The shared bridge also retains its independent
500M/3B planning envelope of 164 GB/984 GB; the 10% fraction attributes incremental
consumer growth rather than replacing that global allowance. Public follows without private preferences reduce
the latter population; the native counter projection is additional distinct-target
storage and is not included in these pair estimates.

Each new pair maintains two public Follow indexes and four preference indexes,
including the enabled-delivery partial index. First target use also allocates a
shared reference. Private keyset pages retain their 512-choice budget; followed-Tag
selection retains its separate 1,000-result cap, whose scan cost still depends on
owner/filter distribution. Representative multi-owner skew, hot counters, allocator
contention, WAL, erasure and maintenance load remain required for capacity
acceptance. The local reference fixture supplies point/keyset plans and a 10,000-pair
sample, not a 500M/3B throughput certification.
