import type { RealmTagApplicationVoteDTO } from "@rezics/contract";
import type { RealmTagApplicationVote } from "../db/schema";

export function mapRealmTagApplicationVoteToDTO(
  row: typeof RealmTagApplicationVote.$inferSelect,
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
