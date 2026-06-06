import {
  type PublicUserSelected,
  publicUserSelect,
} from "@/utils/sanitizeUser";
import type {
  Shelf,
  ShelfItem,
  Unit,
  UnitTag,
  UnitTranslation,
} from "../db/schema";

// Relation payload shape for shelf metadata. Shelf items are paged separately through
// `GET /shelf/:unitId/items`.
export const shelfInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
      unitTags: { orderBy: { score: "desc" as const } },
    },
  },
} as const;

export type ShelfWithMetadata = typeof Shelf.$inferSelect & {
  unit: typeof Unit.$inferSelect & {
    user?: PublicUserSelected | null;
    translations: Array<typeof UnitTranslation.$inferSelect>;
    unitTags: Array<typeof UnitTag.$inferSelect>;
  };
};

// Lighter select for list queries (no units/relations)
export const shelfListSelect = {
  unitId: true,
  kindKey: true,
  extra: true,
  rootItemCount: true,
  itemCount: true,
  createdAt: true,
  updatedAt: true,
  unit: {
    select: {
      id: true,
      slug: true,
      userId: true,
      status: true,
      visibility: true,
      licenseSlug: true,
      defaultLanguage: true,
      createdAt: true,
      updatedAt: true,
      user: { select: publicUserSelect },
      translations: true,
      unitTags: { orderBy: { score: "desc" as const } },
    },
  },
} as const;

export type ShelfListSelected = Pick<
  typeof Shelf.$inferSelect,
  | "unitId"
  | "kindKey"
  | "extra"
  | "rootItemCount"
  | "itemCount"
  | "createdAt"
  | "updatedAt"
> & {
  unit: Pick<
    typeof Unit.$inferSelect,
    | "id"
    | "slug"
    | "userId"
    | "status"
    | "visibility"
    | "licenseSlug"
    | "defaultLanguage"
    | "createdAt"
    | "updatedAt"
  > & {
    user?: PublicUserSelected | null;
    translations: Array<typeof UnitTranslation.$inferSelect>;
    unitTags: Array<typeof UnitTag.$inferSelect>;
  };
};

export type ShelfItemRow = typeof ShelfItem.$inferSelect;
