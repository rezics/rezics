import { contentDocMarkdownFallback, type RealmDTO } from "@rezics/contract";

export type RealmListItemModel = {
  unitId: string;
  slug: string | null;
  title: string;
  description: string;
  memberCount: number;
  isOfficial: boolean;
  isPublic: boolean;
};

export function mapJoinedRealmToListItem(realm: RealmDTO): RealmListItemModel {
  return {
    unitId: realm.unitId,
    slug: realm.slug ?? null,
    title: realm.title ?? realm.unitId,
    description: contentDocMarkdownFallback(realm.description),
    memberCount: realm.memberCount,
    isOfficial: realm.isOfficial,
    isPublic: realm.isPublic,
  };
}
