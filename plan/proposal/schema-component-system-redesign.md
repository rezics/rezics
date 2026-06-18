---
title: Schema Component System Redesign
status: active
created: 2026-06-19
completed:
supersededBy:
tags: [contract, schema, component, page, dock, zone, pinboard, ui]
---

## Why

Rezics currently mixes several identity and variant concepts inside persisted
contracts: `id` sometimes means DB identity, sometimes JSON editor identity, and
sometimes human-authored section locator; `key` is used for product placement;
`type` and `kind` are both used as discriminants; Dock and Zone components are
designed as separate vocabularies even though they are both configurable
schema-driven surfaces.

This proposal replaces the narrower naming and Dock-only plans with one
canonical schema/component design. The goal is to define what DB JSON stores,
what gets translated only at import/export boundaries, how page sections and
dock widgets share a component registry without collapsing host policy, and how
renderer class hooks support custom themes without bypassing the Rezics token
system.

This is a development-stage cutover. Old JSON shapes, old field names, old
routes, and the existing v1/v2 envelope split do not need compatibility shims.
The implementation should delete the current experimental shapes and make the
new canonical schemas version 1. Every internal caller should move in the same
implementation.

## Research and design signals

- Portable Text stores rich text as JSON blocks with `_type`; Sanity examples
  also use `_key` on blocks/spans and for annotation references. That is a
  Portable Text/Sanity wire dialect, not a Rezics DB shape.
- Lexical treats node keys as editor-state internals and says they should not be
  serialized outside the editor lifecycle. Persistent node identity is therefore
  not mandatory for every tree node; it is a deliberate contract feature.
- JSON-LD reserves `@id`/`@type`, and JSON Schema reserves `$id`/`$defs`. Those
  prefixed words carry ecosystem-specific processing semantics. Rezics canonical
  JSON should not store `_id`, `_type`, `_key`, `@id`, or `$id` unless an
  adapter is intentionally exporting that dialect.
- RFC 9562 UUIDs are appropriate for distributed opaque identifiers, especially
  database keys and other system-minted identities. UUIDv7 is a good default
  where sortable opaque IDs are useful, but the presence of UUIDs does not make
  every schema node a resource.
- BEM-style class naming provides stable structural CSS hooks; Rezics public
  class hooks should use the full `rezics-` prefix because `rezics` is already
  short and meaningful. Colors, spacing, typography, radius, and motion still
  belong to Rezics design tokens and CSS variables.

## Durable constraints & decisions

- `(type)` Rezics DB JSON is canonical Rezics JSON. It uses plain unprefixed
  fields such as `schema`, `version`, `kind`, `nodeId`, `slug`, `placement`,
  `sections`, `widgets`, `items`, and `children`. It does not store Portable
  Text `_type`/`_key`, JSON-LD `@id`/`@type`, or JSON Schema `$id`/`$defs`.
- `(comment)` Import/export adapters own all dialect translation. Portable Text,
  JSON-LD, future Schema.org, and any plugin-specific export shape are boundary
  formats; the DB JSON remains Rezics-shaped after import.
- `(type)` `schema` is the envelope schema name, for example `rezics/page`,
  `rezics/dock`, `rezics/zone-nav`, or `rezics/zone-theme`. `version` is the
  envelope version. Both live only at envelope roots, not on every node.
- `(type)` Because this is still development-stage schema work, this proposal is
  a clean cutover for the page/dock/zone/pinboard schemas it owns: delete the
  current experimental shapes instead of building upgrade chains. New canonical
  envelopes start at `version: 1`.
- `(type)` `kind` is the only persisted discriminant for Rezics schema/render
  variants. New persisted discriminants must not use bare `type`. Existing
  contract fields using `type` as a variant are cut over to `kind`, except DTOs
  where `type` already means external domain type such as Unit type.
- `(comment)` `type` remains available only for domain concepts that already use
  the word as a noun, such as `UnitType`, MIME/content type, OAuth token type, or
  third-party wire formats. It is not the component/schema variant word.
- `(type)` `id` is reserved for real resource identity: DB rows, Unit identity,
  DTO identity, auth identity, or external protocol identity. JSON config nodes
  do not use bare `id`.
- `(type)` `nodeId` is the persisted identity of a JSON node inside an envelope.
  It is system-minted, opaque, not user-editable, and scoped by the owning
  envelope. Use UUIDv7 strings when a node identity is required.
- `(comment)` `nodeId` exists only when the product needs reorder-safe editor
  tracking, local patch targeting, analytics/debug correlation, or a persisted
  in-envelope reference. Anonymous layout nodes can rely on order and structure.
