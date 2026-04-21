import type {
  Action,
  ReactionBarPolicy,
  ReactionBarPost,
} from "@/engagement";

export const bookHeroActions: Action[] = ["vote", "shelf", "share"];

export function getBookShareHref(
  post: Pick<ReactionBarPost, "unitId">,
): string {
  return `/book/${post.unitId}`;
}

export const bookPolicy: ReactionBarPolicy = {
  getShareHref: getBookShareHref,
};
