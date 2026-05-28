import type { Prisma } from "#/prisma/client";

export const gameLibraryInclude = {
  unit: {
    include: {
      translations: true,
      workMemberships: {
        where: { role: "RELEASE" },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
      },
      subjectAttributions: {
        where: { role: "available_on" },
        orderBy: { sortOrder: "asc" as const },
      },
      unitTags: {
        include: {
          tag: { select: { id: true, slug: true } },
        },
      },
      ownedContentStructure: {
        include: {
          contentNodes: true,
        },
      },
    },
  },
  systemRequirements: {
    orderBy: [{ platformEntityId: "asc" as const }, { tier: "asc" as const }],
  },
} satisfies Prisma.GameInclude;

export type GameLibraryRow = Prisma.GameGetPayload<{
  include: typeof gameLibraryInclude;
}>;

export const mediaLibraryInclude = {
  unit: {
    include: {
      translations: true,
      workMemberships: {
        where: { role: "RELEASE" },
        orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
      },
      unitTags: {
        include: {
          tag: { select: { id: true, slug: true } },
        },
      },
      ownedContentStructure: {
        include: {
          contentNodes: true,
        },
      },
    },
  },
} satisfies Prisma.MediaInclude;

export type MediaLibraryRow = Prisma.MediaGetPayload<{
  include: typeof mediaLibraryInclude;
}>;
