import type { Prisma } from "#/prisma/client";

export const sourceSiteInclude = {
  entity: {
    include: {
      unit: {
        include: {
          translations: true,
        },
      },
    },
  },
} satisfies Prisma.SourceSiteInclude;

export type SourceSiteWithRelations = Prisma.SourceSiteGetPayload<{
  include: typeof sourceSiteInclude;
}>;
