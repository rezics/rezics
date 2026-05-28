## Context

Rezics already has `Unit(type = GAME)` and `Unit(type = MEDIA)` plus shallow
`Game` and `Media` extension tables. The existing specs still describe
GAME/MEDIA work-release behavior through `Unit.workUnitId` and
`UnitTranslation.sourceReleaseUnitId`, and game-specific metadata uses
`GamePlatform(platformKey)` plus `Game.ageRatingKey`. Those choices conflict
with the newer `introduce-unit-work-domain` direction:

```txt
Visible user-facing content:
  release Unit

Hidden aggregation identity:
  work Unit through UnitWork(role = RELEASE)

Concrete part / episode / DLC / volume:
  Unit organized by contentStructure/contentUnitId
```

The target state is that books, games, and media all use the same work-release
foundation. A game may commonly have only one visible release, but it is still a
release-aware domain. Hidden work Units do not need public titles; display comes
from release context, primary release selection, aliases, or admin-only
maintenance metadata.

## Goals / Non-Goals

**Goals:**

- Make GAME and MEDIA real library content backends, not mock-like extension
  rows.
- Align GAME/MEDIA with `UnitWork`, `UnitTranslation.sourceUnitId`,
  content-structure terminology, and derived `metadata.uswn`.
- Replace string platform and age-rating keys with Entity-backed relationships.
- Store game system requirements in a dedicated backend model with structured
  hardware slugs and source-specific raw text.
- Treat episodes, seasons, DLC, expansions, volumes, and similar parts as Units
  organized by content structure.
- Provide contract, server, search, API-client, job-runner, and admin work
  required for production-ready GAME/MEDIA data.
- Leave frontend implementation narrow: data readiness and route/page direction
  only. Future pages should follow the current book detail pattern.

**Non-Goals:**

- Do not store system requirement raw text in `UnitTranslation.extra`.
- Do not make hidden work Units visible public GAME/MEDIA detail pages.
- Do not build importers for IGDB, Steam, TMDB, IMDb, or PCGamingWiki in this
  change; only make the backend model ready for source refs and later imports.

## Decisions

### GAME/MEDIA Are Always Release-Aware Library Domains

GAME and MEDIA use the same release-first model as books after
`introduce-unit-work-domain`.

```txt
Unit(type = GAME | MEDIA, visible release)
  └─ UnitWork(unitId = release, workUnitId = hidden work, role = RELEASE)
```

Even when a game has one practical release, the public object remains the
visible release. Hidden work Units provide grouping, inherited tags, shared
community content, and derived `metadata.uswn`.

Alternatives considered:

- **Keep standalone game/media entries outside work-release**: simpler for small
  games, but it creates a second content model and breaks grouping, search, and
  cross-release community semantics.
- **Expose work pages as canonical game/media pages**: rejected for the same
  reason as books. Users interact with concrete releases.

### Parts Are Units Organized By Content Structure

Episodes, seasons, DLC, expansions, volumes, bonus content, and similar parts
are Units. Their nesting and ordering belongs in `contentStructure`, with each
node pointing at a `contentUnitId`.

```txt
Game release
└─ contentStructure
   ├─ base campaign -> contentUnitId
   ├─ DLC           -> contentUnitId
   └─ expansion     -> contentUnitId

Media release
└─ contentStructure
   ├─ season 1      -> contentUnitId
   └─ episode 1     -> contentUnitId
```

`Media.episodeCount` and `Media.seasonCount` are not canonical structure. If
they remain temporarily, they are summary metadata only and must not be used as
the source of truth for episode/season identity.

### Platforms Are Entity-Backed

String keys are not enough for platforms because they need display names,
aliases, external refs, evidence, source-site mappings, and search projection.

```txt
Entity(kind = game_platform)
  examples: Windows, Steam, Steam Deck, PlayStation 5, Nintendo Switch

SubjectAttribution(gameUnitId, platformEntityId, role = available_on)
```

`game_platform` is added to the contract entity kind registry and `available_on`
is added to the subject role registry (kind hint: `game_platform`). These
relations are projected into search documents as Entity ids and resolved display
labels through normal Unit translation fallback.

Alternatives considered:

- **Keep `GamePlatform` and add a registry**: still produces a parallel mini
  identity system without translations, aliases, or external refs.
- **Use tags for platforms**: a platform record needs source-specific identity,
  aliases, and external refs, so an Entity-backed subject relation fits better
  than classification vocabulary.

