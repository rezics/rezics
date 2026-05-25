import type { Prisma } from "#/prisma/client";

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
} satisfies Prisma.UnitExternalRefInclude;

export type UnitExternalRefWithRelations = Prisma.UnitExternalRefGetPayload<{
  include: typeof unitExternalRefInclude;
}>;