- `(type)` `slug` is a human-readable locator. It may appear in URLs, anchors,
  page-local section addresses, menu addresses, or author-facing selectors. It
  is not an editor key and must not be used to preserve node identity across
  rename/reorder.
- `(type)` `placement` is a product-defined host slot/purpose. It is closed by
  host and feature, for example `realmDockPlacementValues` or
  `realmPinboardPlacementValues`. It is not a slug and not a node identity.
- `(type)` If a placement is genuinely polymorphic, it must use a discriminated
  object with named fields, for example `{ kind: "dockSlot", slot: "main" }`,
  not a weak `{ type: "...", value: "..." }` pair. Prefer a plain string
  placement when the envelope already fixes the placement domain.
- `(type)` All closed string vocabularies expose `*Values`, `*Schema`, and
  `*Kind`/`*Placement`/specific type aliases. Single-value vocabularies are
  arrays too, for example `["home"] as const`.
- `(type)` Public enum-like schema must be generated from or tested against its
  `*Values` source. A naked exported `t.Literal("...")` is allowed only inside a
  concrete discriminated object member, not as the public vocabulary source.
- `(type)` A generic schema node vocabulary is a trait vocabulary, not a single
  all-fields base object. Do not force `{ nodeId, slug, kind, children }` on
  every node. Compose only the traits a node actually needs.
- `(type)` Page-like surfaces store components as `sections`; Dock-like surfaces
  store components as `widgets`; nested repeated records use `items`; recursive
  navigation trees use `children`.
- `(comment)` `component` is the generic registry concept. `section` and
  `widget` are surface-specific persisted names. `node` is the technical tree
  object concept. Do not use `atom` for persisted schema components because it
  conflicts with UI primitive/Atomic Design vocabulary.
- `(type)` `rezics/page` is the generic page envelope. Zone pages use it, but the
  schema is not named `rezics/zone-page` after this cutover. Zone-specific page
  behavior lives in host policy, route/service ownership, and allowed component
  sets.
- `(type)` `rezics/dock` is the generic dock envelope. Realm docks use it, and
  future catalog/unit docks may use the same envelope with host-specific
  placement policies. No global Dock table is introduced by this proposal.
- `(comment)` Component registry describes schema shape, static capabilities,
  and supported surfaces. Host policy decides what each host/placement actually
  allows, locks, or requires. A component can support a surface in principle and
  still be rejected by a host placement.
- `(comment)` Query/list/stream components are not forbidden from docks at the
  registry layer, but most dock placements should reject them through host
  policy unless the product explicitly allows that dock to render dynamic lists.
- `(type)` Persisted component config is direct object syntax: `{ kind: "...",
  ...config }`. Do not store nested `widget: { ... }`, `slot: "widget"`, or
  factory-function-shaped descriptors in DB JSON.
- `(comment)` Schema source files should be object-first: vocabulary arrays,
  concrete schema objects, maps, and assembled unions are the main expression.
  Builders, parsers, default factories, and reference collectors are helper
  functions and should live after or beside the schema object definitions.
- `(type)` Renderer styling hooks use full `rezics-` class names and
  `data-rezics-*` attributes. Avoid `rz-` and `re-` prefixes.
- `(comment)` Public class hooks expose structure and stable slots, not colors.
  The implementation must continue using Rezics tokens and CSS custom
  properties for themeable color, spacing, typography, radius, and motion.
- `(test)` Convention checks must reject new persisted contract fields named
  bare `key`, new schema-node fields named bare `id`, new component
  discriminants named bare `type`, new public class prefixes `rz-`/`re-`, and
  `mx-auto max-w-*` containers missing `w-full` where touched by this work.
- `(test)` Contract tests must lock that page sections/dock widgets reject
  unknown `kind`, reject extra properties, enforce required node identity only
  where declared, and enforce host placement policy separately from registry
  support.

## Target canonical DB JSON

These examples are not separate specs. They are implementation anchors so the
apply work does not drift back toward the old `id`/`key`/`type` model.

### Generic page envelope

`ZonePage.config` should move from `rezics/zone-page` to `rezics/page`. The row
keeps its DB `id`, `zoneUnitId`, `slug`, and `position`; those are row fields,
not JSON node fields.

