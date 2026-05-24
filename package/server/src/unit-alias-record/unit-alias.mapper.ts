import type { UnitAliasDTO, UnitAliasVoteDTO } from "@rezics/contract";
import type { UnitAlias, UnitAliasVote } from "#/prisma/client";

export function mapUnitAliasToDTO(
  alias: UnitAlias,
  options?: { belowVisibilityThreshold?: boolean },
): UnitAliasDTO {
  return {
    id: alias.id,
    unitId: alias.unitId,
    value: alias.value,
    normalizedValue: alias.normalizedValue,
    language: alias.language ?? null,
    kind: alias.kind,
    status: alias.status,
    score: alias.score,
    voteCount: alias.voteCount,
    pinned: alias.pinned,
    position: alias.position ?? null,
    createdById: alias.createdById ?? null,
    updatedById: alias.updatedById ?? null,
    ...(options?.belowVisibilityThreshold
      ? { belowVisibilityThreshold: true }
      : {}),
    createdAt: alias.createdAt.toISOString(),
    updatedAt: alias.updatedAt.toISOString(),
  };
}

export function mapUnitAliasVoteToDTO(vote: UnitAliasVote): UnitAliasVoteDTO {
  return {
    aliasId: vote.aliasId,
    userId: vote.userId,
    value: vote.value,
    createdAt: vote.createdAt.toISOString(),
    updatedAt: vote.updatedAt.toISOString(),
  };
}
