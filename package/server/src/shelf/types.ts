import type { Prisma } from "#/prisma/client";
import { publicUserSelect } from "@/utils/sanitizeUser";

// Prisma include for shelf metadata. Shelf items are paged separately through
// `GET /shelf/:unitId/units`.
export const shelfInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
      unitTags: { orderBy: { score: "desc" as const } },
    },
  },
} satisfies Prisma.ShelfInclude;

export type ShelfWithMetadata = Prisma.ShelfGetPayload<{
  include: typeof shelfInclude;
}>;

// Lighter select for list queries (no units/relations)
export const shelfListSelect = {
  unitId: true,
  kindKey: true,
  extra: true,
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
      copyrightNotice: true,
      defaultLanguage: true,
      createdAt: true,
      updatedAt: true,
      user: { select: publicUserSelect },
      translations: true,
      unitTags: { orderBy: { score: "desc" as const } },
    },
  },
} satisfies Prisma.ShelfSelect;

export type ShelfListSelected = Prisma.ShelfGetPayload<{
  select: typeof shelfListSelect;
}>;

export type ShelfUnitRow = Prisma.ShelfUnitGetPayload<{}>;
export type ShelfUnitRelationRow = Prisma.ShelfUnitRelationGetPayload<{}>;
