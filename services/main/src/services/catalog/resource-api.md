# Native catalog HTTP boundary

The `/api/v1/catalog/resources` routes invoke native owner commands under the
request's current participation authority. Creation accepts sixteen explicit
variants: publishing Work, text version, publication, serialization; musical
work, recording, release group, release; software content, version, release;
program structure; Entity, Reference, Grouping and Distribution. Program structure
has its own program/season/version/episode discriminator. Creating a publication
does not create an invented Work. Creating a catalog Entity confers no account or
representation authority. Distribution creation leaves a draft composition.

Current routes provide creation, sanitized identity reads, revision-fenced
publication/visibility updates, and independent name/identifier create, revise
and page operations. Names retain language, derivation and revision metadata;
identifier normalization remains a claim and never merges identities. Private
Auth attribution and routing metadata are omitted from response contracts.
Domain structure editing, semantic relations, history/restore, source review and
retained product consumers require their own complete HTTP integrations; these
nine routes alone do not qualify that larger surface.

The request adapter restores participation inside the transaction rather than
passing a creator's Auth ID as implicit authority. Public reads use the actual
Auth account's content-rating preferences, independently of an acting
organization. Unauthenticated reads use project defaults. Catalog-linked reads
and indexed visibility predicates share that request policy. Selecting a valid
Entity-management grant does not prevent ordinary public reads and does not add
unrelated private catalog access.

Name and identifier pages read at most 101 indexed candidates. Filtering can
produce an empty page with a continuation cursor. JSON output stops at 2 MiB and
advances only over consumed candidates, so the first form that did not fit is
available on the next request. Form revisions use their own concurrency number;
adding a form uses the resource revision. Resource revision is not an HTTP cache
validator for all independently revised children.

## Verification and capacity boundary

`scripts/check-catalog-resource-api.ts` uses real signed Better Auth sessions and
the mounted Elysia request handler against an explicitly guarded loopback Atlas
database. Its 94 assertions create sixteen native resources and cover private
read denial, public publication, names and normalized ISBN claims, stale edits,
grant issuance by a recipient's public Entity ID, exact-target delegated editing,
revocation, and Auth preferences while acting as an organization. It commits only
dummy identities to the disposable target and removes their sessions. It does
not open a server port or perform browser/visual acceptance. The generated Fetch,
TanStack Query and public SDK TypeScript checks pass. Two pagination tests cover
escaped-byte limits and filtered-page continuation.

The capacity baseline remains 500M rows per growing owner family, with a 3B-row
estimate. These routes add no whole-corpus operation: identity reads are PK
lookups, form reads seek `(owner_id,id)`, and referenced scope/issuer visibility
uses concrete identity PKs for a bounded candidate page. Expected B-tree depth
is roughly 4–6 pages at those sizes depending on key width, fill and bloat; this
is a planning estimate, not a production latency measurement. There is no exact
total or offset pagination. Native revisions add their existing immutable history
and index writes; a request does not rewrite all names of an owner.

For planning, 500 reads/s with a typical 50-form page of 600 bytes/form implies
about 15 MB/s of response traffic. A fully occupied 2 MiB budget at that rate
would require about 1 GB/s before transport overhead and needs separate byte-rate
admission/network capacity. The bounded SQL prefetch can still materialize about
26 MiB of UTF-8 name/sort-name values at their individual maximum sizes; JavaScript
representation and serialization add memory overhead. Concurrency, pool limits,
large-form skew, WAL and cold-index p99 behavior require representative tests
before production activation. Sharding follows owner/native ID and keeps these
lookups and continuation keys local; a routing locator is never an FK parent.
