import type {
  Action,
  ReactionBarPolicy,
  ReactionBarPost,
} from "@/engagement";

export const reviewCardActions: Action[] = ["vote", "reply", "shelf", "share"];

export const reviewDetailActions: Action[] = [
  "vote",
  "reply",
  "shelf",
  "share",
];

export function getReviewShareHref(
  post: Pick<ReactionBarPost, "unitId">,
): string {
  return `/review/${post.unitId}`;
}

export const reviewPolicy: ReactionBarPolicy = {
  getShareHref: getReviewShareHref,
  isReview: true,
};
