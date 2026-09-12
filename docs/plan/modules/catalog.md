# M04: provider-independent catalog

Dependencies: M01-M03 contracts. Owner: [catalog model](../../architecture/database/catalog-model.md) and dictionary D05-D07.

## Remaining work

- Qualify publishing, music, program, software, entity, grouping, reference and distribution objects without source records.
- Implement the catalog model's REZICS Work as the primary virtual publication, including metadata-only creation without an ISBN, external edition or abstract Work parent. Keep contributed text identities, publisher editions/events, musical compositions, occurrences and hosted content distinct.
- Support independently maintained anthology and split-book Works with explicit aggregation/part/coverage semantics; neither external identifiers nor membership determine one family-wide primary identity.
- Complete supporting source-required families, names/authority, identifiers, uncertain dates, scoped credits and language channels.
- Qualify Book text/publication/serialization, VN contribution contexts, music alternative/candidate/TOC structures, seasons/cuts/episodes and mixed bundles.
- Test repeated targets, incomplete contents, large staged structures, foreign-owner reuse and world/canon/series memberships.
- Replace publication/target-pair content keys with parent/manifest/occurrence keys and update histories, source correspondence, exact references and consumers together. Account for changed key widths and repeated-use amplification using the existing 500M/3B capacity model before persistence acceptance.
- Build APIs and semantic exports after native tests; source adapters use the same commands.

## Acceptance

Each elected distinction has source-free create/read/update/withdraw/restore/export fixtures and cross-source cases where appropriate. Raw JSON-only retention is not native field coverage. Providers do not determine ownership or duplicate native identities because their schemas differ.