### External Age Ratings Are Catalog Tags, Not Entities

External official age/content ratings (ESRB, PEGI, CERO, MPAA, TV Parental
Guidelines) are classification vocabulary, not identity-bearing subjects. They
carry no per-value aliases or external refs the way platforms do, and they must
not stand up a second rating system beside the existing `ContentRating` axis
(`Unit.rating`), which stays the internal maturity/discovery gate.

```txt
TAGS registry (board-prefixed flat slugs)
  esrb-teen, esrb-mature, pegi-12, pegi-18, cero-b, mpaa-r, tv-14, ...

UnitTag(unitId = release, tagUnitId = ratingTagUnit)

RATING_TAGS  // contract const enumerating the rating tag slugs as a class
```

`ContentRating` (`Unit.rating`) is the ordered internal gate; rating tags are
unordered external classifications for display and exact-match faceting. The two
axes are independent and SHALL NOT be conflated.

Alternatives considered:

- **`Entity(kind = age_rating)` + `SubjectAttribution(role = age_rating)`**:
  rejected. It builds a parallel rating system in the entity/subject layer next
  to `ContentRating`, and a board rating value carries no identity richer than a
  classification label.
- **Fold external ratings into `ContentRating`**: rejected. ESRB/PEGI do not map
  losslessly onto the four-tier internal gate; they are a different axis.

### Worldview Is An Entity Kind; Franchise Is A Series

A worldview / shared fictional universe (世界觀) is a taggable subject: a
standalone or non-series work can declare it is "set in" a universe without
being a counted member of any Series. It is added as `Entity(kind = "universe")`
and attached through the existing `setting` subject role.

```txt
Entity(kind = universe)
SubjectAttribution(unitId = work, entityId = universe, role = setting)
```

`universe` intentionally names the same concept as the Series `universe` kind at
a different structural layer: a Series `universe` is a curated, release-first
collection (with content structure and derived `UnitWork(role = SERIES)`), while
an Entity `universe` is a taggable subject usable on works that are not Series
members.

Franchise grouping is NOT given an Entity kind. A franchise is a brand / IP /
commercial grouping, which is exactly what `Series(kind = "franchise")` already
models; "belongs to a franchise" is the same assertion as "is a member of the
franchise Series," so it needs no separate in-fiction subject. Loose association
uses a non-counted Series structural node or the existing `organization` /
`studio` / `label` entities.

Alternatives considered:

- **Attribute worlds against `concept`/`location` Entities**: rejected;
  `concept`/`location` misrepresent a shared universe, so a dedicated `universe`
  kind is correct.
- **Add `Entity(kind = franchise)`**: rejected. It creates a third overlapping
  home (Series franchise + Entity franchise + org entity) for one fact.

### System Requirements Use A Dedicated Table

Game system requirements are not translation display metadata. They are
platform/tier/source-specific facts, often imported as raw source text while
also carrying structured hardware fields. Store them separately:

```txt
GameSystemRequirement
────────────────────────────────────────
id
gameUnitId
platformEntityId?
tier
language?
sourceRefId?
structured Json
rawText?
createdAt
updatedAt
```

`structured` is contract-validated JSON with fields such as CPU slug, GPU slug,
memory, VRAM, storage, OS text, graphics APIs, and optional raw component text.
Hardware slugs are language-neutral identifiers such as
`cpu:intel-core-i5-8400` or `gpu:nvidia-gtx-1060-6gb`.

`rawText` is preserved because sources such as Steam and PCGamingWiki often
publish human-authored requirements that cannot be losslessly parsed. If
multiple languages are available, separate rows carry separate `language`
values; the data does not use `UnitTranslation` fallback.

Alternatives considered:

- **Put requirements in `Game.extra`**: too opaque for validation, source
  evidence, edits, history, search projection, and per-tier updates.
- **Put text in `UnitTranslation.extra`**: rejected because requirements are not
  the Unit's localized display text and do not follow title/cover fallback.
- **Fully normalize CPU/GPU tables now**: premature. Slugs provide a stable seam
  for future hardware catalog integration without blocking this backend.

### Frontend Direction Mirrors Book Detail

Future GAME/MEDIA detail pages should use the same broad structure as the book
detail surface:

```txt
Hero
├─ cover/poster/key art
├─ title and release metadata
├─ primary actions
└─ domain media region

Tabs
├─ Overview
├─ Content / Episodes / DLC
├─ Releases
├─ Community / Reviews
└─ Metadata / Credits
```

