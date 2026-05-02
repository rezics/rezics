import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Tooltip,
} from "@mui/material";
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
  size = "small",
  minWidth = 160,
}) => {
  const { t } = useTranslation();
  const selected = value ?? [];
  const allowSet = allowed ? new Set(allowed) : null;
  const labelText = t("search.filters.rating", "Rating");

  const handleChange = (event: SelectChangeEvent<ContentRating[]>) => {
    const next = event.target.value;
    const arr = (typeof next === "string" ? next.split(",") : next).filter(
      (r): r is ContentRating => RATINGS.includes(r as ContentRating),
    );
    onChange(arr.length > 0 ? arr : undefined);
  };

  return (
    <FormControl size={size} sx={{ minWidth }}>
      <InputLabel>{labelText}</InputLabel>
      <Select<ContentRating[]>
        multiple
        value={selected}
        onChange={handleChange}
        label={labelText}
        renderValue={(selectedValues) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {selectedValues.map((rating) => (
              <Chip
                key={rating}
                size="small"
                label={t(`rating.tier.${rating}`, rating)}
              />
            ))}
          </Box>
        )}
      >
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
          const item = (
            <MenuItem key={rating} value={rating} disabled={disabled}>
              {t(`rating.tier.${rating}`, rating)}
            </MenuItem>
          );
          return hint ? (
            <Tooltip key={rating} title={hint} placement="right">
              <span>{item}</span>
            </Tooltip>
          ) : (
            item
          );
        })}
      </Select>
    </FormControl>
  );
};
