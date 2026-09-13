# Collection read contracts

Stored Collection membership is independent of Realm publication and Zone page
placement. A Zone can present several Collections, and one Collection can appear
in several Zones. Changing one relationship preserves native articles and the
other relationships. This reader does not create Dynamic Collections.

A public membership page consumes at most `limit + 1` indexed memberships, with
`limit <= 100`, then hydrates currently readable content. A page can be empty and
still have a continuation when its consumed members are hidden. Clients must use
the continuation to distinguish that case from exhaustion.

## Confidential continuation

A consumed boundary can identify an unreadable member. `items-cursor.ts` therefore
uses a `ci2.` authenticated-encryption envelope, not exposed JSON. The envelope
contains a 16-byte random salt, a 12-byte random nonce, encrypted position/native-ID
fields and a 16-byte authentication tag. HKDF-SHA256 derives an independent AES-256
key for each salt from the existing server secret and a purpose-specific context.
AES-GCM authenticates the Collection, current membership revision, viewer/selected
participation authority and ordered localization languages as associated data.
The implementation follows the [Node crypto APIs](https://nodejs.org/api/crypto.html#class-cipheriv).

Authenticate before parsing. Malformed, changed, wrong-scope, oversized and old
plaintext cursors are rejected as `InvalidPaginationCursor`. The secret is never
returned; rotating it invalidates outstanding cursors. Cursor possession grants
no access. Host-specific selection/adoption contexts must extend the scope when
those contracts are introduced.

The transport ceiling remains 4,096 characters. A maximum 1,024-byte stored
fractional position fits that envelope. The ordinary fixture token is 152 bytes;
a Node/Bun interoperability check also exercises 10,000 round trips. Work and
memory are bounded by the token and associated-data sizes; there are no token
rows, nonce counters or per-member keys in the database.

## Reference predicates and query execution

`targetId` and `containsTargetId` are reference predicates, not permission bypasses.
Their at-most-two distinct native targets are read under ordered shared access
fences and native row locks. Current read decisions are checked before and after
the membership query, including expiry after a wait. Missing or unreadable targets
produce an empty result; invalid selected authority remains a typed failure.
An authorized curator can still query private targets.

Collection metadata and feed enrichment queries await each database operation.
A Zone aggregate supplies one transaction client; starting those operations in
parallel violates its executor contract and queues nested database work.

## Workload boundary

Keep the 500,000,000-row baseline and 3,000,000,000-row estimate for growing
Collection/member/history relations. This change adds no persisted rows or
indexes. Item reads keep their Collection/order keyset; discovery examines at
most 51 candidates and reference predicates add at most two native point reads
per decision pass. Token bytes are response traffic, independent of stored row
cardinality: 500M/3B responses at the fixture's 152 bytes would transfer about
76 GB/456 GB of cursor text, not allocate that storage in PostgreSQL.

These bounds do not qualify full Collection history/checkpoint costs, every
metadata count policy, adopted-revision disclosure, mixed workloads or sustained
throughput. Those remain under the community and operations acceptance gates.

## Current curation and history authority

Creation, item changes, metadata changes and restoration require the current
human account, active Self binding, verified email and account write eligibility.
History reads require the current account/Self but do not require email verification
or write eligibility. A ban cannot be bypassed through the session-only restoration
route. Time-dependent permissions and account write restrictions are checked again
after the callback and its waits, before committing.

`CollectionHistoryPermissions` is the shared policy behind both `canViewHistory`
and the history list/compare endpoints: current root edit, access-management or
history-restoration authority. Public Collection readability alone does not grant
access to curation history, whose snapshots may identify private members. Curators
retain history access without gaining access to members' private content. Existing
scope and actor requirements remain separate from credential/API permissions.

The order is Auth, Self, resource access fence and native Collection row, followed
by the existing history locks. Metadata changes take an exclusive access fence and
the status-transition lock before the row, preserving the lifecycle lock order.
Other mutations use a shared access fence and `FOR NO KEY UPDATE`; the latter
allows foreign-key key-share checks between distinct Collections. History readers
use a shared row lock. The [PostgreSQL lock modes](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)
define those compatibility guarantees. The native fixture includes reciprocal
Collection references and a status-lock holder to prevent regressions.

A status change still requires `unit.status.update` independently from ordinary
editing. Repeating the locked status does not manufacture a new permission
requirement. Mutation CAS and membership ordering retain their existing owners.
These constant-size parent authority checks add no persisted rows or indexes; long
history callbacks still extend lock lifetime and need the remaining capacity work.

Item additions check current readability of each distinct requested target and
implicit Review subject both before mutation and after membership, aggregate and
history writes. Expiry during those writes rejects the request and rolls back the
member, count and revision/head changes together. Moves and removals introduce no
new targets and do not add target-read checks.

For `B` addition commands, the final pass adds at most `2B` authorization decisions
and retains at most `2B` native IDs in memory. The 10,000-command API limit therefore
bounds each pass at 20,000 distinct targets; it does not establish acceptable
latency at that limit. No rows, indexes or corpus scans are added by this fix at
either the 500,000,000-row baseline or 3,000,000,000-row estimate. Sequential target
decisions and whole-Collection snapshot/history work remain capacity risks: qualify
batched current-authority evaluation, bounded history work, request deadlines and
hot-Collection contention before claiming scale acceptance.
