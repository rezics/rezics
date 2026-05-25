import type { ContentRating } from "@rezics/contract";
import {
  search_filters_rating,
  search_tooltips_ratingOptIn,
  search_tooltips_ratingSignIn,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import {
  Badge,
  Label,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import type React from "react";
import { ratingTierLabel } from "@/search/models/ratingTierLabel";

const i18nMessages = {
  search_filters_rating,
  search_tooltips_ratingOptIn,
  search_tooltips_ratingSignIn,
};

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
  const m = useMessage(i18nMessages);
  const selected = new Set(value ?? []);
  const allowSet = allowed ? new Set(allowed) : null;
  const labelText = m.search_filters_rating();

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
              {ratingTierLabel(rating)}
            </Badge>
          ))}
      </div>
      <TooltipProvider>
        <div className="flex flex-wrap gap-1">
          {RATINGS.map((rating) => {
            const disabled = allowSet !== null && !allowSet.has(rating);
            const hint = disabled
              ? !isAuthenticated
                ? m.search_tooltips_ratingSignIn()
                : m.search_tooltips_ratingOptIn()
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
                {ratingTierLabel(rating)}
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
