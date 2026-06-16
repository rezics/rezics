import type { Static } from "elysia";
import { t } from "elysia";
import { type ZoneMenu, zoneMenuSchema } from "./menu";
import { zonePageSectionSchema, zoneSectionQuerySchema } from "./section";

// ANCHOR: Zone config envelope v1
// ANCHOR: 专区配置信封 v1

export const ZONE_CONFIG_SCHEMA = "rezics/zone-config" as const;
export const ZONE_CONFIG_V1_VERSION = 1 as const;

/**
 * Authority vs context: `Zone.ownerRealmUnitId` (table column, FK) is
 * permission authority only. `config.context` is interaction defaults only
 * (section query inheritance, create-CTA target, comment selector default).
 * They may differ: official zones are owned by the rezics realm with global
 * context.
 * 权限与语境：`Zone.ownerRealmUnitId`（表列，外键）只承担权限归属。
 * `config.context` 只承担交互默认值（分区查询继承、创建 CTA 目标、评论
 * 选择器默认值）。两者可以不同：官方专区由 rezics realm 拥有但语境为
 * global。
 */
export const zoneContextSchema = t.Union([
  t.Object(
    {
      kind: t.Literal("global"),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      kind: t.Literal("realm"),
      realmUnitId: t.String(),
    },
    { additionalProperties: false },
  ),
]);

export type ZoneContext = Static<typeof zoneContextSchema>;

/**
 * The `ZoneSectionQuery` filter vocabulary minus `sort` and `target`. An
 * unremovable boundary intersected with every zone query section, zone
 * search, and zone feed; section queries and user filters only narrow
 * within it.
 * `ZoneSectionQuery` 的过滤词汇表，去掉 `sort` 与 `target`。一个不可移除
 * 的边界，与每个专区查询分区、专区搜索、专区 feed 取交集；分区查询与
 * 用户过滤只能在其内部收窄。
 */
export const zoneBoundaryFilterSchema = t.Object(
  {
    types: zoneSectionQuerySchema.properties.types,
    postKinds: zoneSectionQuerySchema.properties.postKinds,
    realm: zoneSectionQuerySchema.properties.realm,
    tagUnitIds: zoneSectionQuerySchema.properties.tagUnitIds,
    realmTagUnitIds: zoneSectionQuerySchema.properties.realmTagUnitIds,
    subjects: zoneSectionQuerySchema.properties.subjects,
    targetUnitId: zoneSectionQuerySchema.properties.targetUnitId,
    languages: zoneSectionQuerySchema.properties.languages,
    ratings: zoneSectionQuerySchema.properties.ratings,
  },
  { additionalProperties: false },
);

export type ZoneBoundaryFilter = Static<typeof zoneBoundaryFilterSchema>;

export const zoneHeaderSchema = t.Object(
  {
    menuId: t.String(),
    logoImageUnitId: t.Optional(t.String()),
    searchPlaceholderKey: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export type ZoneHeader = Static<typeof zoneHeaderSchema>;

export const zonePageSchema = t.Object(
  {
    sections: t.Array(zonePageSectionSchema),
  },
  { additionalProperties: false },
);

export type ZonePage = Static<typeof zonePageSchema>;

export const zonePagesSchema = t.Object(
  {
    home: zonePageSchema,
    search: t.Optional(zonePageSchema),
    feed: t.Optional(zonePageSchema),
  },
  { additionalProperties: false },
);

export type ZonePages = Static<typeof zonePagesSchema>;

export const zoneThemeSchema = t.Object(
  {
    tokens: t.Optional(
      t.Object(
        {
          background: t.Optional(t.String()),
          surface: t.Optional(t.String()),
          text: t.Optional(t.String()),
          mutedText: t.Optional(t.String()),
          accent: t.Optional(t.String()),
          accentText: t.Optional(t.String()),
        },
        { additionalProperties: false },
      ),
    ),
    images: t.Optional(
      t.Object(
        {
          logoUnitId: t.Optional(t.String()),
          bannerUnitId: t.Optional(t.String()),
          backgroundUnitId: t.Optional(t.String()),
        },
        { additionalProperties: false },
      ),
    ),
    layout: t.Optional(
      t.Object(
        {
          contentWidth: t.Optional(
            t.Union([t.Literal("normal"), t.Literal("wide")]),
          ),
          density: t.Optional(
            t.Union([t.Literal("compact"), t.Literal("comfortable")]),
          ),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export type ZoneTheme = Static<typeof zoneThemeSchema>;

/**
 * One self-describing versioned document stored in the single `Zone.config`
 * jsonb column (same envelope mechanism as `content/doc-v1.ts`). Contains
 * only ids and i18n keys — never human-language strings (zero-inline-text;
 * sole exception documented on `ZoneLinkTarget.external.text`). Unlike
 * `contentDocWriteSchema`'s opaque acceptance, zone config is admin config,
 * not user content: write paths validate this latest version strictly
 * (`additionalProperties: false`), read paths accept every historical
 * version and normalize through `upgradeZoneConfig()`.
 * 存放在单一 `Zone.config` jsonb 列中的自描述版本化文档（与
 * `content/doc-v1.ts` 相同的信封机制）。只包含 id 与 i18n key——绝不
 * 包含人类语言字符串（零内联文本；唯一例外见
 * `ZoneLinkTarget.external.text` 上的说明）。与 `contentDocWriteSchema`
 * 的不透明接受不同，专区配置是管理配置而非用户内容：写入路径对该最新
 * 版本严格校验（`additionalProperties: false`），读取路径接受所有历史
 * 版本并通过 `upgradeZoneConfig()` 归一化。
 */
export const zoneConfigV1Schema = t.Object(
  {
    schema: t.Literal(ZONE_CONFIG_SCHEMA),
    version: t.Literal(ZONE_CONFIG_V1_VERSION),
    context: zoneContextSchema,
    filters: zoneBoundaryFilterSchema,
    menus: t.Array(zoneMenuSchema),
    header: zoneHeaderSchema,
    pages: zonePagesSchema,
    theme: zoneThemeSchema,
  },
  { additionalProperties: false },
);

// `zoneMenuNodeSchema` is recursive, so its inferred static type degrades to
// `unknown`; substitute the hand-written `ZoneMenu` interface.
// `zoneMenuNodeSchema` 是递归 schema，其推断的 static 类型会退化为
// `unknown`；以手写的 `ZoneMenu` 接口替换。
export type ZoneConfigV1 = Omit<Static<typeof zoneConfigV1Schema>, "menus"> & {
  menus: ZoneMenu[];
};