```json
{
  "schema": "rezics/page",
  "version": 1,
  "sections": [
    {
      "kind": "stage",
      "nodeId": "01972fd2-0ed8-7b7b-97f5-a4fc0e4d6b8d",
      "slug": "hero",
      "background": {
        "imageUrl": "https://static.rezics.example/zones/toaru/hero.webp",
        "fit": "cover",
        "position": "center"
      },
      "sections": [
        {
          "kind": "zoneInfo",
          "nodeId": "01972fd2-26fa-72c0-930e-41ad486ab0a7",
          "showTitle": true,
          "showDescription": true
        },
        {
          "kind": "actions",
          "nodeId": "01972fd2-52d9-7aa4-8f27-c4c90fae1488",
          "items": [
            {
              "target": { "kind": "zonePage", "pageId": "01972fce-..." },
              "labelUnitId": "01972fcf-..."
            }
          ],
          "builtIns": ["createWiki", "createPost"]
        }
      ]
    },
    {
      "kind": "query",
      "nodeId": "01972fd2-74b6-7780-924f-6271b740003a",
      "slug": "latest-books",
      "titleLabelUnitId": "01972fcf-...",
      "query": {
        "target": "unit",
        "types": ["BOOK"],
        "realm": "context",
        "sort": { "field": "updatedAt", "direction": "desc" }
      },
      "display": "covers",
      "limit": 24,
      "loadMore": true
    }
  ]
}
```

Page rules:

- `nodeId` is present on sections because the editor and section data API need a
  reorder-safe local target. It is generated by the system.
- `slug` is optional and appears only when a section needs an anchor, public
  local locator, or editor-facing named handle.
- Nested `sections` remain sections because they are still page-surface
  components. `children` is reserved for navigation/tree nodes.
- `contentUnitId`, `titleLabelUnitId`, `pageId`, `unitId`, and similar fields are
  content references. They are not schema base fields.

### Dock envelope

`Realm.dock` and future `Unit.dock` should use the same `rezics/dock` envelope.
The owning DB row/column decides host identity. The JSON stores placements and
widgets only.

```json
{
  "schema": "rezics/dock",
  "version": 1,
  "placements": {
    "main": [
      {
        "kind": "unitDescription",
        "nodeId": "01972fd3-05e7-76cc-8ed9-41aa7d24a983",
        "maxLines": 6
      },
      {
        "kind": "unitSubscriptionStat",
        "nodeId": "01972fd3-1d2f-77f9-a453-d872c6848ebf"
      },
      {
        "kind": "pinboard",
        "nodeId": "01972fd3-49fc-7a81-8054-42b0e13ec503",
        "placement": "home"
      },
      {
        "kind": "links",
        "nodeId": "01972fd3-6e66-72cb-ac69-097239a62a97",
        "items": [
          {
            "kind": "link",
            "target": { "kind": "external", "url": "https://example.com" },
            "labelOverrideUnitId": "01972fd0-..."
          }
        ]
      }
    ],
    "wiki": [
      {
        "kind": "zoneNav",
        "nodeId": "01972fd3-9129-7037-bb99-fd730d714d5d",
        "zoneUnitId": "01972fa0-...",
        "menuSlug": "main"
      }
    ]
  }
}
```

Dock rules:

- `placements` can stay object-shaped while the placement set is closed and
  small. If a placement later needs metadata, ordering between placements, or
  plugin-defined placements, the next clean schema can use:

```json
{
  "schema": "rezics/dock",
  "version": 2,
  "placements": [
    { "placement": "main", "widgets": [] },
    { "placement": "wiki", "widgets": [] }
  ]
}
```

- Do not use `{ "type": "page-tab", "value": "home" }` for ordinary placement.
  If a field is truly polymorphic, use named discriminants and fields:

```json
{ "kind": "dockSlot", "slot": "main" }
{ "kind": "pageTab", "tab": "home" }
{ "kind": "region", "region": "aside" }
```

- Widget configs are direct objects. There is no nested `widget` wrapper and no
  `slot: "builtin" | "widget"` split.

### Pinboard DTO and DB shape

Pinboard is a first-class DB table, not dock JSON. Its row `id` remains a real
resource identity. Its former `key` becomes `placement`.

```ts
export const realmPinboardPlacementValues = ["home"] as const;
export type RealmPinboardPlacement =
  (typeof realmPinboardPlacementValues)[number];
export const realmPinboardPlacementSchema = literalSchemaFromValues(
  realmPinboardPlacementValues,
);

export const pinboardKindValues = ["list"] as const;
export type PinboardKind = (typeof pinboardKindValues)[number];
export const pinboardKindSchema = literalSchemaFromValues(pinboardKindValues);

export const pinboardDTOSchema = t.Object(
  {
    id: t.String(),
    realmUnitId: t.String(),
    placement: realmPinboardPlacementSchema,
    kind: pinboardKindSchema,
    entries: t.Array(pinboardEntryDTOSchema),
    createdAt: t.Optional(t.Union([t.String(), t.Date()])),
    updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  },
  { additionalProperties: false },
);
```

