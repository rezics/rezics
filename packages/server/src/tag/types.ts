// Types only used in server for Tag (scored UnitTag system)
// 仅在服务端用于 Tag 的类型（带评分的 UnitTag 系统）

import type { Unit, UnitTag, UnitTranslation } from "../db/schema";

/**
 * A tag Unit with its translations.
 * Tags are Units with type=TAG, isLanguageNeutral=true.
 * 带翻译的 tag Unit。
 * Tag 是 type=TAG、isLanguageNeutral=true 的 Unit。
 */
export type TagWithTranslations = typeof Unit.$inferSelect & {
  translations: Array<typeof UnitTranslation.$inferSelect>;
};

/**
 * A UnitTag junction row with the tag Unit and its translations resolved.
 * 已解析出 tag Unit 及其翻译的 UnitTag 关联行。
 */
export type UnitTagWithRelations = typeof UnitTag.$inferSelect & {
  tag: typeof Unit.$inferSelect & {
    translations: Array<typeof UnitTranslation.$inferSelect>;
  };
};

/**
 * Relation payload shape for fetching a tag Unit with translations.
 * 用于获取带翻译的 tag Unit 的关联载荷结构。
 */
export const tagUnitInclude = {
  translations: true,
} as const;

/**
 * Relation payload shape for fetching UnitTag rows with tag labels.
 * 用于获取带 tag 标签的 UnitTag 行的关联载荷结构。
 */
export const unitTagInclude = {
  tag: {
    include: { translations: true },
  },
} as const;
