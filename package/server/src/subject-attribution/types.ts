import type { Prisma } from "#/prisma/client";

export type SubjectAttributionWithRelations =
  Prisma.SubjectAttributionGetPayload<{
    include: typeof subjectAttributionInclude;
  }>;

export const subjectAttributionInclude = {
  entity: {
    include: {
      entity: true,
      translations: true,
    },
  },
  unit: {
    include: {
      translations: true,
      supportLanguages: true,
      workMemberships: {
        where: { role: "RELEASE" },
        select: { workUnitId: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  },
} satisfies Prisma.SubjectAttributionInclude;
