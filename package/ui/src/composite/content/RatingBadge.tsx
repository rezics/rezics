import type { ContentRating } from "@rezics/contract";
import Chip from "@mui/material/Chip";
import type { ChipProps } from "@mui/material/Chip";

const RATING_LABELS: Record<ContentRating, string> = {
  GENERAL: "General",
  R_15: "R-15",
  R_18: "R-18",
  R_18G: "R-18G",
};

const RATING_COLORS: Record<ContentRating, ChipProps["color"]> = {
  GENERAL: "default",
  R_15: "info",
  R_18: "warning",
  R_18G: "error",
};

export interface RatingBadgeProps {
  rating: ContentRating;
  label?: string;
  size?: ChipProps["size"];
  variant?: ChipProps["variant"];
}

export function RatingBadge({
  rating,
  label,
  size = "small",
  variant = "outlined",
}: RatingBadgeProps) {
  return (
    <Chip
      label={label ?? RATING_LABELS[rating]}
      color={RATING_COLORS[rating]}
      size={size}
      variant={variant}
    />
  );
}
