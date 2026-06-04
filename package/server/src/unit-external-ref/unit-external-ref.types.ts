import type { UnitExternalRef } from "../db/schema";

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
    sourceSite?: unknown | null;
  };
