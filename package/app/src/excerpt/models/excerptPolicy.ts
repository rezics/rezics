import type { Action, ReactionBarPolicy, ReactionBarPost } from "@/engagement";

export const excerptCardActions: Action[] = ["vote", "reply", "shelf", "share"];

export const excerptDetailActions: Action[] = [
  "vote",
  "reply",
  "shelf",
  "share",
];

export const excerptPolicy: ReactionBarPolicy = {
  getShareHref: getExcerptShareHref,
};

export function getExcerptShareHref(
  post: Pick<ReactionBarPost, "unitId">,
): string {
  return `/excerpt/${post.unitId}`;
}
