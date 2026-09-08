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

The existing report license-evidence hydration can still fan out over all active
licenses and invalidation history for each selected target. That path is not
capacity-qualified by the native owner migration; a separate paginated evidence
surface or an explicitly enforced domain bound is required before claiming
whole-report-path scalability. Evidence is not silently truncated here.
