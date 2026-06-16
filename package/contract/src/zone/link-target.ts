import type { Static } from "elysia";
import { t } from "elysia";

// ANCHOR: Zone link target
// ANCHOR: 专区链接目标

export const zonePageIdSchema = t.Union([
  t.Literal("home"),
  t.Literal("search"),
  t.Literal("feed"),
]);

export type ZonePageId = Static<typeof zonePageIdSchema>;

/**
 * Navigation target shared by zone menus, collections, and hero CTAs.
 * `external.text` is the single deliberate exception to the zone
 * zero-inline-text rule: a plain untranslated string (e.g. a QQ group
 * number), never a translation map. Every other label resolves through
 * LABEL units or the target unit's own translations.
 * 专区菜单、集合与 hero CTA 共享的导航目标。`external.text` 是专区
 * 零内联文本规则的唯一例外：一个不翻译的纯字符串（例如 QQ 群号），
 * 绝不是翻译映射。其他所有标签都通过 LABEL Unit 或目标 Unit 自身的
 * 译文解析。
 */
export const zoneLinkTargetSchema = t.Union([
  t.Object(
    {
      kind: t.Literal("unit"),
      unitId: t.String(),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      kind: t.Literal("zonePage"),
      pageId: zonePageIdSchema,
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      kind: t.Literal("external"),
      url: t.String(),
      text: t.String(),
    },
    { additionalProperties: false },
  ),
]);

export type ZoneLinkTarget = Static<typeof zoneLinkTargetSchema>;
