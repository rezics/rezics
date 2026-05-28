import type { Prisma } from "#/prisma/client";

export type GameSystemRequirementRow = Prisma.GameSystemRequirementGetPayload<{
  select: {
    id: true;
    gameUnitId: true;
    platformEntityId: true;
    tier: true;
    language: true;
    sourceRefId: true;
    hardware: true;
    rawText: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

export const gameSystemRequirementSelect = {
  id: true,
  gameUnitId: true,
  platformEntityId: true,
  tier: true,
  language: true,
  sourceRefId: true,
  hardware: true,
  rawText: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GameSystemRequirementSelect;
