import type {
  Action,
  ReactionBarPolicy,
  ReactionBarPost,
} from "@/engagement";

export const remarkCardActions: Action[] = ["vote", "reply", "shelf", "share"];

export const remarkDetailActions: Action[] = [
  "vote",
  "reply",
  "shelf",
  "share",
];

export function getRemarkShareHref(
  post: Pick<ReactionBarPost, "unitId">,
): string {
  return `/remark/${post.unitId}`;
}

export const remarkPolicy: ReactionBarPolicy = {
  getShareHref: getRemarkShareHref,
};
