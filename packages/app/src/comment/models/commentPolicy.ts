import type { Action, ReactionBarPolicy } from "@/engagement";
import { getPostShareHref } from "@/post/models/postPolicy";

export const commentRowActions: Action[] = ["vote", "reply", "shelf"];
export const commentRowOverflow: Action[] = ["share"];

// Comment permalinks resolve under the owning post thread route.
// 评论的固定链接在其所属帖子的讨论串路由下解析。
export { getPostShareHref };

export const commentPolicy: ReactionBarPolicy = {
  getShareHref: getPostShareHref,
  shelfItemType: "comment",
  shelfItemKind: "comment",
};