DB intent:

```ts
export const Pinboard = pgTable(
  "Pinboard",
  {
    id: uuidv7PrimaryKey(),
    realmUnitId: uuid().notNull().references(() => Realm.unitId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    placement: varchar({ length: 64 }).notNull(),
    kind: varchar({ length: 32 }).default("list").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("Pinboard_realmUnitId_placement_unique").on(
      table.realmUnitId,
      table.placement,
    ),
  ],
);
```

### Zone nav envelope

Zone nav remains its own envelope because it is an atomic whole-tree navigation
write. It does not become `rezics/page`.

```json
{
  "schema": "rezics/zone-nav",
  "version": 1,
  "menus": [
    {
      "slug": "main",
      "nodes": [
        {
          "kind": "link",
          "nodeId": "01972fd4-0909-7f09-8a05-24ba716ba4c8",
          "target": { "kind": "zonePage", "pageId": "01972fce-..." },
          "children": [
            {
              "kind": "link",
              "nodeId": "01972fd4-3f8b-7bee-b52c-3383ce39ec09",
              "target": { "kind": "unit", "unitId": "01972fcb-..." }
            }
          ]
        }
      ]
    }
  ],
  "header": {
    "menuSlug": "main",
    "logoImageUrl": "https://static.rezics.example/zones/toaru/logo.webp",
    "searchPlaceholderLabelUnitId": "01972fd1-..."
  }
}
```

Nav rules:

- Menus use `slug` because header/dock/editor references name a menu instance.
- Menu nodes use `nodeId` only if the editor needs stable node patch/reorder
  targets; if the implementation chooses whole-tree replacement only, node
  `nodeId` may be removed before apply, but bare `id` must not remain.
- Recursive tree children are named `children`, not `sections`.

## Target TypeScript schema style

Schema modules should expose object-shaped vocabulary first, then assembled
unions. The following is a target pattern, not copy-paste final code.

```ts
export const schemaNodeIdSchema = t.String({
  minLength: 36,
  maxLength: 36,
});

export const pageSectionKindValues = [
  "stage",
  "zoneInfo",
  "image",
  "actions",
  "richText",
  "collection",
  "query",
  "stream",
  "stats",
  "sources",
  "tabs",
  "columns",
] as const;

export type PageSectionKind = (typeof pageSectionKindValues)[number];
export const pageSectionKindSchema =
  literalSchemaFromValues(pageSectionKindValues);

export const pageSectionBaseSchema = t.Object(
  {
    nodeId: schemaNodeIdSchema,
    slug: t.Optional(t.String({ minLength: 1 })),
    titleLabelUnitId: t.Optional(t.String()),
    limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
    emptyState: t.Optional(pageSectionEmptyStateSchema),
  },
  { additionalProperties: false },
);

export const pageQuerySectionSchema = t.Object(
  {
    ...pageSectionBaseSchema.properties,
    kind: t.Literal("query"),
    query: pageSectionQuerySchema,
    display: pageSectionDisplaySchema,
    loadMore: t.Optional(t.Boolean()),
    dynamicTags: t.Optional(pageDynamicTagsSchema),
  },
  { additionalProperties: false },
);

export const pageSectionSchemas = {
  query: pageQuerySectionSchema,
  collection: pageCollectionSectionSchema,
  richText: pageRichTextSectionSchema,
  tabs: pageTabsSectionSchema,
  columns: pageColumnsSectionSchema,
  stage: pageStageSectionSchema,
  // ...
} as const;

export const pageContentSectionSchema = t.Union([
  pageSectionSchemas.image,
  pageSectionSchemas.actions,
  pageSectionSchemas.richText,
  pageSectionSchemas.collection,
  pageSectionSchemas.query,
  pageSectionSchemas.stream,
  pageSectionSchemas.stats,
  pageSectionSchemas.sources,
]);

export const PAGE_SCHEMA = "rezics/page" as const;
export const PAGE_V1_VERSION = 1 as const;

export const pageV1Schema = t.Object(
  {
    schema: t.Literal(PAGE_SCHEMA),
    version: t.Literal(PAGE_V1_VERSION),
    sections: t.Array(pageSectionSchema),
  },
  { additionalProperties: false },
);
```

Dock follows the same object-first style:

