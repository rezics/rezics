import type { RealmTagTreeReadResponse } from "@rezics/contract";
import { emptyRealmTagTree, parseRealmTagTree } from "@rezics/contract";
import type { RealmTagTree } from "../db/schema";

type RealmTagTreeRow = typeof RealmTagTree.$inferSelect;

export function mapRealmTagTreeToDTO(
  realmUnitId: string,
  row: RealmTagTreeRow | null,
): RealmTagTreeReadResponse {
  return {
    realmUnitId,
    tree: parseRealmTagTree(row?.tree) ?? emptyRealmTagTree(),
    ...(row?.createdAt ? { createdAt: row.createdAt } : {}),
    ...(row?.updatedAt ? { updatedAt: row.updatedAt } : {}),
  };
}
