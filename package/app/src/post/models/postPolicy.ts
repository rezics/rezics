import type { Action, ReactionBarPolicy, ReactionBarPost } from "@/engagement";

/**
 * Posts keep shelf secondary to the primary voting, reply, and share actions so
 * content cards stay focused.
 */
export const postCardActions: Action[] = ["vote", "reply", "share"];
export const postCardOverflow: Action[] = ["shelf"];

export const postDetailActions: Action[] = ["vote", "reply", "share"];
export const postDetailOverflow: Action[] = ["shelf"];

export function getPostShareHref(
  post: Pick<ReactionBarPost, "unitId">,
): string {
  return `/post/${post.unitId}`;
}

export const postPolicy: ReactionBarPolicy = {
  getShareHref: getPostShareHref,
};
