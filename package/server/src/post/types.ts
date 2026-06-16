import type { PinKind } from "@rezics/contract";
import {
  type PublicUserSelected,
  publicUserSelect,
} from "@/utils/sanitizeUser";
import type {
  ContentTranslation,
  Post,
  Unit,
  UnitRealm,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";

/**
 * Legacy include shape retained for tests while post service migrates.
 * 在 post service 迁移期间为测试保留的旧版 include 结构。
 */
export const postInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
      contentTranslations: true,
      supportLanguages: true,
      inRealms: {
        where: { moderationStatus: "APPROVED" },
        select: { realmUnitId: true },
        take: 1,
      },
    },
  },
} as const;

/**
 * Internal post type with relations.
 *
 * Root post title/body are resolved from UnitTranslation and ContentTranslation.
 *
 * `pinKind`/`pinPosition` are the promotion overlay for the rendered thread
 * scope, attached by the thread read (`attachPinKinds`).
 *
 * 带关联关系的内部 post 类型。
 *
 * 根 post 的 title/body 从 UnitTranslation 与 ContentTranslation 解析得到。
 *
 * `pinKind`/`pinPosition` 是渲染线程范围内的置顶叠加层，由线程读取
 * （`attachPinKinds`）附加。
 */
export type PostWithRelations = typeof Post.$inferSelect & {
  unit: typeof Unit.$inferSelect & {
    user?: PublicUserSelected | null;
    translations: Array<typeof UnitTranslation.$inferSelect>;
    contentTranslations: Array<typeof ContentTranslation.$inferSelect>;
    supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
    inRealms?: Array<Pick<typeof UnitRealm.$inferSelect, "realmUnitId">>;
  };
  pinKind?: PinKind | null;
  pinPosition?: string | null;
  /**
   * Internal serving cursor value for the active list sort; not a DTO field.
   * 当前列表排序的内部服务游标值；并非 DTO 字段。
   */
  feedSortValue?: number | string | null;
};
