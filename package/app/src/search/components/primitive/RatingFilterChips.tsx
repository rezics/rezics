import type { ContentRating } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Checkbox,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import type React from "react";
import { ratingTierLabel } from "@/search/models/ratingTierLabel";

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
  const { t } = useTranslation(["search"]);
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
        {t("search:filters_rating")}
      </span>
      <TooltipProvider>
        <div className="flex flex-wrap items-center gap-2">
          {RATINGS.map((rating) => {
            const disabled = allowSet !== null && !allowSet.has(rating);
            const hint =
              disabled && !isAuthenticated
                ? t("search:tooltips_ratingSignIn")
                : disabled
                  ? t("search:tooltips_ratingOptIn")
                  : "";
            const label = (
              <div
                key={`rating-${rating}-label`}
                className="m-0 inline-flex items-center gap-2"
              >
                <Checkbox
                  checked={selected.has(rating)}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    toggle(rating, checked === true)
                  }
                  aria-label={ratingTierLabel(rating)}
                />
                <span className="text-sm">{ratingTierLabel(rating)}</span>
              </div>
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
