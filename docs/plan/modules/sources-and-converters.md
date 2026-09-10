# M07: source converters and native conformance

Dependencies: M01-M04 native contracts. Owners: [source conformance](../../testing/source-conformance.md), [source lifecycle](../../architecture/catalog-source-lifecycle.md) and the catalog source inventory.

## Remaining work

- Complete MusicBrainz, Cover Art Archive, VNDB, Bangumi and elected book/Open Library converters; treat archive/dump/API/media surfaces separately.
- Link source contract -> native meaning -> command -> query -> export -> fixture. Distinguish native, source-only, excluded-private and unresolved dispositions.
- Complete field journals, same-value human takeover, API/dump composition, redirects, child correspondence and ordinary large staged applications.
- Close Bangumi fixed/infobox/API semantics, VNDB dump joins/aggregates, MusicBrainz secondary/candidate/alternative structures and artwork mappings.
- Build reproducible acquisition manifests and small committed fixtures; stream large data with checksums, bounded joins and resumable stages.
- Run cross-source/human update/withdraw/reapply through the same native commands used for source-free authoring.

## Acceptance

Row counts are insufficient. Prove semantic preservation, idempotency, missing-data handling, authority and provenance. Upstream users/votes never become native accounts/ballots. Redirects cannot silently merge identities. Captured fixtures run offline; live drift checks remain separate from deterministic CI.