```ts
export const dockWidgetKindValues = [
  "featuredUnit",
  "unitDescription",
  "unitSubscriptionStat",
  "realmInfo",
  "links",
  "richText",
  "buttonLinks",
  "imageLinks",
  "realmRules",
  "realmModerators",
  "realmStats",
  "realmCalendar",
  "zoneNav",
  "pinboard",
] as const;

export type DockWidgetKind = (typeof dockWidgetKindValues)[number];
export const dockWidgetKindSchema =
  literalSchemaFromValues(dockWidgetKindValues);

export const dockWidgetSchemas = {
  featuredUnit: featuredUnitWidgetSchema,
  unitDescription: unitDescriptionWidgetSchema,
  pinboard: pinboardWidgetSchema,
  zoneNav: zoneNavWidgetSchema,
  // ...
} as const;

export const dockWidgetSchema = t.Union([
  dockWidgetSchemas.featuredUnit,
  dockWidgetSchemas.unitDescription,
  dockWidgetSchemas.unitSubscriptionStat,
  dockWidgetSchemas.realmInfo,
  dockWidgetSchemas.links,
  dockWidgetSchemas.richText,
  dockWidgetSchemas.buttonLinks,
  dockWidgetSchemas.imageLinks,
  dockWidgetSchemas.realmRules,
  dockWidgetSchemas.realmModerators,
  dockWidgetSchemas.realmStats,
  dockWidgetSchemas.realmCalendar,
  dockWidgetSchemas.zoneNav,
  dockWidgetSchemas.pinboard,
]);
```

## Component registry and host policy

The registry is shared vocabulary; policy is product authorization.

```ts
export const componentSurfaceValues = ["page", "dock"] as const;
export type ComponentSurface = (typeof componentSurfaceValues)[number];

export type SchemaComponentInfo = {
  surfaces: readonly ComponentSurface[];
  supportUnitTypes?: readonly UnitType[];
  refFields?: readonly string[];
  queryBehavior?: "none" | "staticRefs" | "lazyQuery" | "stream";
};

export const schemaComponentInfo = {
  richText: {
    surfaces: ["page", "dock"],
    supportUnitTypes: [UnitType.BOOK, UnitType.GAME, UnitType.MEDIA, UnitType.REALM, UnitType.ZONE],
    refFields: ["contentUnitId"],
    queryBehavior: "staticRefs",
  },
  query: {
    surfaces: ["page", "dock"],
    queryBehavior: "lazyQuery",
  },
  unitDescription: {
    surfaces: ["dock"],
    queryBehavior: "none",
  },
  zoneNav: {
    surfaces: ["dock"],
    refFields: ["zoneUnitId"],
  },
} as const;
```

Policy examples:

```ts
export const realmDockPlacementValues = ["main", "wiki"] as const;
export type RealmDockPlacement = (typeof realmDockPlacementValues)[number];
export const realmDockPlacementSchema =
  literalSchemaFromValues(realmDockPlacementValues);

export const realmDockPolicy = {
  main: {
    widgetSchema: realmMainDockWidgetSchema,
    requiredKinds: [
      "unitDescription",
      "unitSubscriptionStat",
      "realmInfo",
      "links",
      "realmRules",
      "realmModerators",
    ],
    lockedKinds: [
      "unitDescription",
      "unitSubscriptionStat",
      "realmInfo",
      "links",
      "realmRules",
      "realmModerators",
    ],
    maxWidgets: 32,
  },
  wiki: {
    widgetSchema: realmWikiDockWidgetSchema,
    maxWidgets: 16,
  },
} as const;
```

Host policy rules:

- A page host can allow `query` and `stream` freely because page body is the
  primary content surface.
- A dock host can reject `query` and `stream` by default even though the registry
  knows those components exist.
- A future host may allow a `query` dock widget explicitly; that should be a
  policy change, not a new component kind.
- Policy must validate host-specific placement values, not an aggregate
  `dockPlacementSchema`.

## Renderer hook contract

Renderer public hooks must be stable and predictable. These are class/API
contracts for app code and custom themes, not replacements for Rezics tokens.

### Page classes

```html
<main class="rezics-page" data-rezics-surface="page">
  <section
    class="rezics-page-section rezics-page-section--query"
    data-rezics-kind="query"
    data-rezics-node-id="01972fd2-74b6-7780-924f-6271b740003a"
    data-rezics-slug="latest-books"
  >
    <header class="rezics-page-section__header">
      <h2 class="rezics-page-section__title">Latest books</h2>
    </header>
    <div class="rezics-page-section__body">
      ...
    </div>
  </section>
</main>
```

