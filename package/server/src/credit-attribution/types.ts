import type { Prisma } from "#/prisma/client";

export type CreditAttributionWithRelations =
  Prisma.CreditAttributionGetPayload<{
    include: typeof creditAttributionInclude;
  }>;

export const creditAttributionInclude = {
  entity: {
    include: {
      entity: true,
      translations: true,
    },
  },
  evidence: {
    include: {
      sourceRef: {
        include: {
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
        },
      },
    },
    orderBy: [{ observedAt: "desc" }],
  },
} satisfies Prisma.CreditAttributionInclude;
