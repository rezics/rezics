import type { GameSystemRequirementDTO } from "@rezics/contract";
import type { GameSystemRequirementRow } from "./types";

export function mapGameSystemRequirementToDTO(
  row: GameSystemRequirementRow,
): GameSystemRequirementDTO {
  return {
    id: row.id,
    gameUnitId: row.gameUnitId,
    platformEntityId: row.platformEntityId,
    tier: row.tier as GameSystemRequirementDTO["tier"],
    language: row.language as GameSystemRequirementDTO["language"],
    sourceExternalLinkId: row.sourceExternalLinkId,
    hardware: row.hardware as unknown as GameSystemRequirementDTO["hardware"],
    rawText: row.rawText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
