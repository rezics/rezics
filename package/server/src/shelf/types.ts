import type { Prisma } from "#/prisma/client";
import { publicUserSelect } from "@/utils/sanitizeUser";

// Prisma include for shelf detail (with units in position order and relations).
export const shelfInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
      unitTags: { orderBy: { score: "desc" as const } },
    },
  },
  units: {
    orderBy: { position: "asc" as const },
  },
  relations: true,
} satisfies Prisma.ShelfInclude;

export type ShelfWithRelations = Prisma.ShelfGetPayload<{
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
      userId: true,
      defaultLanguage: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { userId: true, slug: true, name: true, avatar: true } },
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
