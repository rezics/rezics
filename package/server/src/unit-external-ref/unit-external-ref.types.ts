import type { UnitExternalRef } from "../db/schema";
import type { SourceSiteWithRelations } from "../source-site/source-site.types";

export const unitExternalRefInclude = {
  sourceSite: {
    include: {
      entity: {
        include: {
          unit: {
            include: {
              translations: true,
            },
          },
        },
      },
    },
  },
} as const;

export type UnitExternalRefWithRelations =
  typeof UnitExternalRef.$inferSelect & {
    sourceSite?: SourceSiteWithRelations | null;
  };
