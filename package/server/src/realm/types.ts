import type {
  Realm,
  RealmMember,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../db/schema";
import {
  publicUserSelect,
  type PublicUserSelected,
} from "@/utils/sanitizeUser";

// Prisma include for realm relations
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
export type RealmWithRelations = typeof Realm.$inferSelect & {
  unit: typeof Unit.$inferSelect & {
    user?: PublicUserSelected | null;
    translations: Array<typeof UnitTranslation.$inferSelect>;
    supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
  };
  members?: Array<typeof RealmMember.$inferSelect>;
};

// Lighter select for list queries (no members)
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
