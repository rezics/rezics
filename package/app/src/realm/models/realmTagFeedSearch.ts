// Feed route search for the realm detail. Tab selection is path-based (the
// feed is the index route, the tag browser is the `/tags` sub-route), so this
// only carries the feed's sort and tag filter.
// realm 详情信息流路由的 search。标签选择改为基于路径（信息流为索引路由，标签
// 浏览器为 `/tags` 子路由），因此这里只承载信息流的排序与标签筛选。
export type RealmFeedSearch = {
  sort?: "best" | "hot" | "new" | "top" | "rising";
  tags?: string;
};

export function realmFeedSearchForSingleTag(
  previous: RealmFeedSearch,
  tagId: string,
): RealmFeedSearch {
  return {
    ...previous,
    tags: tagId,
  };
}
