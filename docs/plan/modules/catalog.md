# M04: provider-independent catalog

Dependencies: M01-M03 contracts. Owner: [catalog model](../../architecture/database/catalog-model.md) and dictionary D05-D07.

## Remaining work

- Qualify publishing, music, program, software, entity, grouping, reference and distribution objects without source records.
- Distinguish Work, expression, catalog publication, release, recording, manifestation, occurrence and hosted content; no mandatory universal Edition.
- Complete supporting source-required families, names/authority, identifiers, uncertain dates, scoped credits and language channels.
- Qualify Book text/publication/serialization, VN contribution contexts, music alternative/candidate/TOC structures, seasons/cuts/episodes and mixed bundles.
- Test repeated targets, incomplete contents, large staged structures, foreign-owner reuse and world/canon/series memberships.
- Build APIs and semantic exports after native tests; source adapters use the same commands.

## Acceptance

Each elected distinction has source-free create/read/update/withdraw/restore/export fixtures and cross-source cases where appropriate. Raw JSON-only retention is not native field coverage. Providers do not determine ownership or duplicate native identities because their schemas differ.
