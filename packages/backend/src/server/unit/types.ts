// Type only used in server, otherwise use contract
// 仅在服务端使用的类型，其他情况请使用 contract

import {
  type PublicUserSelected,
  publicUserSelect,
} from "@/utils/sanitizeUser";
import type { Unit, UnitSupportLanguage, UnitTranslation } from "../db/schema";

/**
 * Relation payload shape for unit reads.
 * unit 读取的关联载荷结构。
 */
export const unitInclude = {
  user: { select: publicUserSelect },
  translations: true,
  supportLanguages: true,
} as const;

/**
 * Internal Unit type with relations
 * 携带关联关系的内部 Unit 类型
 */
export type UnitWithRelations = typeof Unit.$inferSelect & {
  user?: PublicUserSelected | null;
  translations: Array<typeof UnitTranslation.$inferSelect>;
  supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
};
