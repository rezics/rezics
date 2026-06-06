import type { Action, ReactionBarPolicy } from "@/engagement";
import { getPostShareHref, postPolicy } from "@/post";

export const commentRowActions: Action[] = ["vote", "reply", "shelf"];
export const commentRowOverflow: Action[] = ["share"];

// Comment permalinks resolve under the owning post thread route.
export { getPostShareHref };

export const commentPolicy: ReactionBarPolicy = {
  ...postPolicy,
  shelfItemType: "comment",
  shelfItemKind: "comment",
};