Required page hook pattern:

- `rezics-page`
- `rezics-page-section`
- `rezics-page-section--{kind}`
- `rezics-page-section__header`
- `rezics-page-section__title`
- `rezics-page-section__body`
- `data-rezics-surface="page"`
- `data-rezics-kind`
- `data-rezics-node-id` only when the schema node has `nodeId`
- `data-rezics-slug` only when the schema node has `slug`

### Dock classes

```html
<aside
  class="rezics-dock rezics-dock--main"
  data-rezics-surface="dock"
  data-rezics-placement="main"
>
  <section
    class="rezics-dock-widget rezics-dock-widget--pinboard"
    data-rezics-kind="pinboard"
    data-rezics-node-id="01972fd3-49fc-7a81-8054-42b0e13ec503"
  >
    <header class="rezics-dock-widget__header">
      <h2 class="rezics-dock-widget__title">Pinned</h2>
    </header>
    <div class="rezics-dock-widget__body">
      ...
    </div>
  </section>
</aside>
```

Required dock hook pattern:

- `rezics-dock`
- `rezics-dock--{placement}`
- `rezics-dock-widget`
- `rezics-dock-widget--{kind}`
- `rezics-dock-widget__header`
- `rezics-dock-widget__title`
- `rezics-dock-widget__body`
- `data-rezics-surface="dock"`
- `data-rezics-placement`
- `data-rezics-kind`
- `data-rezics-node-id` only when the widget has `nodeId`

Class rules:

- Use full `rezics-`; never `rz-` or `re-`.
- Use class names for stable structure and theme hooks. Do not encode data or
  arbitrary user strings into class names.
- Use `data-rezics-*` for inspectable runtime facts.
- Continue using `@rezics/ui` tokens and shadcn/Rezics primitives internally.
- Custom themes should override CSS variables or these structural hooks, not
  hardcode colors into components.

## Expected file layout

Apply may choose slightly different names, but the split should stay close to
this shape.

```txt
package/contract/src/schema/
  vocabulary.ts        # id/nodeId/slug/kind/placement comments + schemas
  literal-values.ts    # literalSchemaFromValues helper
  node.ts              # schemaNodeIdSchema and shared node trait helpers
  index.ts

package/contract/src/page/
  page.ts              # rezics/page envelope, parser, defaults
  sections.ts          # section values, schemas, unions
  section-info.ts      # static component info for page components
  index.ts

package/contract/src/dock/
  dock.ts              # rezics/dock envelope, parser, defaults
  widgets.ts           # widget values, schemas, unions
  widget-info.ts       # static component info for dock widgets
  host-policy.ts       # realm/catalog placement policies
  index.ts

package/contract/src/pinboard/
  pinboard.ts          # placement vocabulary + DTO cutover

package/contract/src/zone/
  page-v1.ts           # removed during generic page cutover
  nav-v1.ts            # menu slug/header menuSlug/nodeId cleanup
  menu.ts
```

Frontend shape:

```txt
package/app/src/page/                  # optional shared page renderer layer
  components/
    PageSectionShell.tsx
    PageSectionList.tsx

package/app/src/zone/components/
  sections/                            # can keep feature-local wrappers

package/app/src/dock/                  # optional shared dock renderer layer
  components/
    Dock.tsx
    DockWidgetShell.tsx

package/app/src/realm-dock/            # realm-specific assembly/policy wiring
```

## Tasks

## 1. Replace old proposal assumptions in contract vocabulary

- [ ] 1.1 Add `package/contract/src/schema/vocabulary.ts` documenting the
  durable vocabulary for `id`, `nodeId`, `slug`, `kind`, `placement`,
  `schema`, and `version`.
- [ ] 1.2 Add `package/contract/src/schema/literal-values.ts` or equivalent and
  tests for single-value and multi-value vocabularies.
- [ ] 1.3 Add `schemaNodeIdSchema` and shared node trait helpers only where they
  reduce duplication; avoid one all-fields base object.
- [ ] 1.4 Export the new schema helpers from `package/contract/src/index.ts` only
  if downstream packages need public access.

## 2. Cut page schema from Zone-specific to generic page

- [ ] 2.1 Add `package/contract/src/page/page.ts` with `PAGE_SCHEMA =
  "rezics/page"`, `PAGE_V1_VERSION`, envelope parser, and empty/default helpers.
- [ ] 2.2 Move Zone section schemas from `package/contract/src/zone/section.ts`
  to `package/contract/src/page/sections.ts`, renaming `zone*Section*` public
  schema exports to `page*Section*` unless a shape is truly zone-only.
