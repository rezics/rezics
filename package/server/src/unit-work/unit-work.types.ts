import type { Prisma } from "#/prisma/client";

export const unitWorkOrderBy = [
  { position: "asc" },
  { createdAt: "asc" },
  { unitId: "asc" },
] satisfies Prisma.UnitWorkOrderByWithRelationInput[];
