import type { ContentRating } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";

const RATING_TIER_LABEL = {
  GENERAL: m.rating_tier_GENERAL,
  R_15: m.rating_tier_R_15,
  R_18: m.rating_tier_R_18,
  R_18G: m.rating_tier_R_18G,
} as const satisfies Record<ContentRating, () => string>;

export function ratingTierLabel(rating: ContentRating): string {
  return RATING_TIER_LABEL[rating]();
}
