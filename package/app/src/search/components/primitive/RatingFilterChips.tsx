import { Checkbox, FormControlLabel, Tooltip } from "@mui/material";
import type { ContentRating } from "@rezics/contract";
import type React from "react";
import { useTranslation } from "react-i18next";

const RATINGS: ContentRating[] = ["GENERAL", "R_15", "R_18", "R_18G"];

export type RatingFilterChipsProps = {
  value: ContentRating[] | undefined;
  onChange: (value: ContentRating[] | undefined) => void;
  allowed?: ContentRating[];
  isAuthenticated?: boolean;
};

export const RatingFilterChips: React.FC<RatingFilterChipsProps> = ({
  value,
  onChange,
  allowed,
  isAuthenticated = true,
}) => {
  const { t } = useTranslation();
  const selected = new Set(value ?? []);
  const allowSet = allowed ? new Set(allowed) : null;

  const toggle = (rating: ContentRating, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(rating);
    else next.delete(rating);
    const arr = [...next];
    onChange(arr.length > 0 ? arr : undefined);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium opacity-60">
        {t("search.filters.rating", "Rating")}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {RATINGS.map((rating) => {
          const disabled = allowSet !== null && !allowSet.has(rating);
          const hint =
            disabled && !isAuthenticated
              ? t(
                  "search.tooltips.ratingSignIn",
                  "Sign in and opt in to enable this rating",
                )
              : disabled
                ? t(
                    "search.tooltips.ratingOptIn",
                    "Enable this rating in settings",
                  )
                : "";
          const label = (
            <FormControlLabel
              className="m-0"
              control={
                <Checkbox
                  size="small"
                  checked={selected.has(rating)}
                  disabled={disabled}
                  onChange={(e) => toggle(rating, e.target.checked)}
                />
              }
              label={t(`rating.tier.${rating}`, rating)}
            />
          );
          return hint ? (
            <Tooltip key={rating} title={hint}>
              <span>{label}</span>
            </Tooltip>
          ) : (
            <span key={rating}>{label}</span>
          );
        })}
      </div>
    </div>
  );
};
