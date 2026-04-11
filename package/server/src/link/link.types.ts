import type { Prisma } from "#/prisma/client";

export const linkInclude = {
  unit: {
    include: {
      translations: true,
    },
  },
} satisfies Prisma.LinkInclude;

export type LinkWithRelations = Prisma.LinkGetPayload<{
  include: typeof linkInclude;
}>;