- [ ] 2.3 Rename section variant discriminants from any remaining `type` fields
  to `kind`, and expose `pageSectionKindValues` /
  `pageSectionKindSchema` / `PageSectionKind`.
- [ ] 2.4 Replace section bare `id` with `nodeId` where stable editor/API target
  identity is required.
- [ ] 2.5 Keep section `slug` optional and use it only for anchors/public local
  locators; do not use it as React key or editor identity.
- [ ] 2.6 Change tabs from `defaultTabId` / tab `id` to
  `defaultTabNodeId` / `nodeId` if default selection targets identity, or
  `defaultTabSlug` / `slug` if default selection is author-facing. Pick one
  based on current UX and lock it with tests.
- [ ] 2.7 Remove `ZoneColumn.id`; columns are layout children ordered by array
  unless a real editor patch target requires `nodeId`.
- [ ] 2.8 Delete the old `package/contract/src/zone/page-v1.ts` schema shape and
  move callers directly to the generic `rezics/page` v1 schema; do not keep
  compatibility exports for the old `rezics/zone-page` envelope.
- [ ] 2.9 Update contract tests for page sections, nesting rules, unknown kinds,
  extra properties, node identity rules, and slug rules.

## 3. Cut Zone nav/menu naming

- [ ] 3.1 Rename `zoneMenu.id` to `slug` and `zoneHeader.menuId` to `menuSlug`
  in `package/contract/src/zone/menu.ts` and `nav-v1.ts`.
- [ ] 3.2 Decide whether `ZoneMenuNode` needs `nodeId`; if yes, make it
  system-minted and update recursive schema/tests; if no, remove persistent node
  identity and validate whole-tree writes.
- [ ] 3.3 Rename `searchPlaceholderKey` to `searchPlaceholderLabelUnitId` if it
  references a label Unit; otherwise introduce a clearer non-persisted i18n
  concept.
- [ ] 3.4 Update server-side nav validators to enforce menu slug uniqueness,
  header menu existence, depth limits, and leaf/group target requirements.
- [ ] 3.5 Update app zone nav renderers/editors and tests for slug/nodeId naming.

## 4. Add generic Dock contract

- [ ] 4.1 Add `package/contract/src/dock/dock.ts` with `DOCK_SCHEMA =
  "rezics/dock"`, versioned envelope parser, and direct `placements` shape.
- [ ] 4.2 Add `package/contract/src/dock/widgets.ts` with
  `dockWidgetKindValues`, `dockWidgetKindSchema`, concrete widget schemas, and
  object-first `dockWidgetSchemas`.
- [ ] 4.3 Cut Realm Dock builtins/custom widgets from `slot + id + widget` to
  direct widget objects with `kind`.
- [ ] 4.4 Replace persisted dock item `id` with `nodeId` where stable widget
  identity is required.
- [ ] 4.5 Rename legacy widget kinds to generic names:
  `text -> richText`, `buttons -> buttonLinks`, `images -> imageLinks`,
  `featuredZone -> featuredUnit`, `communityList -> featuredUnit` with
  `unitType: REALM`, `calendar -> realmCalendar`, `stats -> realmStats`.
- [ ] 4.6 Change `zoneNav.menuId` to `menuSlug`.
- [ ] 4.7 Change pinboard widget `pinboardKey` to `placement`.
- [ ] 4.8 Add tests that direct widget configs accept valid examples and reject
  nested `widget`, `slot`, old `id`, old `key`, unknown `kind`, and extra
  properties.

## 5. Add component registry and host policy

- [ ] 5.1 Add page/dock component info maps keyed by kind, using static metadata
  only: supported surfaces, supported Unit types, reference fields, and query
  behavior.
- [ ] 5.2 Add host-specific Dock placement values:
  `realmDockPlacementValues`, future-ready `catalogDockPlacementValues`, and
  aggregate helpers only for read/tooling paths.
- [ ] 5.3 Add `package/contract/src/dock/host-policy.ts` with realm main/wiki
  widget schemas, required/locked kind lists, max widget counts, and
  host-specific placement validation.
- [ ] 5.4 Add policy tests proving registry support does not bypass host
  placement restrictions.
- [ ] 5.5 Add tests proving REALM main placement keeps required/locked widgets.
- [ ] 5.6 Ensure list/query/stream widget support is policy-gated and not
  implicitly allowed in every Dock placement.

## 6. Cut Pinboard key to placement

