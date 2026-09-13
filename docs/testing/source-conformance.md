# Source converter conformance

Owner: M07. Native meaning is defined by [catalog architecture](../architecture/database/catalog-model.md), not by the union of providers. Converter tests target the intended model without preserving old wire/storage contracts.

Use [native Work/release acceptance](native-work.md) for all creative domains and
[composition acceptance](content-composition.md) for imported local uses. A
provider's musical Work, recording, film cut, software release or book edition
requires an explicit native scope mapping; preserving source distinctions does
not exempt that domain from the common Work contract.

## Required provider surfaces

| Provider | Native coverage and difficult cases |
| --- | --- |
| MusicBrainz | Work/recording/release group/release, media/tracks/credits, supporting entities, TOCs, labels/events, alternative presentations, incomplete candidates and redirects. |
| Cover Art Archive | Multiple artwork uses/types, main-front versus role, release origin for group representatives, representations/locations and source approval evidence. |
| VNDB | VN/content/releases, names/aliases, contribution contexts, character/voice roles, tags/traits/quotes, image/screenshot applicability, API/dump joins and complete aggregates. |
| Bangumi | Subject grain, names/descriptions, episodes, characters/people, multi-party voice relations, archive/API-only relationships, fixed profiles and elected infobox semantics. |
| Open Library and elected book sources | Explicit conceptual-work/text/ISBN-edition mappings to REZICS virtual Work evidence and external publications; contributors, translation/serialization, covers, series and native scenarios absent from one provider. |
| AO3-oriented creative input | Functional/content examples for native creation and export; elect acquisition/import formats explicitly rather than assuming a universal source API. |

The current [source artifact inventory](../../services/main/src/services/catalog/source-contracts/artifacts.json) and [field inventory](../../services/main/src/services/catalog/source-contracts/fields.jsonl) are inputs to reviewed mapping. Declaration counts, raw dumps and old reports are not evidence that every field is supported.

## Per-field disposition

Every elected source field/object records its pinned source contract, native meaning/key/context, owning command, read query, semantic export and fixture. Status is one of native-mapped, source-only evidence/statistic, intentionally excluded-private/operational, or unresolved. A raw-only value cannot claim native searchable coverage. Unsupported/ambiguous infobox labels remain explicit evidence until their meaning is defined.

Preserve source-specific vocabulary before applying standards normalization. Distinguish a source role from native authority, a source statistic from native votes, and source officialness from an evidenced issuing authority. Source user accounts, credentials and individual private activity are excluded from native account/participation creation.

## Stateful workflow

1. Load a small pinned original fixture, validate its actual source shape and record fieldset completeness.
2. Normalize through the provider adapter while retaining exact source references and unknown/absent/null/zero distinctions.
3. Convert to native commands; capture all newly produced identities/revisions.
4. Query through owning APIs and assert expected native objects, roles, context, version, media and evidence.
5. Export semantic data and compare required distinctions, not only row counts.
6. Repeat import, apply an update, withdraw, reapply and replay out of order.
7. Interleave independent source support, same-value human confirmation, rebind/pause, authority revocation and stale workers.

## Mandatory regressions

- Narrow API responses cannot erase fields from a complete dump; fieldset/surface precedence is explicit.
- Record-level and child-local identity survives reorder; reused/unstable source IDs do not alias new referents.
- Source redirects are not native merges; source bindings do not transfer permission or provenance.
- Source withdrawal retracts only owned support and cannot undo intervening human edits.
- Whole-record large applications stage bounded parts and dependencies; activation checks all epochs and complete correspondence.
- Missing relation parents, partial tracklists, unknown dates/languages and conflicting declarations survive export.
- Bangumi Infobox unions/nullability and fictional dates use reviewed native meanings, not arbitrary key renaming.
- VNDB dump tag/Wikidata joins and API/dump aggregate coverage are explicit, bounded and source-qualified.
- MusicBrainz secondary/alternative/candidate updates and media merge/split retain exact revisions and independent recordings/credits.
- Artwork removal, new encodings and changed remote locators preserve source/native selection boundaries.
- An upstream conceptual Work ID does not automatically create or merge a primary REZICS Work; retain reviewed correspondence, source-only and unresolved cases.
- Publisher ISBN/format/territory/language changes affect the mapped external publication, not the Work's identity or independently adopted community translations.
- Metadata-only sources do not manufacture identical-text assertions or dummy content; multiple same-language contributions and unknown correspondence survive roundtrip.
- Repeated book-content targets retain manifest-qualified occurrence identities through import/update/export; native virtual Work and multi-work text containers use explicit bibliographic export mappings.
- Observation alone does not advance a published native selection. Test native adoption and publication as separate transitions, including policy-authorized automatic proposals and revoked subscriptions.
- Source structure refresh preserves base/source/local correspondence and destination occurrence identity; source edits cannot silently replace local labels/order or published child versions.
- Repeat these flows for album tracks, audiovisual cuts/subtitles and game/software builds/localization, not only Book; community contributions and unrelated uses survive withdrawal.

## Data acquisition

Autonomously investigate primary schemas, official dumps, public APIs and native source code. Pin chosen artifacts, retrieval parameters, checksums, source contracts and normalization versions. Download and regenerate development/test data as needed under the plan's environment authorization. Public large datasets remain reproducible network inputs; deterministic CI uses committed compact fixtures. Record live-site failure separately from native deterministic behavior.

Primary source entry points: [MusicBrainz schema](https://musicbrainz.org/doc/MusicBrainz_Database/Schema), [CAA](https://musicbrainz.org/doc/Cover_Art_Archive/API), [VNDB Kana](https://api.vndb.org/kana), [Bangumi archive](https://github.com/bangumi/Archive), [Open Library](https://openlibrary.org/developers/api). These support source distinctions, not automatic acceptance of our converters.
