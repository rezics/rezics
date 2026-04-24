## Why

Global site announcements are currently stored as JSON blobs in `EchoKV` under the key `home_notice`. This mechanism has no first-class i18n support (content is a single string, not language-resolved), no content lifecycle (no publish/unpublish, no soft-delete), no author attribution, and lives outside the regular content graph. As we push for full platform i18n and move the default realm toward being the canonical home for global content, announcements need to become real, translated `Post` content.

At the same time, realms have no way to pin content to the top of their feed — a basic curation primitive expected on any community-style product.

Both needs share a single underlying shape: an ordered list of `Post` unit IDs attached to a realm, with i18n-aware read and compose-aware write. A single generic capability, **pinboard**, serves both. The `default-realm`'s `announcement` pinboard replaces `home_notice`; any realm's `pinned` pinboard powers realm feed pinning.

## What Changes

- **Add** a `pinboard` capability that manages one or more named, ordered `Post` unit-id lists stored under `Realm.extra.<pinboardKey>PostIds`.
  - Pinboard keys are a whitelist; first release supports `"announcement"` and `"pinned"`.
  - Provides composite content creation/update/delete with dual-track i18n (UnitTranslation for list-level fields; TranslationGroup for per-language body).
  - Provides atomic pin / unpin / reorder operations with `UPDATE ... FOR UPDATE` serialization (TODO marker left for future optimistic locking).
  - Provides i18n-aware list + detail reads (language-resolved `UnitTranslation` + sibling supportedLanguages from `TranslationGroup`).
  - Read-time filter of stale `postId`s (missing / soft-deleted).
- **Type** `Realm.extra` in the contract layer as `{ announcementPostIds?: string[]; pinnedPostIds?: string[]; filterTagIds?: string[] }`. The `filterTagIds` field is reserved for a future change; this proposal adds the shape but no write endpoints.
- **BREAKING** Replace the EchoKV-backed homepage announcement source with `default-realm`'s `announcement` pinboard. Remove `home_notice` consumption from `AnnouncementBarSection` and `NoticeBoard`. Remove the `home_notice` seed fixture. EchoKV itself remains in place (still used by `home_carousel` and admin tooling).
- **Drop** the three-way tag chip (`公告 / 活动 / 更新`) on announcement UI. First release shows announcements without subtype tags. Subtype tagging may return later via the general tag system.
- **Add** a polished admin UX for creating, editing, pinning, reordering, and soft-deleting pinboard content, reachable from each realm's manage page. The `default-realm` manage page is the canonical entry for global announcements.
- **Add** a homepage announcement reader that consumes the new pinboard API in the user's current language, with proper fallback to the platform default language.

## Capabilities

### New Capabilities

- `realm-pinboard`: Realm-scoped, named, ordered lists of multilingual `Post` content, with composite create/update/delete and i18n-aware reads. Includes API shape, permission model, pinboard-key whitelist, and frontend admin UX.

### Modified Capabilities

- `homepage-ecosystem`: "Announcements section" requirement changes source from EchoKV to `default-realm`'s `announcement` pinboard, with language-resolved content.
- `typed-json-fields`: Remove `Realm.extra` from the `t.Optional(t.Any())` list. Replace with a typed contract describing the three recognized fields.
- `type-extension-realm`: Document the meaning and invariants of `Realm.extra.announcementPostIds` and `Realm.extra.pinnedPostIds` (ordered arrays, mod-writable, read-time filter of missing ids). `filterTagIds` shape documented but without write semantics yet.
- `realm-frontend`: Realm detail Feed tab renders pinned posts above the generic feed. Realm manage page adds a "Pinboard" section with announcement and pinned tabs. Global admin / root can access `default-realm`'s pinboard without membership, per existing role rules.

## Impact

**Affected packages**

- `package/server`: New `src/pinboard/` module (api, service, mapper, types); wire into `src/index.ts`. No Prisma schema change — all new state lives in `Realm.extra`.
- `package/contract`: New `src/pinboard.ts` (DTO, request/response schemas, pinboard-key literal union). Update `src/realm.ts` realm DTO `extra` field to the typed shape.
- `package/api`: New `src/pinboard/` query options + mutation hooks.
- `package/app`: New `src/pinboard/` feature folder following `feature standard.md` layering (models / hooks / states / components / sections / pages / index). Homepage `AnnouncementBarSection` and `NoticeBoard` migrate to consume pinboard. New pinboard management sections mounted inside the realm manage page.
- `package/server/prisma/seed`: Remove `home_notice` seed. Add seed that creates 2–3 sample multilingual announcements in `default-realm` so the homepage is non-empty after reseed.
- `openspec/specs/`: New capability spec + three modified capability deltas (see above).

**No migrations**: all persistence uses existing `Realm.extra` (Json) and existing `Post` / `Unit` / `UnitTranslation` / `TranslationGroup` tables.

**Backward compatibility**

- The EchoKV `home_notice` key is abandoned but not deleted at runtime — existing deployments can keep the row; it is simply no longer read. Seed is updated so fresh databases do not recreate it.
- No other EchoKV keys are touched. `home_carousel` remains intact.
- Post / TranslationGroup / UnitTranslation services are not modified; pinboard composes them at the Prisma tx level without going through those services to avoid nested-transaction hazards.

**Frontend quality bar**

Pinboard-facing UI (homepage announcement bar, homepage notice board, realm manage pinboard section, admin announcement editor) must reach a **polished, production-usable** level on first merge — not a prototype. Concretely:
- Loading, empty, and error states are explicitly designed and implemented (skeletons, empty illustrations, retry affordances).
- Language switching updates content without full-page reflow; untranslated pinboard entries fall back gracefully.
- The admin editor supports adding / editing / removing per-language translations with inline validation, unsaved-change guards, and optimistic updates that roll back on failure.
- Reordering uses `dnd-kit` drag-and-drop consistent with existing `@rezics/ui` patterns.
- Destructive actions (unpin, soft-delete) are confirmed via existing confirm-modal primitives.
- Keyboard navigation and screen-reader labels match the rest of the app.
