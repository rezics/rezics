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
      user: { select: { unitId: true, slug: true, name: true, avatar: true } },
      translations: true,
      unitTags: { orderBy: { score: "desc" as const } },
    },
  },
} satisfies Prisma.ShelfSelect;

export type ShelfListSelected = Prisma.ShelfGetPayload<{
  select: typeof shelfListSelect;
}>;

// ShelfItem rows are returned as thin rows — no Unit join, no attachment expand.
// Attachments (reviewIds / tagIds) are fetched separately via ShelfUnit projection.
export type ShelfItemRow = Prisma.ShelfItemGetPayload<{}>;
