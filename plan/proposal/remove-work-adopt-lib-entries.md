---
title: Remove Work and Adopt Lib Entries
status: active
created: 2026-05-30
completed:
supersededBy:
tags: [work, catalog, book, content, search, wiki, comments]
---

## Why

The current work model tries to solve too many unrelated problems: search
dedupe, release grouping, tag inheritance, discussion aggregation, source
edition selection, i18n presentation, and content containment. It cannot define
a neutral "work" for books, games, translations, web/publication variants, or
multi-volume series without turning into a fake abstract object. Rezics already
keeps work contentless; this plan goes further and removes the work system
instead of continuing to make it carry product decisions it cannot own.

The replacement is product-first. Every meaningful thing remains its own native
Unit (`BOOK`, `GAME`, `MEDIA`, `POST`, etc.). The default catalog surface is a
Rezics library entry: an ordinary native Unit with `catalogEntryKind = MAIN`,
selected/created as the classified, readable entry for generic discovery.
Publication/source editions, translations, reprints, and other exact variants
are still modeled, but as `catalogEntryKind = VARIANT` rows pointing at their
main entry through `mainUnitId`; supporting/non-catalog Units use
`catalogEntryKind = NONE`. Search and grouping derive from that catalog identity
instead of carrying a separate search strategy. Interaction is routed through
default realm and concrete target units. Text/body i18n moves to
`ContentTranslation`, while `UnitTranslation` remains metadata/display.

## Durable constraints & decisions

- `(type)` Do not introduce a `REZICS_LIB` UnitType. A Rezics-lib entry is an
  ordinary native Unit (`BOOK`, `GAME`, `MEDIA`, etc.) whose catalog identity is
  expressed by `catalogEntryKind`, not by a special Unit type.
- `(type)` Add native Unit catalog identity: `catalogEntryKind` with values
  `MAIN`, `VARIANT`, and `NONE`, plus nullable `mainUnitId` for variants. Do not
  collapse this into a boolean; non-main catalog variants and non-catalog
  content Units must remain distinguishable.
- `(comment)` Rezics-lib entries are productized library entries, not ownership
  claims over source works. Exact source/publication metadata belongs to
  `VARIANT` rows or variant/source records, not the main entry identity.
- `(type)` Remove `UnitWork`, work Units, work roles, `workUnitId(s)`,
  `searchGroupId`, `displayPolicy`, work tag inheritance, work-domain feeds,
  work merge, and work-realm context from the long-term model.
- `(test)` Generic search must show `catalogEntryKind = MAIN` entries by default
  and hide exact variants/reprints/translations unless the caller selects an
  exact edition/source search mode.
- `(test)` Web versions and publication versions are independent catalog entries
  by default: separate tags, default realms, and interaction surfaces unless a
  later explicit product rule links them.
- `(comment)` Tags are maintained on first-class `MAIN` catalog entries.
  Variants do not inherit tag maintenance responsibility by default.
- `(type)` `UnitTranslation` remains metadata/display only: title, subtitle,
  summary, description, and locale presentation. Body content must not be added
  to `UnitTranslation`.
- `(type)` Add `ContentTranslation` for translated body/content payloads used by
  wiki, chapters, and other reusable content units.
- `(test)` Wiki uses aggregated translations: one content/wiki Unit with many
  `ContentTranslation` rows. Remove the parallel wiki-post/translation-group
  behavior after migration.
- `(type)` All interaction targets concrete Units through `targetUnitId`.
  Comments, posts, reviews, and shelf-related discussion can target a book,
  chapter/content unit, post, shelf, or other Unit.
- `(type)` Content tree aggregation is structural, not work-based. Flatten
  `ContentStructureNode` into searchable/queryable anchors containing
  `ownerUnitId`, `contentUnitId`, `nodeId`, parent/ancestor ids, path, depth,
  and sort keys.
- `(test)` A book page can query popular chapter comments/posts/reviews by
  `ownerUnitId` through the flattened content anchor projection, while a chapter
  page can query direct interaction by `targetUnitId`.
- `(test)` Reused content units produce real aggregation: if two book entries
  reuse the same chapter/content Unit, interactions on that content Unit are
  visible through both owners' content-anchor queries.
- `(comment)` This plan supersedes work-based aggregation assumptions. It does
  not replace the separate post/comment split plan; comment extraction remains a
  prerequisite or companion change for clean interaction indexing.

## 1. Contract and Naming

- [ ] 1.1 Remove work-domain fields from public contract DTOs and search
  schemas: `workUnitId`, `workUnitIds`, `workRoles`, `searchGroupId`,
  `displayPolicy`, work membership objects, and work-domain query options.
- [ ] 1.2 Add native catalog identity contract fields on Unit-facing DTOs and
  search documents: `catalogEntryKind: MAIN | VARIANT | NONE` and nullable
  `mainUnitId`.
- [ ] 1.3 Add exact-variant/source search options that intentionally include
  `VARIANT` entries and can filter by `mainUnitId` without appearing in generic
  discovery.
- [ ] 1.4 Add `ContentTranslation` contract schemas for body content translations
  with language, content payload, status/provenance hooks, and timestamps.
- [ ] 1.5 Remove translation-group contract surfaces used only by parallel wiki
  post selection after migration to `ContentTranslation`.

## 2. Database Model

- [ ] 2.1 Remove `UnitWork`, work-specific relations on `Unit`, work merge/admin
  tables, work maintenance types, and work realm context tables from the
  long-term Prisma schema.
- [ ] 2.2 Add native Unit catalog identity storage: `catalogEntryKind` and
  nullable `mainUnitId`, with constraints/tests that variants point at a main
  native catalog Unit and non-variants do not accidentally carry variant
  grouping state.
