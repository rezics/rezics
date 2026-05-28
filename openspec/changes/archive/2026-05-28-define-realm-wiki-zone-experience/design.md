## Context

Rezics already has most of the primitives needed for a Fandom-like wiki product:

- `PostKind.WIKI` uses POST Units and collaborative editing/history.
- `SubjectAttribution` links Units to Entity subjects such as characters, locations, factions, concepts, and canonical wiki pages.
- `UnitWork` groups visible releases under hidden work domains and projects work-domain community content.
- `UnitRealm` links any Unit to one or more realms as feed/community membership.
- `Realm` owns community governance, membership, moderation, tag curation, and tabbed product surfaces.
- `Zone` already provides a Unit-backed template/filter/styling container.
- `TranslationGroup` represents parallel language variants of content Units.

The missing product boundary is not wiki ownership. Wiki content can be sent to realms through `UnitRealm`, and one wiki Unit can belong to multiple realms. The missing boundary is wiki experience organization: release pages need a default realm context, realm pages need a simple Wiki tab, and the Fandom-like themed homepage/navigation experience needs to live in Zone rather than inside the realm detail tab.

## Goals / Non-Goals

**Goals:**

- Keep wiki realm membership on `UnitRealm`; do not introduce a separate realm-wiki ownership table.
- Distinguish "sent to realm" from "reposted for discussion".
- Let release/work pages resolve an official or community realm context for wiki discovery.
- Use Zone as the themed Fandom-like wiki surface and keep the realm Wiki tab visually uniform with the app.
- Define controlled wiki Zone configuration for navigation, homepage sections, templates, and theme tokens.
- Support i18n by storing Entity, Tag, TranslationGroup, and LABEL Unit ids where possible.
- Add `UnitType.LABEL` for reusable multilingual labels without extension tables.
- Preserve parallel wiki translations through `TranslationGroup`, not `UnitTranslation` on one wiki Unit.

**Non-Goals:**

- Arbitrary CSS, user-authored JavaScript, or fully free-form CMS page builders.
- Replacing existing Realm governance, Unit authority, wiki editing, or content-history models.
- Making hidden work Units public wiki pages.
- Making wiki content canonical product metadata or filter authority.
- Defining a complete relation graph/knowledge base beyond subject attribution and homepage/navigation sections.
- Migrating all existing realms/zones to themed wiki zones automatically.

## Decisions

### Decision: Wiki realm membership remains `UnitRealm`

A wiki page is a POST Unit with `Post.kind = WIKI`. Sending it to a realm writes `UnitRealm(realmUnitId, unitId)`. This means the wiki is truly part of that realm's content set and can appear in realm wiki lists, feeds, moderation surfaces, and search.

Reposting is different: a user creates a new ordinary discussion/repost Post that references the original wiki Unit. Reposting does not add `UnitRealm` rows to the original wiki Unit.

**Alternative considered:** Add `RealmWikiPage` to record realm wiki ownership/canonical pages. Rejected because it duplicates `UnitRealm`, confuses sent content with curated navigation, and adds a second membership system. The desired Fandom behavior is navigation/portal organization, not a new ownership edge.

### Decision: Realm Wiki tab is a uniform entry surface

The realm detail Wiki tab uses the app's normal theme. It lists/searches wiki Units sent to the realm, exposes simple filters, and prominently links to the configured wiki Zone. It does not apply realm-specific custom wiki theme tokens.

This keeps realm detail pages consistent and prevents custom fandom skins from bleeding into Feed, Members, About, Moderation, or catalog-adjacent UI.

### Decision: Themed Fandom experience lives in Zone

The wiki Zone is the themed portal surface. It uses Zone routing, Zone template selection, Zone filters, and Zone styling. Wiki Zone configuration adds:

- wiki content base filters;
- navigation schema;
- homepage section schema;
- restricted theme tokens;
- built-in wiki templates.

This reuses the existing Zone direction while extending it for wiki-specific needs.

### Decision: Work-to-realm context resolves release wiki defaults

Release pages resolve their wiki context through `UnitWork(role = RELEASE) -> workUnitId -> WorkRealmContext`. A work can designate official, community, language, or archive realms. The release page uses this to choose the default wiki realm and Zone link.

Release-level overrides are allowed only as explicit context rows, not by pretending the realm belongs to the release. This preserves realm independence and supports works whose fandom spans many releases.

### Decision: `UnitType.LABEL` provides reusable multilingual labels

`LABEL` is a Unit-only type with no extension table. It is meant for navigation group names, homepage section headings, zone labels, and similar reusable multilingual display nodes. It gets `UnitTranslation`, slug, visibility/status, and authority behavior from Unit.

`LABEL` is not a substitute for Entity, Tag, wiki Post, or catalog content. It must not appear as ordinary library content, and public search should only expose it where a label picker or configuration surface needs it.

### Decision: Wiki pages are parallel translations

Wiki language variants are separate WIKI Post Units grouped by `TranslationGroup`. `UnitTranslation` on the wiki Unit may still provide the Unit's title/summary metadata, but the wiki page body and page identity across languages are resolved through `TranslationGroup`.

Zone homepage and navigation featured pages should store `translationGroupId` when the intent is "this wiki page in the viewer's best language." They should store a specific wiki `unitId` only when the section intentionally targets one language variant.

### Decision: Navigation and home configuration stores ids first

Navigation and homepage sections should store ids rather than display strings:

- Entity ids for character/location/faction/concept collections.
- Tag Unit ids for realm taxonomy and topic collections.
- TranslationGroup ids for featured wiki pages.
- LABEL Unit ids for custom group headings.
- Inline translation maps only for manual labels that do not deserve a reusable Unit.

