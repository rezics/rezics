import {
  Badge,
  Label,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import type { ContentRating } from "@rezics/contract";
import type React from "react";
import { useTranslation } from "react-i18next";

const RATINGS: ContentRating[] = ["GENERAL", "R_15", "R_18", "R_18G"];

export type RatingMultiSelectProps = {
  value: ContentRating[] | undefined;
  onChange: (value: ContentRating[] | undefined) => void;
  allowed?: ContentRating[];
  isAuthenticated?: boolean;
  size?: "small" | "medium";
  minWidth?: number;
};

export const RatingMultiSelect: React.FC<RatingMultiSelectProps> = ({
  value,
  onChange,
  allowed,
  isAuthenticated = true,
  minWidth = 160,
}) => {
  const { t } = useTranslation();
  const selected = new Set(value ?? []);
  const allowSet = allowed ? new Set(allowed) : null;
  const labelText = t("search.filters.rating", "Rating");

  const toggle = (rating: ContentRating, disabled: boolean) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(rating)) next.delete(rating);
    else next.add(rating);
    const arr = [...next];
    onChange(arr.length > 0 ? arr : undefined);
  };

  return (
    <div className="flex flex-col gap-1" style={{ minWidth }}>
      <Label>{labelText}</Label>
      <div className="flex flex-wrap gap-1">
        {selected.size > 0 &&
          [...selected].map((rating) => (
            <Badge key={`sel-${rating}`} variant="secondary">
              {t(`rating.tier.${rating}`, rating)}
            </Badge>
          ))}
      </div>
      <TooltipProvider>
        <div className="flex flex-wrap gap-1">
          {RATINGS.map((rating) => {
            const disabled = allowSet !== null && !allowSet.has(rating);
            const hint = disabled
              ? !isAuthenticated
                ? t(
                    "search.tooltips.ratingSignIn",
                    "Sign in and opt in to enable this rating",
                  )
                : t(
                    "search.tooltips.ratingOptIn",
                    "Enable this rating in settings",
                  )
              : "";
            const chip = (
              <Badge
                key={rating}
                variant={selected.has(rating) ? "default" : "outline"}
                className={
                  disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }
                onClick={() => toggle(rating, disabled)}
              >
                {t(`rating.tier.${rating}`, rating)}
              </Badge>
            );
            return hint ? (
              <Tooltip key={rating}>
                <TooltipTrigger
                  render={(props) => <span {...props}>{chip}</span>}
                />
                <TooltipContent side="right">{hint}</TooltipContent>
              </Tooltip>
            ) : (
              chip
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
};
