import { getI18nRuntime } from "@rezics/i18n/runtime";
import type { ContentRating } from "@rezics/contract";
const RATING_TIER_LABEL = {
  GENERAL: () => getI18nRuntime().i18n.t("community:rating_tier_GENERAL"),
  R_15: () => getI18nRuntime().i18n.t("community:rating_tier_R_15"),
  R_18: () => getI18nRuntime().i18n.t("community:rating_tier_R_18"),
  R_18G: () => getI18nRuntime().i18n.t("community:rating_tier_R_18G"),
} as const satisfies Record<ContentRating, () => string>;

export function ratingTierLabel(rating: ContentRating): string {
  return RATING_TIER_LABEL[rating]();
}
