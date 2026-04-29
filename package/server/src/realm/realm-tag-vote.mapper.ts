import type { RealmTagVoteDTO } from "@rezics/contract";
import type { RealmTagVote } from "#/prisma/client";

export function mapRealmTagVoteToDTO(row: RealmTagVote): RealmTagVoteDTO {
  return {
    realmUnitId: row.realmUnitId,
    userId: row.userId,
    unitId: row.unitId,
    tagUnitId: row.tagUnitId,
    value: row.value,
    createdAt: row.createdAt,
  };
}
