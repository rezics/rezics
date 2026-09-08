# VNDB's observed anime mirror

The source family is `vndb.anime`, using the AniDB integer ID as its external
key. It is an observed VNDB public-dump mirror, not evidence that REZICS fetched
AniDB. The pinned `sql/schema.sql`, `lib/VNDB/Types.pm` and
[`lib/VNTask/AniDB.pm`](https://code.blicky.net/yorhel/vndb/src/commit/514f2391cc12aa94ce420354863c52538641d9b1/lib/VNTask/AniDB.pm)
define the row and its derived fields.

Anime rows materialize an actual native Program with `typeRevisionId` pointing
to a governed provider-independent program-type vocabulary. TV series, original
video animation, film, other program, web program, television special and music
video remain distinct. Declared episode counts are unobserved by this mirror and
remain neutral in its pure source interpretation; human counts are preserved.
The source year is a separately evidenced program-start-year fact, retaining
year precision and explicit unknowns. It does not fabricate a full date.

The importer misleadingly names its main-title field `title_romaji`: the upstream
code actually takes AniDB's main title without checking its language. REZICS keeps
that named form at unknown language/origin. `title_kanji` comes from the Japanese
title selection and is a separate Japanese named form. Their strings alone never
prove a transliteration relation. Missing titles remain absent; no placeholder is
written into the native catalog.

AniDB, ANN and MAL identifiers are separately versioned, source-supported claims.
Normalized duplicate IDs in one source array share the first observed occurrence;
they do not cause native identity merges. Updates and withdrawals use the generic
source identifier delta and retain unrelated human claims. An unknown mirror field
is still explicit source state under the reviewed snapshot; it is not an automatic
deletion, redirect or verified bibliographic truth.

`vn_anime` becomes a directed lookup from the VN to a related Program, without
asserting which work adapted which. Referenced Programs are initialized through
the canonical native structure writer before their source-reference baseline is
sealed. Later anime-row adoption completes that same Program. It does not create a
second native object because detailed metadata arrived after its reference.

`adoptVndbAnime` and `createVndbAnimeNativeWriter` are the initializer and exact
native callback for the `vndb.anime.1` mapper. The callback handles type, names,
identifiers and year through canonical native writers and the source application
journal. Compensation restores exact component histories and rejects a later edit
to the same fixed structure. The callback cannot use a rebind's new-target authority
to mutate its old target. The normal VNDB API has no corresponding endpoint: bulk
public-dump acquisition and central runtime registration must select this family.

## Workload and qualification

One anime row is bounded by the ordinary 8 MB archive limit, two optional names,
at most 64 ANN and 64 MAL IDs, one fixed Program component and one year fact.
The generic identifier delta and whole native application retain their existing
128-entry/change admission bounds; larger identifier sets require staged work.
VN relation packets admit at most 4,096 anime references before ordinary native
change admission. Native/source work remains proportional to one admitted packet.
The 500M/3B structural source, named-form, identifier and semantic-history budgets
apply independently; `structure-source.md` records storage, lock and sharding
assumptions. This does not qualify full-dump streaming or production throughput.

Deterministic plan tests cover type meanings, source title semantics, exact ID
paths and direction-neutral VN relationships. `check-catalog-structure-source.ts`
qualifies native Program and Publishing field updates, pure values, baselines,
three compensation cycles and stale-child rejection. `check-vndb-anime-source.ts`
qualifies VN reference completion, actual native anime updates, three compensation
cycles, source identifiers/year/names and preserved human metadata. These SQL
fixtures require the centrally generated structural-source schema before execution;
no SQL qualification is claimed by the parser tests alone.
