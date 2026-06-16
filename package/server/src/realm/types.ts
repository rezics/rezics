import {
  type PublicUserSelected,
  publicUserSelect,
} from "@/utils/sanitizeUser";
import type {
  Realm,
  RealmMember,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";

// Relation payload shape for realm metadata.
// realm 元数据的关联载荷结构。
export const realmInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
      supportLanguages: true,
    },
  },
  members: true,
} as const;

// Internal realm type with relations
// 携带关联关系的内部 realm 类型
export type RealmWithRelations = typeof Realm.$inferSelect & {
  unit: typeof Unit.$inferSelect & {
    user?: PublicUserSelected | null;
    translations: Array<typeof UnitTranslation.$inferSelect>;
    supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
  };
  members?: Array<typeof RealmMember.$inferSelect>;
};

// Lighter select for list queries (no members)
// 用于列表查询的精简 select（不含 members）
export const realmListSelect = {
  unitId: true,
  isPublic: true,
  isOfficial: true,
  contentRequiresApproval: true,
  memberCount: true,
  extra: true,
  createdAt: true,
  updatedAt: true,
  unit: {
    select: {
      id: true,
      slug: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      user: { select: publicUserSelect },
      translations: true,
      supportLanguages: true,
    },
  },
} as const;

export type RealmListSelected = Pick<
  typeof Realm.$inferSelect,
  | "unitId"
  | "isPublic"
  | "isOfficial"
  | "contentRequiresApproval"
  | "memberCount"
  | "extra"
  | "createdAt"
  | "updatedAt"
> & {
  unit: Pick<
    typeof Unit.$inferSelect,
    "id" | "slug" | "userId" | "createdAt" | "updatedAt"
  > & {
    user?: PublicUserSelected | null;
    translations: Array<typeof UnitTranslation.$inferSelect>;
    supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
  };
};
