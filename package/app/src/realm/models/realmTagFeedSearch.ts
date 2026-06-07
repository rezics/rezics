export type RealmRouteSearch = {
  sort?: "best" | "hot" | "new" | "top" | "rising";
  tags?: string;
  tab?: "feed" | "wiki" | "tags" | "about" | "members";
};

export function realmFeedSearchForSingleTag(
  previous: RealmRouteSearch,
  tagId: string,
): RealmRouteSearch {
  return {
    ...previous,
    tab: "feed",
    tags: tagId,
  };
}

export function realmTagsTabSearch(
  previous: RealmRouteSearch,
): RealmRouteSearch {
  return {
    ...previous,
    tab: "tags",
  };
}
