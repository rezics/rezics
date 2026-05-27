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

### Platforms And Age Ratings Are Entity-Backed

String keys are not enough for platforms or ratings because both need display
names, aliases, external refs, evidence, source-site mappings, and search
projection.

```txt
Entity(kind = game_platform)
  examples: Windows, Steam, Steam Deck, PlayStation 5, Nintendo Switch

SubjectAttribution(gameUnitId, platformEntityId, role = available_on)

Entity(kind = age_rating)
  examples: ESRB Teen, PEGI 12, CERO B, TV-14, R

SubjectAttribution(unitId, ageRatingEntityId, role = age_rating)
```

These relations are projected into search documents as Entity ids and resolved
display labels through normal Unit translation fallback.

Alternatives considered:

- **Keep `GamePlatform` and add a registry**: still produces a parallel mini
  identity system without translations, aliases, or external refs.
- **Use tags for platforms and ratings**: tags are classification vocabulary,
  but platform/rating records need source-specific identity and richer
  metadata. Entity-backed subject relations fit the existing attribution model.

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
  migration** → Mitigation: backfill string keys into Entities before dropping
  legacy columns/tables.
- **Risk: Episode/DLC structure is implemented as counts again** → Mitigation:
  specs require Units plus content structure for canonical part identity.
- **Risk: Hidden work Units accidentally receive public titles/pages** →
  Mitigation: inherit the `introduce-unit-work-domain` display policy and
  require release-context display for GAME/MEDIA.

## Migration Plan

1. Wait for `introduce-unit-work-domain` to land or implement this change on top
   of its `UnitWork`, `sourceUnitId`, `contentStructure`, and USWN contracts.
2. Add contract schemas for system requirements, platform/rating relation DTOs,
   and GAME/MEDIA library metadata.
3. Add `GameSystemRequirement` storage.
4. Seed or import initial platform and age-rating Entities.
5. Backfill `GamePlatform.platformKey` to platform Entities and
   `SubjectAttribution(role = available_on)`.
6. Backfill `Game.ageRatingKey` to age-rating Entities and
   `SubjectAttribution(role = age_rating)`.
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
- Should rating Entities store normalized minimum age/region metadata in
  `Entity.extra` or in a dedicated rating extension table?