- [ ] 2.3 Model source/publication variants separately from first-class entries:
  ISBN, publisher, edition, exact language/source, cover, exact text length, and
  provenance must live on `VARIANT` rows or variant/source records outside the
  main lib entry identity.
- [ ] 2.4 Add `ContentTranslation` storage for body content; keep
  `UnitTranslation` focused on display metadata.
- [ ] 2.5 Add a flattened content-anchor projection table sourced from
  `ContentStructureNode`, with indexes for `ownerUnitId`, `contentUnitId`,
  `nodeId`, `ancestorNodeId`, path/depth, and sort ordering.
- [ ] 2.6 Add interaction-target scope projection rows if needed so posts,
  comments, reviews, and shelf discussion can be queried by both direct
  `targetUnitId` and structural owner/ancestor scope.

## 3. Wiki and Body Translation

- [ ] 3.1 Migrate wiki from parallel translated posts using `translationGroupId`
  to one wiki/content Unit plus `ContentTranslation` rows.
- [ ] 3.2 Move existing wiki body content into `ContentTranslation`, preserving
  language, author/history/provenance where available.
- [ ] 3.3 Update wiki read/write APIs to select body language from
  `ContentTranslation` instead of choosing among sibling translated posts.
- [ ] 3.4 Remove app zone/wiki code paths that fetch best-language wiki posts by
  translation group.
- [ ] 3.5 Add tests proving wiki tags, discussion, and identity are shared across
  translations while body content remains language-specific.

## 4. Search and Indexing

- [ ] 4.1 Remove work fields and work inheritance from
  `ContentSearchDocument`, `PostSearchDocument`, search filters, schema tests,
  sync builders, and ranking/search jobs.
- [ ] 4.2 Add catalog identity filters so generic search requires
  `catalogEntryKind = MAIN`; `Unit.visibility` remains public-access policy, not
  catalog identity.
- [ ] 4.3 Add variant/source search mode filters for exact edition lookup,
  including `catalogEntryKind = VARIANT` and `mainUnitId = <main entry>` where
  applicable.
- [ ] 4.4 Add content-part or content-anchor search projection fields:
  `ownerUnitIds`, `contentUnitId`, `nodeId`, `ancestorNodeIds`, `path`, `depth`,
  `titlePath`, and language.
- [ ] 4.5 Add interaction search fields that can answer:
  "all popular discussion under this book entry", "all direct discussion on this
  chapter/content Unit", and "all discussion under this structure subtree".
- [ ] 4.6 Replace shelf/book/review/remark work-domain filters with direct
  target-unit or structural-owner filters.

## 5. Server Services

- [ ] 5.1 Remove `unit-work`, work membership claim, admin work merge, work
  maintenance, and work realm context APIs/services once replacement read paths
  exist.
- [ ] 5.2 Update book/game/media creation flows so the default created record is
  a native `MAIN` lib entry, not a release attached to a hidden work.
- [ ] 5.3 Add variant/source management APIs for exact publication/source records
  that create or maintain `VARIANT` entries without making each variant a
  generic search result.
- [ ] 5.4 Update tag services so first-class entries own classification;
  `VARIANT` entries do not receive inherited work tags.
- [ ] 5.5 Update post/comment/review creation flows so all interaction writes use
  concrete `targetUnitId` plus default realm/moderation scope where applicable.
- [ ] 5.6 Maintain content-anchor projections transactionally or through repair
  jobs when content structures change.

## 6. App Cutover

- [ ] 6.1 Remove work/release UI language from book-library, book-edit, review,
  remark, shelf, realm extra management, and series integration surfaces.
- [ ] 6.2 Replace release selector behavior with variant/source selection that
  is clearly secondary to the first-class lib entry.
- [ ] 6.3 Update book pages to query reviews/posts/comments through direct
  `targetUnitId` and content-anchor owner filters instead of `workUnitId`.
- [ ] 6.4 Update search result cards to render `MAIN` lib entries in generic
  results and expose `VARIANT` entries only through explicit expansion or
  exact-source search mode.
- [ ] 6.5 Update wiki UI to edit/read aggregated `ContentTranslation` bodies.

## 7. Migration and Verification

- [ ] 7.1 Create a migration map from existing work memberships to
  `catalogEntryKind`, `mainUnitId`, and variant/source relations.
- [ ] 7.2 Preserve legacy primary releases as first-class lib entries; convert
  secondary/hidden releases into variants or independent entries based on legacy
  `UnitWork.displayPolicy` and content differences.
- [ ] 7.3 Convert work-inherited tags into tags on the chosen first-class entries
  only where the migration can do so without duplicating variant maintenance
  responsibility.
- [ ] 7.4 Backfill content-anchor projection rows for existing
  `ContentStructureNode` trees.
- [ ] 7.5 Backfill interaction search/projection rows so existing posts/reviews
  can be queried by direct target and structural owner.
- [ ] 7.6 Add regression tests for search de-duplication, exact variant search,
  wiki aggregated translation, and book-page popular chapter discussion.

## Out of scope

- Do not reintroduce a work/group/cluster abstraction under a new name.
- Do not make Rezics-lib a new UnitType.
- Do not model catalog identity as only `isMainVersion: boolean`; `NONE`
  supporting Units must stay distinct from exact `VARIANT` entries.
- Do not put body content into `UnitTranslation`.
- Do not require every exact edition/reprint/translation to carry its own tag
  maintenance or generic-search exposure.
- Do not solve copyright/licensing policy beyond preserving source/provenance
  hooks for variants and content translations.
