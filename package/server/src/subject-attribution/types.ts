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
    },
  },
} satisfies Prisma.SubjectAttributionInclude;
