import type { Action, ReactionBarPolicy, ReactionBarPost } from "@/engagement";

export const shelfCardActions: Action[] = ["vote", "reply", "shelf", "share"];
export const shelfDetailActions: Action[] = ["vote", "shelf", "share"];

export function getShelfShareHref(
  post: Pick<ReactionBarPost, "unitId">,
): string {
  return `/shelf/${post.unitId}`;
}

export const shelfPolicy: ReactionBarPolicy = {
  getShareHref: getShelfShareHref,
};
