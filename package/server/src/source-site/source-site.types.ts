import type { SourceSite } from "../db/schema";

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
} as const;

export type SourceSiteWithRelations = typeof SourceSite.$inferSelect & {
  entity?: unknown | null;
};
