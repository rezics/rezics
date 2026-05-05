import type { Action, ReactionBarPolicy, ReactionBarPost } from "@/engagement";

/**
 * Posts (discussion comments) are content-as-discussion: shelf collapses into
 * the overflow menu so the primary row stays lean.
 */
export const postCardActions: Action[] = ["vote", "reply", "share"];
export const postCardOverflow: Action[] = ["shelf"];

export const postReplyRowActions: Action[] = ["vote", "reply"];
export const postReplyRowOverflow: Action[] = ["share", "shelf"];

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
