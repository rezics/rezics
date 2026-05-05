import {
  Checkbox,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
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
      <TooltipProvider>
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
              <label className="m-0 inline-flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selected.has(rating)}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    toggle(rating, checked === true)
                  }
                />
                <span className="text-sm">
                  {t(`rating.tier.${rating}`, rating)}
                </span>
              </label>
            );
            return hint ? (
              <Tooltip key={rating}>
                <TooltipTrigger
                  render={(props) => <span {...props}>{label}</span>}
                />
                <TooltipContent>{hint}</TooltipContent>
              </Tooltip>
            ) : (
              <span key={rating}>{label}</span>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
};
