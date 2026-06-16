import type { GameSystemRequirement } from "../db/schema";

export type GameSystemRequirementRow =
  typeof GameSystemRequirement.$inferSelect;

export const gameSystemRequirementSelect = {
  id: true,
  gameUnitId: true,
  platformEntityId: true,
  tier: true,
  language: true,
  sourceExternalLinkId: true,
  hardware: true,
  rawText: true,
  createdAt: true,
  updatedAt: true,
} as const;
