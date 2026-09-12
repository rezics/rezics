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
