import type { RealmListItemModel } from "@/user/models/realmListItem";

export function toggleRealmSelection(
  selectedIds: ReadonlySet<string>,
  realmId: string,
): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(realmId)) {
    next.delete(realmId);
  } else {
    next.add(realmId);
  }
  return next;
}

export function selectedRealmItems(
  realms: readonly RealmListItemModel[],
  selectedIds: ReadonlySet<string>,
): RealmListItemModel[] {
  return realms.filter((realm) => selectedIds.has(realm.unitId));
}