- [ ] 6.1 Rename `pinboardHomeKey` / `pinboardKeySchema` /
  `PinboardKey` exports to `realmPinboardPlacementValues` /
  `realmPinboardPlacementSchema` / `RealmPinboardPlacement`.
- [ ] 6.2 Rename Pinboard DTO fields, path params, response fields, API keys,
  and frontend calls from `key` to `placement`.
- [ ] 6.3 Rename `Pinboard.key` DB column and unique index to `placement` in
  `package/server/src/db/schema/pinboard.ts`; generate the Drizzle migration.
- [ ] 6.4 Update server Pinboard service/API/mapper tests and route params from
  `:key` to `:placement`.
- [ ] 6.5 Update app Pinboard editor/list usage and tests.

## 7. Update server and API integration

- [ ] 7.1 Update `package/server/src/zone/` mappers/services to parse and
  validate generic `rezics/page` configs while preserving ZonePage row fields.
- [ ] 7.2 Update zone section data APIs to use `sectionNodeId` where they target
  persisted section identity, and `sectionSlug` only where the route is
  author-facing.
- [ ] 7.3 Update ref-unit collection to traverse generic page sections and dock
  widgets using registry/ref metadata where practical.
- [ ] 7.4 Update seed factories and official zone seeds to generate `nodeId`
  values where required and no longer hand-author semantic `id` fields.
- [ ] 7.5 Update `package/api/src/zone/`, `package/api/src/realm/realm-dock*`,
  and Pinboard query keys/mutations for the new names.

## 8. Update frontend renderers and editors

- [ ] 8.1 Add or refactor shared page section shells so every rendered section
  exposes the required `rezics-page*` classes and `data-rezics-*` attributes.
- [ ] 8.2 Update Zone section lists/renderers to key React elements by `nodeId`
  where present, not `slug`.
- [ ] 8.3 Add or refactor shared Dock/DockWidget shells so every rendered widget
  exposes the required `rezics-dock*` classes and `data-rezics-*` attributes.
- [ ] 8.4 Keep all visual styling token-first; do not move colors/spacing into
  hardcoded custom theme CSS.
- [ ] 8.5 Update realm dock editor to edit direct widget configs, host policy
  locks/requirements, and `nodeId` generation.
- [ ] 8.6 Update zone manage page editors for generic page section names,
  `nodeId`, optional `slug`, menu slug, and no bare IDs.
- [ ] 8.7 Add focused app tests for editor reorder/rename behavior to prove
  `nodeId` and `slug` do not collapse into one concept.

## 9. Add convention enforcement

- [ ] 9.1 Extend `tool/src/commands/convention/check.ts` to reject new persisted
  contract schema fields named bare `key`.
- [ ] 9.2 Reject new JSON config node fields named bare `id` unless an inline
  exemption proves it is a real external/resource identity.
- [ ] 9.3 Reject new persisted component discriminants named bare `type` in
  `package/contract/src/`, except documented external protocol/domain DTOs.
- [ ] 9.4 Require every exported `*KindSchema` and `*PlacementSchema` to have a
  same-prefix `*Values` export.
- [ ] 9.5 Reject exported single-value enum constants that should be `*Values`
  arrays.
- [ ] 9.6 Reject public UI class prefixes `rz-` and `re-`; require `rezics-` for
  new public structural hooks.

## 10. Validation

- [ ] 10.1 Run affected contract tests for schema helpers, page sections, dock
  widgets, host policy, zone nav/menu, and pinboard.
- [ ] 10.2 Run affected server tests for Zone, Realm Dock, Pinboard, seed
  factories, and route params.
- [ ] 10.3 Run affected API tests for Zone, Realm Dock, and Pinboard query keys.
- [ ] 10.4 Run affected app tests for Zone portal/manage editors, Realm Dock
  renderer/editor, and Pinboard UI.
- [ ] 10.5 Run `task check:convention`.
- [ ] 10.6 Run `task check:i18n` if any user-facing copy changes during editor
  updates.

## Out of scope

- ContentDoc redesign. `package/contract/src/content/doc-v1.ts` and
  `doc-v2.ts` need their own follow-up discussion and proposal.
- Preserving old `id`/`key`/`type` JSON shapes for existing development data.
- Introducing a global Dock table or independent page-section/widget relational
  tables.
- Designing a public plugin marketplace or third-party component runtime.
- Replacing Rezics design tokens with arbitrary theme CSS. This proposal only
  adds stable structural hooks for custom themes.
- Browser visual verification. This proposal defines implementation tasks; UI
  verification belongs to the apply work when JSX/CSS changes land.
