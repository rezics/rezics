# Foundation Tags and EchoKV ID Registry — Design Plan

**Status**: Draft plan, pre-proposal  
**Date**: 2026-05-06  
**Scope**: Seeded i18n tag foundation, realm classification defaults, and EchoKV-provided tag ID maps for frontend/community bootstrapping

---

## 1. Context & Motivation

Rezics needs a stable set of foundation tags for books, games, excerpts, and community surfaces. These tags are not throwaway frontend constants. They are normal `Unit(type=TAG)` records and must be seeded before dependent community data is seeded.

The important distinction is:

- Tags are source-of-truth records in PostgreSQL, with slug, translations, support languages, visibility, and normal Unit lifecycle.
- EchoKV is useful for storing resolved ID collections where the frontend needs a ready-to-use map of tag IDs.
- EchoKV should not store infrastructure IDs that already have stable lookup semantics, such as a realm with a fixed slug.
- EchoKV should not store user-facing notification content as canonical content, because it lacks the right i18n/content model.

The concrete seed is `excerpt`: an `excerpt` realm can be resolved by slug, while the excerpt-related tag ID collection can be exposed through EchoKV because consumers need a ready map of IDs, not a single slug-resolved entity.

---

## 2. Core Principles

### 2.1 Tags are seeded first

Foundation tags SHALL be created as regular TAG Units before realm extras, realm tag contexts, EchoKV ID maps, or frontend defaults refer to them.

Each foundation tag needs:

- stable slug,
- i18n `UnitTranslation` rows,
- `UnitSupportLanguage` rows,
- public/published lifecycle state,
- deterministic idempotent seed behavior.

### 2.2 EchoKV stores ID collections, not identity truth

EchoKV may store resolved tag ID maps such as:

```json
{
  "genre": {
    "fantasy": "uuid",
    "sciFi": "uuid"
  },
  "status": {
    "completed": "uuid",
    "ongoing": "uuid"
  }
}
```

EchoKV SHOULD NOT become the authority for tag identity. If the EchoKV value is missing or stale, the database seed catalog and tag slugs remain the source of truth.

### 2.3 Realm slug resolves realm identity

Realms with stable slugs, such as `excerpt`, are resolved through Unit slug lookup. Their IDs should not be stored in EchoKV just to avoid a slug lookup.

### 2.4 Realm.extra.tagTree remains realm-local classification UX

`Realm.extra.tagTree` is the classification tree for content inside that realm. For the `excerpt` realm, most content is excerpt/quote-like content, so its tag tree naturally contains excerpt classification tags.

This does not require a separate abstract "taxonomy realm" model.

### 2.5 Keep the first implementation small

The seed catalog should be systematic, but not over-abstracted. Start with explicit domain catalogs and EchoKV maps. Add generic helpers only after repetition becomes real.

---

## 3. Proposed Data Flow

```text
contract seed catalog
  stable names, slugs, translation keys / default text
          │
          ▼
server seed
  create/update TAG Units with i18n
          │
          ├──────────────▶ Realm.extra.tagTree
          │                  realm-local classification UX
          │
          └──────────────▶ EchoKV
                             resolved tag ID maps for frontend use
```

Example for excerpt:

```text
seed TAG Units:
  excerpt.source.quote
  excerpt.source.passage
  excerpt.function.character
  excerpt.function.worldbuilding
  excerpt.craft.prose
  excerpt.safety.spoiler

resolve realm:
  Unit.slug = "excerpt"

write realm extra:
  excerpt Realm.extra.tagTree = grouped excerpt tags

write EchoKV:
  infra:tag_ids:excerpt = grouped tag id map
```

---

## 4. Foundation Tag Catalog Draft

This is a starting catalog for discussion, not a locked taxonomy.

### 4.1 Content Type Tags

Purpose: coarse content-type classification and high-level filters.

```text
contentType.book
contentType.game
contentType.media
contentType.post
contentType.link
contentType.excerpt
contentType.review
contentType.commentary
contentType.realm
```

Current seed already covers `book`, `game`, `media`, `post`, and `link`. This plan extends that set and clarifies naming.

### 4.2 Book Tags

Purpose: foundational book browsing, editing, and community classification.

```text
book.genre.fantasy
book.genre.sciFi
book.genre.romance
book.genre.mystery
book.genre.thriller
book.genre.horror
book.genre.historical
book.genre.literary
book.genre.nonfiction
book.genre.biography
book.genre.poetry
book.genre.children
book.genre.youngAdult

book.format.novel
book.format.novella
book.format.shortStory
book.format.anthology
book.format.webNovel
book.format.lightNovel
book.format.manga
book.format.comic
book.format.audiobook

book.status.completed
book.status.ongoing
book.status.hiatus
book.status.abandoned
book.status.translated
book.status.original

book.audience.beginnerFriendly
book.audience.advanced
book.audience.familyFriendly
book.audience.mature
book.audience.r18

book.structure.standalone
book.structure.series
book.structure.episodic
book.structure.shortForm
book.structure.longForm
```

EchoKV key:

```text
infra:tag_ids:book
```

### 4.3 Game Tags

Purpose: game discovery and community classification.

```text
game.genre.rpg
game.genre.strategy
game.genre.simulation
game.genre.adventure
game.genre.action
game.genre.puzzle
game.genre.visualNovel
game.genre.roguelike
game.genre.sandbox

game.mode.singlePlayer
game.mode.multiplayer
game.mode.coOp
game.mode.competitive

game.platform.pc
game.platform.mobile
game.platform.web
game.platform.console
game.platform.tabletop

game.community.modFriendly
game.community.speedrun
game.community.casual
game.community.hardcore
game.community.loreHeavy
```

EchoKV key:

