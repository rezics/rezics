# M04: provider-independent catalog

Dependencies: M01-M03 contracts. Owner: [catalog model](../../architecture/database/catalog-model.md) and dictionary D05-D07.

## Remaining work

- Qualify publishing, music, program, software, entity, grouping, reference and distribution objects without source records.
- Implement the [common native Work/release contract](../../architecture/database/native-work.md) across textual, composition/recording/album, audiovisual, visual, game/software and mixed-media scopes. Use domain-owned tables, shared protocols and applicable properties; qualify virtual and actual release forms without a universal Work parent.
- Qualify [WORK01-WORK18](../../testing/native-work.md) before treating Book-only cases or a provider model as evidence for the whole target.
- Support independently maintained anthology and split-book Works with explicit aggregation/part/coverage semantics; neither external identifiers nor membership determine one family-wide primary identity.
- Complete supporting source-required families, names/authority, identifiers, uncertain dates, scoped credits and language channels.
- Apply [event-time discovery](../../architecture/database/event-time.md) to native supporting events and domain release/broadcast occurrences; preserve exact keys, actual/planned/recorded distinctions, source decisions and named-topic bindings without duplicate event/date authorities. Qualify TIME01-TIME17 with M02/M09.
- Qualify Book text/publication/serialization, VN contribution contexts, music alternative/candidate/TOC structures, seasons/cuts/episodes and mixed bundles.
- Test repeated targets, incomplete contents, large staged structures, foreign-owner reuse and world/canon/series memberships.
- Replace publication/target-pair content keys with parent/manifest/occurrence keys and update histories, source correspondence, exact references and consumers together. Account for changed key widths and repeated-use amplification using the existing 500M/3B capacity model before persistence acceptance.
- Build APIs and semantic exports with their native commands; source adapters use the same commands. Author and execute their tests under the [execution workflow](../execution-workflow.md).

## Acceptance

Each elected distinction has source-free create/read/update/withdraw/restore/export fixtures and cross-source cases where appropriate. Raw JSON-only retention is not native field coverage. Providers do not determine ownership or duplicate native identities because their schemas differ.
