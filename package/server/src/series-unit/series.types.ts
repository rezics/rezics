import type { Prisma } from "#/prisma/client";
import { publicUserSelect } from "@/utils/sanitizeUser";

export const seriesInclude = {
  unit: {
    include: {
      user: { select: publicUserSelect },
      translations: true,
      supportLanguages: true,
    },
  },
  _count: {
    select: { directReleaseIndexRows: true },
  },
} satisfies Prisma.SeriesInclude;

export type SeriesWithRelations = Prisma.SeriesGetPayload<{
  include: typeof seriesInclude;
}>;

export const seriesOrderBy = [
  { updatedAt: "desc" as const },
  { unitId: "asc" as const },
] satisfies Prisma.SeriesOrderByWithRelationInput[];