```text
infra:tag_ids:game
```

### 4.4 Excerpt Tags

Purpose: excerpt editor quick picks, excerpt realm classification, and excerpt search/filter UX.

```text
excerpt.source.quote
excerpt.source.passage
excerpt.source.dialogue
excerpt.source.monologue
excerpt.source.narration

excerpt.function.character
excerpt.function.worldbuilding
excerpt.function.plot
excerpt.function.theme
excerpt.function.style
excerpt.function.humor
excerpt.function.foreshadowing
excerpt.function.conflict
excerpt.function.emotion

excerpt.craft.prose
excerpt.craft.pacing
excerpt.craft.imagery
excerpt.craft.metaphor
excerpt.craft.voice
excerpt.craft.structure

excerpt.safety.spoiler
excerpt.safety.nsfw
excerpt.safety.sensitive
```

EchoKV key:

```text
infra:tag_ids:excerpt
```

The `excerpt` realm itself should be resolved by slug, not EchoKV. Its `Realm.extra.tagTree` should use these tag IDs after seed resolution.

### 4.5 Community Tags

Purpose: baseline classification for community posts and moderation surfaces.

```text
community.post.announcement
community.post.discussion
community.post.question
community.post.recommendation
community.post.guide
community.post.changelog
community.post.event
community.post.help

community.moderation.pinned
community.moderation.official
community.moderation.featured
community.moderation.archived
community.moderation.needsReview
community.moderation.hidden

community.participation.beginnerQuestion
community.participation.lookingForFeedback
community.participation.resource
community.participation.showcase
```

EchoKV key:

```text
infra:tag_ids:community
```

---

## 5. EchoKV Shape

Use one EchoKV key per domain. This avoids a single giant registry while keeping each consumer to one fetch.

Recommended keys:

```text
infra:tag_ids:content_type
infra:tag_ids:book
infra:tag_ids:game
infra:tag_ids:excerpt
infra:tag_ids:community
```

Recommended value shape:

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-05-06T00:00:00.000Z",
  "groups": {
    "genre": {
      "fantasy": "uuid",
      "sciFi": "uuid"
    }
  }
}
```

Notes:

- `schemaVersion` lets frontend caches reject incompatible shapes.
- `updatedAt` is operational metadata, not user-facing content.
- `groups` keeps semantic structure while storing only IDs as data payload.
- Display text still comes from TAG Unit translations, not EchoKV.

---

## 6. Community Baseline Content

Beyond tags, constructing a usable community requires a small amount of seeded content. These records should be seeded through existing Unit/Post/Realm models, not encoded as EchoKV content.

### 6.1 Realm baseline

For official or default realms:

- `Realm` Unit with stable slug.
- `Realm.extra.rule` Post Unit.
- `Realm.extra.about` Post Unit.
- optional `Realm.extra.pinboard`.
- optional `Realm.extra.banner`.
- `Realm.extra.tagTree` using seeded tag IDs.
- owner/admin `RealmMember` rows.

### 6.2 Excerpt realm baseline

For `excerpt`:

- `Unit(type=REALM, slug="excerpt")`.
- rule/about posts explaining excerpt contribution norms.
- `Realm.extra.tagTree` using excerpt tag IDs.
- EchoKV `infra:tag_ids:excerpt`.

### 6.3 Book and game community baselines

Book and game realms can follow later, using:

- realm slug lookup for identity,
- domain-specific `Realm.extra.tagTree`,
- EchoKV tag id maps for editor/search defaults.

---

## 7. Open Questions

1. Should foundation tag slugs use dotted names exactly, such as `book.genre.fantasy`, or URL-style names, such as `book-genre-fantasy`?
2. Which languages must be present in the initial i18n seed: current `DEFAULT_LANGUAGE` + `FALLBACK_LANGUAGE`, or the full supported language list?
3. Should content-type tags keep the existing short slugs (`book`, `game`) for backward compatibility, while new domain tags use namespaced slugs?
4. Should EchoKV maps include only leaf IDs, or should they include group labels as keys with empty objects to preserve UI grouping?
5. Should `Realm.extra.tagTree` store `tagId` only, or should the existing inconsistent `tagUnitId/title` seed shape be migrated to contract-compliant `tagId/label`?
6. Should the seed expose a typed API wrapper for these EchoKV keys, or should frontend consumers call the generic EchoKV query directly?

---

## 8. Suggested Proposal Scope

When this plan becomes an OpenSpec change, a focused proposal could include:

- Define the canonical foundation tag catalog in `@rezics/contract`.
- Extend server seed to create all foundation tags with i18n.
- Write domain EchoKV tag ID maps after tag seed resolution.
- Seed an `excerpt` realm and its `Realm.extra.tagTree`.
- Add tests proving seed idempotency and EchoKV map correctness.
- Add a frontend API helper for reading typed tag ID maps.
- Update excerpt editor quick-pick behavior to consume `infra:tag_ids:excerpt`.

Keep out of scope for the first change:

- Full frontend redesign.
- Replacing EchoKV generally.
- General taxonomy framework abstraction.
- Complex tag governance or moderation workflows.

---

## 9. Initial Task Breakdown

```text
1. Catalog
   define foundation tag names, slugs, groups, and default translations

2. Seed
   create/update TAG Units with translations and support languages

3. EchoKV
   write grouped id maps under infra:tag_ids:<domain>

4. Realm defaults
   seed excerpt realm by slug
   write Realm.extra.tagTree from seeded excerpt tag IDs

5. API/client
   add typed EchoKV read helper or typed wrapper around generic EchoKV

6. Verification
   test idempotent seed
   test all EchoKV IDs refer to TAG Units
   test excerpt Realm.extra.tagTree uses valid TAG ids
```

