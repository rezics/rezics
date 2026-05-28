import type { ContentRating } from "@rezics/contract";
const RATING_TIER_LABEL = {
  GENERAL: rating_tier_GENERAL,
  R_15: rating_tier_R_15,
  R_18: rating_tier_R_18,
  R_18G: rating_tier_R_18G,
} as const satisfies Record<ContentRating, () => string>;

export function ratingTierLabel(rating: ContentRating): string {
  return RATING_TIER_LABEL[rating]();
}
