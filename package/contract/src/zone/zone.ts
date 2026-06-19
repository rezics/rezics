import type { Static } from "elysia";
import { t } from "elysia";
import { contentDocSchema } from "../content/doc-v1";
import { contentLanguageSchema } from "../language";
import { readLanguageGetQueryBase } from "../list-query-base";
import { type Page, pageV1Schema } from "../pages";
import { paginationLimitSchema } from "../pagination";
import { streamRowSchema, type StreamRow } from "../stream/stream";
import { unitTypeSchema } from "../unit/unit";
import { type ZoneBoundary, zoneBoundaryV1Schema } from "./boundary-v1";
import { type ZoneNav, zoneNavV1Schema } from "./nav-v1";
import { type ZoneTheme, zoneThemeV1Schema } from "./theme-v1";

// ANCHOR: Zone DTO
// ANCHOR: 专区 DTO

export const zoneTranslationSchema = t.Object(
  {
    language: contentLanguageSchema,
    title: t.Optional(t.String()),
    description: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export type ZoneTranslation = Static<typeof zoneTranslationSchema>;

export const zonePageSummarySchema = t.Object(
  {
    id: t.String(),
    slug: t.String(),
    position: t.String(), // Fractional Indexing
  },
  { additionalProperties: false },
);

export type ZonePageSummary = Static<typeof zonePageSummarySchema>;

export const zoneDTOSchema = t.Object({
  unitId: t.String(),
  ownerRealmUnitId: t.String(),
  slug: t.String(),
  name: t.String(),
  description: t.Optional(t.Nullable(t.String())),
  // Full translation array so the manage profile editor can edit every
  // language row, not just the resolved one.
  // 完整译文数组，使管理页的资料编辑器可以编辑每个语言行，而不只是
  // 已解析的那一行。
  translations: t.Array(zoneTranslationSchema),
  boundary: zoneBoundaryV1Schema,
  nav: zoneNavV1Schema,
  theme: zoneThemeV1Schema,
  homePageId: t.String(),
  pages: t.Array(zonePageSummarySchema),
  startsAt: t.Optional(t.Nullable(t.String())),
  endsAt: t.Optional(t.Nullable(t.String())),
});

export type ZoneDTO = Omit<
  Static<typeof zoneDTOSchema>,
  "boundary" | "nav" | "theme"
> & {
  boundary: ZoneBoundary;
  nav: ZoneNav;
  theme: ZoneTheme;
};

export const zoneListViewSchema = t.Union([
  t.Literal("subscribed"),
  t.Literal("managing"),
]);

export type ZoneListView = Static<typeof zoneListViewSchema>;

export const zoneListQuerySchema = t.Object({
  ...readLanguageGetQueryBase.properties,
  view: t.Optional(zoneListViewSchema),
  start: t.Optional(t.Numeric()),
  limit: paginationLimitSchema,
});

export type ZoneListQuery = Static<typeof zoneListQuerySchema>;

export const zoneListResponseSchema = t.Object({
  zones: t.Array(zoneDTOSchema),
  total: t.Optional(t.Number()),
});

export type ZoneListResponse = Omit<
  Static<typeof zoneListResponseSchema>,
  "zones"
> & {
  zones: ZoneDTO[];
};

// ANCHOR: Zone write inputs
// ANCHOR: 专区写入输入

export const createZoneInputSchema = t.Object(
  {
    slug: t.String({ minLength: 1 }),
    ownerRealmUnitId: t.String(),
    translations: t.Array(zoneTranslationSchema, { minItems: 1 }),
    boundary: zoneBoundaryV1Schema,
    nav: zoneNavV1Schema,
    theme: zoneThemeV1Schema,
    homePage: pageV1Schema,
    homePageSlug: t.Optional(t.String({ minLength: 1 })),
    startsAt: t.Optional(t.Nullable(t.String())),
    endsAt: t.Optional(t.Nullable(t.String())),
  },
  { additionalProperties: false },
);

export type CreateZoneInput = Omit<
  Static<typeof createZoneInputSchema>,
  "boundary" | "nav" | "theme" | "homePage"
> & {
  boundary: ZoneBoundary;
  nav: ZoneNav;
  theme: ZoneTheme;
  homePage: Page;
};

/**
 * Update edits zone identity too: `translations` upserts `UnitTranslation`
 * + `UnitSupportLanguage`, so title/description stay editable after
 * creation.
 * 更新同样编辑专区身份：`translations` 会 upsert `UnitTranslation` +
 * `UnitSupportLanguage`，因此标题/描述在创建后仍可编辑。
 */
export const updateZoneInputSchema = t.Object(
  {
    ownerRealmUnitId: t.Optional(t.String()),
    translations: t.Optional(t.Array(zoneTranslationSchema, { minItems: 1 })),
    startsAt: t.Optional(t.Nullable(t.String())),
    endsAt: t.Optional(t.Nullable(t.String())),
  },
  { additionalProperties: false },
);

export type UpdateZoneInput = Static<typeof updateZoneInputSchema>;

export const updateZoneBoundaryInputSchema = t.Object(
  { boundary: zoneBoundaryV1Schema },
  { additionalProperties: false },
);

export type UpdateZoneBoundaryInput = Omit<
  Static<typeof updateZoneBoundaryInputSchema>,
  "boundary"
> & { boundary: ZoneBoundary };

export const updateZoneNavInputSchema = t.Object(
  { nav: zoneNavV1Schema },
  { additionalProperties: false },
);

export type UpdateZoneNavInput = Omit<
  Static<typeof updateZoneNavInputSchema>,
  "nav"
> & { nav: ZoneNav };

export const updateZoneThemeInputSchema = t.Object(
  { theme: zoneThemeV1Schema },
  { additionalProperties: false },
);

export type UpdateZoneThemeInput = Omit<
  Static<typeof updateZoneThemeInputSchema>,
  "theme"
> & { theme: ZoneTheme };

export const createZonePageInputSchema = t.Object(
  {
    slug: t.String({ minLength: 1 }),
    position: t.Optional(t.String()), // Fractional Indexing
    config: pageV1Schema,
  },
  { additionalProperties: false },
);

export type CreateZonePageInput = Omit<
  Static<typeof createZonePageInputSchema>,
  "config"
> & { config: Page };

export const updateZonePageInputSchema = t.Object(
  {
    slug: t.Optional(t.String({ minLength: 1 })),
    position: t.Optional(t.String()), // Fractional Indexing
    config: t.Optional(pageV1Schema),
  },
  { additionalProperties: false },
);

export type UpdateZonePageInput = Omit<
  Static<typeof updateZonePageInputSchema>,
  "config"
> & { config?: Page };

// ANCHOR: Zone portal read shapes
// ANCHOR: 专区门户读取形态

/**
 * Batch summary for every unit the config references (labels, images, menu
 * and collection targets, context realm). The portal read returns the zone
 * plus this map; list data hydrates lazily per section id.
 * 配置引用的每个 Unit（标签、图片、菜单与集合目标、语境 realm）的批量
 * 摘要。门户读取返回专区加此映射；列表数据按分区 id 惰性水合。
 */
export const zoneRefUnitSummarySchema = t.Object({
  unitId: t.String(),
  type: unitTypeSchema,
  slug: t.Optional(t.Nullable(t.String())),
  title: t.Nullable(t.String()),
  summary: t.Optional(t.Nullable(t.String())),
  language: t.Optional(t.Nullable(contentLanguageSchema)),
  imageUrl: t.Optional(t.Nullable(t.String())),
  postKind: t.Optional(t.Nullable(t.String())),
  entityKind: t.Optional(t.Nullable(t.String())),
});

export type ZoneRefUnitSummary = Static<typeof zoneRefUnitSummarySchema>;

export const zonePortalResponseSchema = t.Object({
  zone: zoneDTOSchema,
  page: t.Object(
    {
      id: t.String(),
      slug: t.String(),
      position: t.String(), // Fractional Indexing
      config: pageV1Schema,
    },
    { additionalProperties: false },
  ),
  refUnits: t.Record(t.String(), zoneRefUnitSummarySchema),
});

export type ZonePortalResponse = Omit<
  Static<typeof zonePortalResponseSchema>,
  "zone" | "page"
> & {
  zone: ZoneDTO;
  page: ZonePageSummary & { config: Page };
};

// ANCHOR: Zone section data
// ANCHOR: 专区分区数据

export const zoneSectionItemSchema = t.Object({
  unitId: t.String(),
  type: unitTypeSchema,
  slug: t.Optional(t.Nullable(t.String())),
  title: t.Nullable(t.String()),
  summary: t.Optional(t.Nullable(t.String())),
  language: t.Optional(t.Nullable(contentLanguageSchema)),
  imageUrl: t.Optional(t.Nullable(t.String())),
  postKind: t.Optional(t.Nullable(t.String())),
  entityKind: t.Optional(t.Nullable(t.String())),
  createdAt: t.Optional(t.String()),
  updatedAt: t.Optional(t.String()),
});

export type ZoneSectionItem = Static<typeof zoneSectionItemSchema>;

export const zoneStatsDataSchema = t.Object({
  articles: t.Optional(t.Number()),
  members: t.Optional(t.Number()),
});

export type ZoneStatsData = Static<typeof zoneStatsDataSchema>;

export const zoneSectionDataSchema = t.Object({
  pageId: t.String(),
  sectionId: t.String(),
  items: t.Array(zoneSectionItemSchema),
  rows: t.Optional(t.Array(streamRowSchema)),
  // richText sections only: the fragment's resolved ContentTranslation doc.
  // 仅 richText 分区：片段已解析的 ContentTranslation 文档。
  doc: t.Optional(t.Nullable(contentDocSchema)),
  docLanguage: t.Optional(t.Nullable(contentLanguageSchema)),
  // stats sections only.
  // 仅 stats 分区。
  stats: t.Optional(zoneStatsDataSchema),
  nextCursor: t.Nullable(t.String()),
});

export type ZoneSectionData = Static<typeof zoneSectionDataSchema>;
export type ZoneSectionStreamData = Omit<ZoneSectionData, "rows"> & {
  rows?: StreamRow[];
};
