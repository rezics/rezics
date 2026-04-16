## Context

The platform currently serves content through hardcoded type-specific routes (`/book`, `/game`) with bespoke homepage and search implementations per domain. Each domain search (`BookLibPage`, `RealmSearchPage`, `ShelfSearchPage`, `ReviewSearchPage`) is a standalone implementation with inconsistent filtering capabilities and UI patterns. The `search` feature in `package/app/src/search/` has useful primitives (`searchParser.ts`, `SearchInfo`, Zustand state) but they are fragmented and underutilized — `SearchSuggestions` is a stub, sort options are partially wired, and there is no `/search` route despite `buildSearchPath` targeting it.

The `ContentSearchOptions` schema in `@rezics/contract` supports filtering by `type`, `tagIds`, `realmId`, `realmTagIds`, `nsfw`, `isLicensed`, `languages`, and `sort`. This filter set is the foundation for zone-scoped search — a zone is essentially a named, persisted subset of these filters.

Extension models follow an established pattern: a 1:1 relation from the extension table to `Unit` via `unitId` as both PK and FK (see `Book`, `Realm`, `Game`, etc.).

## Goals / Non-Goals

**Goals:**
- Provide a general-purpose zone system for creating scoped content entry points (permanent categories, time-limited promotions)
- Unify all search UI through a single `search` feature with basic and advanced modes
- Introduce StackOverflow-style search syntax for power users
- Establish the `SlugRef` pattern (`{ slug, unitId? }`) for ergonomic and performant unit references in API contracts
- Zone templates reuse existing sections from `book-library`, `home`, etc. — no code duplication

