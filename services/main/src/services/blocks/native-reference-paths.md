# Native reference paths

Block reference resolution accepts at most 500 distinct identifiers per batch.
It resolves the requested locator keys, then groups concrete owner primary-key
reads, applies native catalog or platform read authority, and verifies locator
generation. Label and wiki-post references additionally require the concrete
Label or Post.wiki shape. There is no whole-owner or whole-corpus scan.

Each Dock owner has at most two configured slots: main, and Realm-only wiki.
All eight catalog owners support main. Catalog Dock mutations restore current
Participation authority, lock and compare the catalog owner's revision, append
one owner change, and also compare the Dock history base revision. Creation,
replacement, deletion, and restoration occur in one transaction. A competing
owner edit produces a conflict rather than overwriting its current revision.
The owner lock deliberately serializes edits of one hot catalog resource.
Platform Zone and Realm Docks retain their scoped platform authority.

Report target hydration is bounded by 100 requested reports or 101 platform-case
candidates, including the lookahead row. The latter candidate query is limited
before its correlated native state lookup. Native names use an indexed visible
name seek per owner and candidate, returning at most 500 characters each. A name
language is optional and is distinct from a consumption-language declaration.

At 500,000,000 and 3,000,000,000 owner rows, request memory and returned metadata
remain proportional to those batch bounds; B-tree seeks grow with index height.
No new corpus-scale tables or indexes are introduced by this consumer change.
For 500 references, two UUIDs plus one 64-bit locator generation require roughly
20 KB of raw key material before driver/object overhead. At 101 report targets,
500 four-byte Unicode characters per name bound name payloads to about 202 KB.
This is a request-work analysis, not a latency or throughput benchmark. Actual
read/write rates, hot-owner contention, index residency and storage throughput
require representative integrated measurements at the deployment target.

Report license evidence has a separate proven control bound. The typed LicenseIds
registry contains nine entries. The database CHECK uses that same registry, and
its existing partial UNIQUE (unit_id, license_id) for open offerings permits at
most nine active grants per resource. Thus 100 cases hydrate at most 900 grants,
regardless of total corpus size or repeated ended offerings. The existing partial
unique index avoids scanning ended offerings. Expanding the license registry
changes this bound and requires updating this workload analysis.

For each invalidated grant, the existing (license_grant_id, created_at DESC,
id DESC) index supplies exactly one latest action. Its kind and resulting
recognition are checked after LIMIT 1; inconsistent current evidence fails
closed. A resource with a billion historical recognition changes still contributes
one index seek per invalidated grant, rather than all its action rows. The list
therefore performs at most 900 bounded action lookups, with no extra table or
index write amplification. Its initial tiny-data fixtures do not establish
production latency or index-cache residency at either capacity baseline.
