import type { RealmTagApplicationVoteDTO } from "@rezics/contract";
import type { RealmTagApplicationVote } from "#/prisma/client";

export function mapRealmTagApplicationVoteToDTO(
  row: RealmTagApplicationVote,
): RealmTagApplicationVoteDTO {
  return {
    realmUnitId: row.realmUnitId,
    userId: row.userId,
    unitId: row.unitId,
    tagUnitId: row.tagUnitId,
    value: row.value,
    createdAt: row.createdAt,
  };
}