**Non-Goals:**
- Migrating `/book` or `/game` to become zone instances — they remain hardcoded infrastructure
- User-created zones — zone CRUD is admin-only
- Zone-specific MeiliSearch indexes — zones query the existing content index with pre-applied filters
- Real-time search suggestions / autocomplete (existing stub remains a stub)
- Zone membership or social features — zones are content scoping, not communities (that's Realm)

## Decisions

### 1. Zone as Unit Extension (not standalone model)

**Decision:** Zone is a `UnitType.ZONE` with a `Zone` extension table, following the same pattern as `Book`, `Realm`, `Game`, etc.

**Rationale:** The Unit system provides slug, multilingual translations, visibility, status, `extra` JSON, and timestamps for free. A standalone `Zone` table would duplicate all of this.

**Alternative considered:** Using `Realm` with an `isZone` flag. Rejected because zones and realms have fundamentally different purposes — zones are content-scoping filters, realms are community spaces with membership. Overloading Realm would conflate two orthogonal concepts.

**Data model:**
```
Unit (type=ZONE)
  ├── id, slug, visibility, status, translations, ...
  │
  └── Zone (1:1 extension)
        ├── filters    Json     // ZoneFilters — subset of ContentSearchOptions
        ├── template   String   // slug matching a frontend template file
        ├── styling    Json?    // { bgImage?, accentColor?, cssOverrides?, decorations? }
        ├── startsAt   DateTime?
        ├── endsAt     DateTime?
        ├── createdAt  DateTime
        └── updatedAt  DateTime
```

### 2. Zone Lifecycle Independent from Unit Visibility

**Decision:** `startsAt`/`endsAt` on the Zone model is a temporal access gate, fully orthogonal to `Unit.visibility`.

**Rationale:** These serve different purposes. Visibility controls *who* can see a zone (public vs. private/draft). Lifecycle controls *when* a zone is active. A promotional zone may be public (anyone can access) but time-bounded (only during the event). A draft zone may be private (admin preview only) with no lifecycle set yet.

**Access resolution order:**
1. `Unit.visibility` — if PRIVATE, require admin/owner access → 403
2. `Zone.startsAt` — if set and `now < startsAt` → show "not yet open" or 404
3. `Zone.endsAt` — if set and `now > endsAt` → show "ended" or 404
4. Pass → render zone

Both `startsAt` and `endsAt` are nullable. Both null = permanent zone.

### 3. Template System: Hardcoded Templates with Customization

**Decision:** Zone templates are React components in `package/app/src/zone/template/`, each file named by its slug (e.g., `book.tsx`, `game.tsx`, `default.tsx`). The zone page selects a template based on `zone.template` and passes zone config as props.

**Rationale:** A fully data-driven template system (CMS-style section composition) is premature. Hardcoded templates with customization props (styling overrides, background images) provide a good balance of flexibility and simplicity. Adding a new template is just adding a file.

**Template receives:**
```typescript
type ZoneTemplateProps = {
  zone: ZoneDTO          // filters, styling, translations
  children?: ReactNode   // slot for search integration
}
```

**Templates compose sections from existing features** (`@/book-library`, `@/home`, etc.) via their public `index.ts` exports. This means affected features must export the sections that templates need.

**Alternative considered:** Making `/book`'s `BookHomePage` generic and accepting filters. Rejected because `/book` has specialized logic (tabs, specific data hooks) that not all zones need. Separate templates that reuse *sections* (not pages) give better control.

### 4. Unified Search Feature Architecture

**Decision:** The `search` feature in `package/app/src/search/` becomes the single source of all search UI. It provides:
- `BasicSearch` — clean keyword input with hidden pre-applied filters (used in zone homepages, nav bars)
- `AdvancedSearch` — full filter panel exposing all ContentSearchOptions dimensions
- Both built on the same core (shared state, shared query builder)

**Context route pattern:** Each search route (`/book/search`, `/zone/:slug/search`, `/search`) renders the shared search components with different pre-applied filters. The route maintains context (user stays at `/zone/light-novel/search`, not redirected to `/search`).

```
/search              → AdvancedSearch, no pre-applied filters
/book/search         → BasicSearch + AdvancedSearch, pre-applied: { type: ["BOOK"] }
/zone/:slug/search   → BasicSearch + AdvancedSearch, pre-applied: zone.filters
```

**Alternative considered:** A single `/search` route that all contexts redirect to (Option A from exploration). Rejected because it loses zone/domain context and makes URLs less meaningful.

### 5. StackOverflow-Style Search Syntax

**Decision:** The search input supports structured syntax: `[tag-slug] type:book lang:ja keyword text`. The frontend parses this into a structured `SearchQuery` type; the backend only receives structured queries, never raw syntax strings.

**Syntax tokens:**
- `[slug]` — tag filter by slug
- `type:value` — content type filter
- `lang:value` — language filter
- `nsfw:yes|no` — NSFW filter
- `licensed:yes|no` — licensed content filter
- `in:realm-slug` — realm scope
- `sort:newest|relevance|...` — sort control
- Everything else — keyword text

**Contract split:** `@rezics/contract` defines the `SearchQuery` structured type. The `search` feature in `package/app` owns the `parseSearchString()` and `serializeSearchString()` functions. The backend never parses search syntax — it is purely a frontend UX feature.

**Alternative considered:** Having the backend parse search strings too (to support API consumers). Deferred — API consumers can construct `ContentSearchOptions` directly.

### 6. SlugRef Pattern for Tag References

**Decision:** Extend `ContentSearchOptions` with `tags: Array<{ slug: string; unitId?: string }>`. The backend handles each entry independently: uses `unitId` when present (zero-cost lookup), resolves `slug` → `unitId` otherwise.

**Rationale:** Tag slugs are the human-readable, URL-stable identifiers. Tag names are i18n-dependent and mutable — unsuitable for search strings. Sending `unitId` when available avoids a DB round-trip per tag.

**Transition:** `tagIds: string[]` is preserved during transition. When both `tags` and `tagIds` are present, `tags` takes precedence. `tagIds` will be deprecated in a future change.

**Type definition (in contract):**
```typescript
type SlugRef = { slug: string; unitId?: string }
```

This pattern is deliberately generic — it can be reused for realm references, entity references, etc. in future API evolution.

### 7. Zone Feature Folder Structure

**Decision:** Zone lives in `package/app/src/zone/` following the standard feature layering, with an additional `template/` layer:

```
zone/
  model/        — ZoneDTO types, filter merge utilities
  hooks/        — useZone, useZoneFilters
  state/        — zone config state (fetched zone data)
  component/    — zone-specific UI atoms (lifecycle badge, etc.)
  section/      — zone-specific business blocks
  template/     — homepage templates (book.tsx, game.tsx, default.tsx)
  page/         — ZoneHomePage, ZoneSearchPage (thin route entry points)
  index.ts      — public exports
```

The `template/` layer sits between `section/` and `page/` conceptually: it composes sections into a configurable layout, but is not a route entry point itself. Pages select and render templates.

## Risks / Trade-offs

**[Cross-feature section exports]** → Zone templates import sections from `book-library` and `home`. These sections must be formally exported via `index.ts`. If section APIs change, zone templates break.
→ *Mitigation:* Keep template imports to stable, high-level sections. Review cross-feature exports during implementation.

**[ZoneFilters as Json]** → Storing filters as untyped `Json` in Prisma means no DB-level validation. Invalid filter combinations are possible.
→ *Mitigation:* Validate `ZoneFilters` at the API layer (Typebox schema in contract). The DB stores the validated result. Admin UI also validates before save.

**[Search syntax learning curve]** → StackOverflow-style syntax is powerful but unfamiliar to casual users. Most users will only use basic keyword search.
→ *Mitigation:* Basic search is the default. Advanced search shows the filter panel as a visual alternative to syntax. Syntax is a power-user shortcut, not the primary interaction.

**[Template proliferation]** → Each distinct zone layout requires a new template file. If many zones want slight variations, template count grows.
→ *Mitigation:* Templates accept `styling` props for visual customization (colors, images). Only structurally different layouts need new templates. Start with 2-3 templates; add more only when needed.

**[SlugRef resolution performance]** → When `unitId` is absent, backend must query `Unit` by slug for each tag. A search with many slug-only tags could add latency.
→ *Mitigation:* Slug lookups hit the unique `slug` index — fast single-row reads. In practice, zones pre-define filters with known unitIds (admin UI can resolve at save time). User-typed slugs in search syntax are typically 1-3 tags.