This keeps i18n aligned with existing UnitTranslation/Entity/Tag infrastructure and avoids raw single-language JSON labels.

### Decision: Theme customization is token-based

The wiki Zone accepts restricted tokens for palette, media, chrome, and wiki layout. It does not accept arbitrary CSS. Built-in templates interpret those tokens:

- `wiki-classic`
- `wiki-media`
- `wiki-database`
- `wiki-minimal`

This provides customization while preserving accessibility, layout safety, moderation safety, and predictable implementation.

## Target Data Flow

```txt
Release page
  └─ UnitWork(role=RELEASE)
     └─ workUnitId
        └─ WorkRealmContext(role=official/community/language)
           └─ realmUnitId
              ├─ Realm Wiki tab: uniform list of WIKI Units in UnitRealm
              └─ wikiZoneUnitId
                 └─ Zone template/theme/navigation/homepage
```

```txt
Wiki Zone homepage section
  ├─ entityCollection -> SubjectAttribution + Entity translations
  ├─ tagCollection -> Realm tag tree/tag Units + UnitTranslation
  ├─ translationGroupCollection -> TranslationGroup best-language WIKI Unit
  ├─ recent/updated/stub -> WIKI Unit search in realm
  └─ manualLinks -> URL/Unit/TranslationGroup refs + translated label
```

## Risks / Trade-offs

- Work realm context can conflict with realm `official` status. -> Treat realm `official` as platform/realm discovery status and work realm context as a separate work-domain relationship.
- Zone JSON can become too open-ended. -> Define strict Typebox schemas, version the config shape, and restrict unknown fields.
- Custom themes can reduce readability. -> Validate colors, enforce contrast where possible, provide safe fallbacks, and avoid arbitrary CSS.
- `LABEL` can become a garbage type. -> Restrict public creation surfaces, document intended uses, and avoid showing LABEL as ordinary content.
- TranslationGroup resolution can be expensive in homepage sections. -> Batch hydrate translation groups and selected language Units; cache section query results where appropriate.
- Realm Wiki tab and Zone homepage can diverge. -> Both must query the same base realm wiki content set (`UnitRealm` + `PostKind.WIKI`) while presenting it differently.
- Work official realm selection can be ambiguous. -> Require deterministic priority ordering and explicit conflict handling.

## Migration Plan

1. Add contract schemas for `LABEL`, work realm context roles, wiki Zone config, navigation sections, homepage sections, and theme tokens.
2. Add database support for `LABEL` and work realm context.
3. Extend Zone DTO validation and persistence without breaking existing Zones.
4. Add server read/write services and API endpoints.
5. Add search/query support for wiki Zone sections.
6. Add app Realm Wiki tab entry and Zone wiki templates.
7. Add seed fixtures for at least one work with an official realm, wiki Zone, labels, entity sections, tag sections, translation group featured pages, and theme presets.
8. Backfill is optional: existing realms/zones continue without wiki Zone configuration until configured.

Foundation migration note: `LABEL` is additive on `UnitType`, `Zone.wiki` is
nullable, and `WorkRealmContext` starts empty. Existing Zone and Realm rows
therefore require no immediate backfill; seed fixtures may opt in by writing
`Realm.extra.wikiZoneUnitId` and Zone wiki config after the foundation schema is
available.

Rollback is straightforward before schema migrations ship. After `LABEL` and work realm context schema changes ship, rollback should leave unused rows in place or hide related UI; no existing catalog content must be rewritten.

## Open Questions

- Should ordinary realm owners create `LABEL` Units directly, or should labels be created only through Zone/realm management flows?
- Should work realm context writes be global-admin-only in v1, or can verified realm owners request/claim official context?
- Should release-level work realm overrides ship in v1 or remain a documented future extension?
- What exact quality signal defines "stub" wiki pages: missing main content, short body, missing translation group coverage, or explicit tag/field?

## Contract Lock-in (resolved for implementation)

This change is delivered in two phases against a single change: a foundation
slice (data model + server + contracts) lands first, then the feature slice
(UI/seed/tests). Archive only after the feature slice. See `implement_goal.md`
(Phases 3 and 7). Foundation contracts to pin:

- **`UnitType.LABEL`** — new enum value for reusable multilingual labels; excluded
  from catalog search. No extension table (Unit + `UnitTranslation` only).
- **`WorkRealmContext`** — a new top-level Prisma table (not `Realm.extra`, not
  `UnitWork` JSON): `(workUnitId, realmUnitId, role, priority, locale?,
  releaseUnitId?, audit timestamps)`. Uniqueness spans the
  role/locale/release-override dimensions; indexes on `workUnitId` and
  `realmUnitId`.
- **`wikiZoneUnitId → Realm` persistence** — store on `Realm.extra` as a typed
  key (`Realm.extra.wikiZoneUnitId`) for v1 (no schema migration, consistent with
  the existing realm-extra pattern); promote to a column only if querying by it
  becomes hot.
- **Zone wiki config** — Typebox schemas extending `Zone` JSON for `filters`,
  `navigation`, `homepage`, `theme`, with unknown-field rejection and
  service-level validation on persist. No new `RealmWikiPage` table: wiki pages
  are `PostKind.WIKI` Units in `UnitRealm`; language variants are parallel WIKI
  Units grouped by `TranslationGroup`.
- **`unit-work-domain` delta** — this change carries a delta to the canonical
  `openspec/specs/unit-work-domain` (already landed); it consumes
  `UnitWork(role = RELEASE)` to resolve a release's default wiki realm, it does
  not redefine the capability.
