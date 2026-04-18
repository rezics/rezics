import type { Prisma } from "#/prisma/client";
import { publicUserSelect } from "@/utils/sanitizeUser";

// Prisma include for shelf detail (with items in position order; no Unit expand)
export const shelfInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
      unitTags: { orderBy: { score: "desc" as const } },
    },
  },
  items: {
    orderBy: { position: "asc" as const },
  },
} satisfies Prisma.ShelfInclude;

export type ShelfWithRelations = Prisma.ShelfGetPayload<{
  include: typeof shelfInclude;
}>;

// Lighter select for list queries (no items)
export const shelfListSelect = {
  unitId: true,
  kindKey: true,
  coverUrl: true,
  extra: true,
  createdAt: true,
  updatedAt: true,
  unit: {
    select: {
      id: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { unitId: true, slug: true, name: true, avatar: true } },
      translations: true,
      unitTags: { orderBy: { score: "desc" as const } },
    },
  },
  _count: { select: { items: true } },
} satisfies Prisma.ShelfSelect;

export type ShelfListSelected = Prisma.ShelfGetPayload<{
  select: typeof shelfListSelect;
}>;

// Shelf items are returned as thin rows — no Unit join, no junction table.
export const shelfItemInclude = {} satisfies Prisma.ShelfItemInclude;

export type ShelfItemWithRelations = Prisma.ShelfItemGetPayload<{
  include: typeof shelfItemInclude;
}>;