The hero layout should stay close to the current book pattern. The book review
preview area can become a trailer carousel, screenshot carousel, clip carousel,
or other domain media component when available.

Domain media assets used by those future pages must not become raw URL columns
on `Game` or `Media`. They should be sourced from existing Unit/ContentDoc,
UnitExternalRef, attribution, or future typed media-asset contracts, and rendered
through existing Rezics carousel primitives in the app.

## Risks / Trade-offs

- **Risk: Entity-backed platforms feel heavier than string keys** → Mitigation:
  seed/import common platform Entities and provide compact picker/search APIs.
- **Risk: System requirement parsing is unreliable** → Mitigation: preserve
  raw source text and make structured fields partial and source-evidenced.
- **Risk: Existing game/media seed data loses platform/rating filters during
  migration** → Mitigation: backfill platform keys into Entities and rating keys
  into rating tags before dropping legacy columns/tables.
- **Risk: Episode/DLC structure is implemented as counts again** → Mitigation:
  specs require Units plus content structure for canonical part identity.
- **Risk: Hidden work Units accidentally receive public titles/pages** →
  Mitigation: inherit the `introduce-unit-work-domain` display policy and
  require release-context display for GAME/MEDIA.

## Migration Plan

1. Build on the landed `introduce-unit-work-domain` foundation (`UnitWork`,
   `sourceUnitId`, `contentStructure`, USWN). Land after
   `clarify-release-vs-work-list-scopes` so GAME/MEDIA list/search adopt its
   exact-vs-work-domain naming.
2. Add contract schemas for system requirements, platform relation DTOs,
   `RATING_TAGS`, and GAME/MEDIA library metadata; register `game_platform` /
   `universe` entity kinds and the `available_on` subject role.
3. Add `GameSystemRequirement` storage.
4. Seed initial platform Entities; seed external rating tags (`RATING_TAGS`) as
   TAG Units with multilingual labels.
5. Backfill `GamePlatform.platformKey` to platform Entities and
   `SubjectAttribution(role = available_on)`.
6. Backfill `Game.ageRatingKey` to the matching rating tag via `UnitTag`.
7. Update server mappers/services/APIs to read Entity-backed relations and
   system requirement rows.
8. Update search document builders and filterable attributes.
9. Rebuild GAME/MEDIA search documents and run drift checks.
10. Remove or quarantine legacy `GamePlatform` and `ageRatingKey` behavior.

Rollback strategy:

- Keep legacy string values available until Entity-backed backfill and search
  rebuild complete.
- If search projection fails, API reads can still hydrate platform/rating
  relations from PostgreSQL while Meilisearch filters are disabled.
- System requirements are additive and can be ignored by clients until stable.

## Open Questions

- Which hardware catalog source should seed the first CPU/GPU slug set?
- Should system requirements allow user-authored rows without a `sourceRefId`,
  or should public writes require source evidence?
- Resolved: external age ratings are catalog tags (not Entities); franchise
  grouping is `Series(kind = "franchise")` (not an Entity kind); worldview is
  `Entity(kind = "universe")` attached through the `setting` role.

## Contract Lock-in (resolved for implementation)

Reuses existing primitives — only one new table. See `implement_goal.md`
(Phase 2).

- **Entity kinds** — extend `entityKinds` in
  `package/contract/src/entity.ts:13` with `game_platform` and `universe`.
- **Subject roles** — extend `subjectAttributionRoles` in
  `package/contract/src/subject-attribution.roles.ts:3` with `available_on`.
- **`GameSystemRequirement`** — new Prisma model + contract: `gameUnitId`,
  optional `platformEntityId`, `tier` (`minimum` | `recommended`), optional
  `language`, optional `sourceRefId`, JSON hardware slugs
  (cpu/gpu/memory/vram/storage/os/graphicsApi), optional raw source text;
  indexes on `gameUnitId`, `platformEntityId`, `tier`, `sourceRefId`. This is the
  only new model — platforms reuse `Entity(game_platform)` +
  `SubjectAttribution(available_on)`, ratings reuse `UnitTag`.
- **Decision (recommended default):** public-authored system requirements
  REQUIRE a `sourceRefId` in v1 (evidence-backed); admin/authority writes may
  omit it. Confirm during apply.
- **Decision (recommended default):** keep `episodeCount`/`seasonCount` as
  optional read-only DTO fields once `ContentStructure` is canonical, marked
  derived; do not remove them in this change.
