import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import { IconButton, TextField } from "@mui/material";
import type { ZoneFilters } from "@rezics/contract";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parseSearchString } from "../model/searchQuery";
import type { AppliedFilter } from "./AppliedFilterChips";
import { AppliedFilterChips } from "./AppliedFilterChips";

export type BasicSearchProps = {
  preAppliedFilters?: ZoneFilters;
  onSearch: (keyword: string) => void;
  onToggleAdvanced?: () => void;
  placeholder?: string;
};

function filtersToChips(filters?: ZoneFilters): AppliedFilter[] {
  if (!filters) return [];
  const chips: AppliedFilter[] = [];

  const types = Array.isArray(filters.type)
    ? filters.type
    : filters.type
      ? [filters.type]
      : [];
  for (const t of types) {
    chips.push({ key: `type:${t}`, label: t, removable: false });
  }

  for (const tag of filters.tags ?? []) {
    chips.push({
      key: `tag:${tag.slug}`,
      label: tag.slug,
      removable: false,
    });
  }

  if (filters.isLicensed !== undefined) {
    chips.push({
      key: "licensed",
      label: `Licensed: ${filters.isLicensed ? "Yes" : "No"}`,
      removable: false,
    });
  }

  return chips;
}

export const BasicSearch: React.FC<BasicSearchProps> = ({
  preAppliedFilters,
  onSearch,
  onToggleAdvanced,
  placeholder,
}) => {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");

  const handleSubmit = () => {
    const parsed = parseSearchString(keyword);
    onSearch(parsed.keyword ?? keyword);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const chips = filtersToChips(preAppliedFilters);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <TextField
          fullWidth
          size="small"
          placeholder={placeholder ?? t("placeholders.search_books")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <IconButton color="primary" onClick={handleSubmit}>
          <SearchIcon />
        </IconButton>
        {onToggleAdvanced && (
          <IconButton onClick={onToggleAdvanced}>
            <TuneIcon />
          </IconButton>
        )}
      </div>
      {chips.length > 0 && <AppliedFilterChips filters={chips} />}
    </div>
  );
};
