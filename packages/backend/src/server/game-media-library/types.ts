import type {
  ContentStructure,
  ContentStructureNode,
  Game,
  GameSystemRequirement,
  Media,
  SubjectAttribution,
  Unit,
  UnitTag,
  UnitTranslation,
} from "../db/schema";

export const gameLibraryInclude = {
  unit: {
    include: {
      translations: true,
      subjectAttributions: {
        where: { role: "available_on" },
        orderBy: { position: "asc" as const },
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
} as const;

type UnitTagWithSlug = typeof UnitTag.$inferSelect & {
  tag?: Pick<typeof Unit.$inferSelect, "id" | "slug">;
};

type OwnedContentStructureWithNodes = typeof ContentStructure.$inferSelect & {
  contentNodes: Array<typeof ContentStructureNode.$inferSelect>;
};

export type GameLibraryRow = typeof Game.$inferSelect & {
  unit: typeof Unit.$inferSelect & {
    translations: Array<typeof UnitTranslation.$inferSelect>;
    subjectAttributions: Array<typeof SubjectAttribution.$inferSelect>;
    unitTags: Array<UnitTagWithSlug>;
    ownedContentStructure?: OwnedContentStructureWithNodes | null;
  };
  systemRequirements: Array<typeof GameSystemRequirement.$inferSelect>;
};

export const mediaLibraryInclude = {
  unit: {
    include: {
      translations: true,
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
} as const;

export type MediaLibraryRow = typeof Media.$inferSelect & {
  unit: typeof Unit.$inferSelect & {
    translations: Array<typeof UnitTranslation.$inferSelect>;
    unitTags: Array<UnitTagWithSlug>;
    ownedContentStructure?: OwnedContentStructureWithNodes | null;
  };
};
