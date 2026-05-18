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
} satisfies Prisma.CreditAttributionInclude;
