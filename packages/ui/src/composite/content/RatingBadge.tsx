import type { ContentRating } from "@rezics/contract";
import { Badge } from "#/shadcn/badge";

const RATING_LABELS: Record<ContentRating, string> = {
  GENERAL: "General",
  R_15: "R-15",
  R_18: "R-18",
  R_18G: "R-18G",
};

const RATING_VARIANT: Record<
  ContentRating,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  GENERAL: "secondary",
  R_15: "outline",
  R_18: "outline",
  R_18G: "destructive",
};

const RATING_TINT: Record<ContentRating, string> = {
  GENERAL: "",
  R_15: "text-info-text border-info-fill/40",
  R_18: "text-warning-text border-warning-fill/40",
  R_18G: "",
};

export interface RatingBadgeProps {
  rating: ContentRating;
  label?: string;
  size?: "sm" | "md";
  variant?: "filled" | "outlined";
}

export function RatingBadge({
  rating,
  label,
  size: _size = "sm",
  variant = "outlined",
}: RatingBadgeProps) {
  const badgeVariant =
    variant === "filled" && RATING_VARIANT[rating] === "outline"
      ? "secondary"
      : RATING_VARIANT[rating];

  return (
    <Badge variant={badgeVariant} className={RATING_TINT[rating]}>
      {label ?? RATING_LABELS[rating]}
    </Badge>
  );
}
