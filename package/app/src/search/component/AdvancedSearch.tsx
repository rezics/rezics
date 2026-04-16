import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import {
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
} from "@mui/material";
import type { SearchQuery, ZoneFilters } from "@rezics/contract";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  parseSearchString,
  serializeSearchString,
} from "../model/searchQuery";
import type { AppliedFilter } from "./AppliedFilterChips";
import { AppliedFilterChips } from "./AppliedFilterChips";

export type AdvancedSearchProps = {
  preAppliedFilters?: ZoneFilters;
  onSearch: (query: SearchQuery) => void;
  onToggleBasic?: () => void;
  initialQuery?: SearchQuery;
};

const CONTENT_TYPES = ["BOOK", "GAME", "MEDIA", "SHELF", "POST"];
const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "createdAt", label: "Newest" },
  { value: "updatedAt", label: "Recently Updated" },
  { value: "publishedAt", label: "Publication Date" },
];

function preAppliedToChips(
  filters?: ZoneFilters,
): AppliedFilter[] {
  if (!filters) return [];
  const chips: AppliedFilter[] = [];

  const types = Array.isArray(filters.type)
    ? filters.type
    : filters.type
      ? [filters.type]
      : [];
  for (const t of types) {
    chips.push({ key: `pre:type:${t}`, label: `Type: ${t}`, removable: true });
  }

  for (const tag of filters.tags ?? []) {
    chips.push({
      key: `pre:tag:${tag.slug}`,
      label: `Tag: ${tag.slug}`,
      removable: true,
    });
  }

  if (filters.isLicensed !== undefined) {
    chips.push({
      key: "pre:licensed",
      label: `Licensed: ${filters.isLicensed ? "Yes" : "No"}`,
      removable: true,
    });
  }

  if (filters.nsfw !== undefined) {
    chips.push({
      key: "pre:nsfw",
      label: `NSFW: ${filters.nsfw ? "Yes" : "No"}`,
      removable: true,
    });
  }

  return chips;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  preAppliedFilters,
  onSearch,
  onToggleBasic,
  initialQuery,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState<SearchQuery>(initialQuery ?? {});
  const [searchInput, setSearchInput] = useState(
    initialQuery ? serializeSearchString(initialQuery) : "",
  );

  const handleInputChange = (value: string) => {
    setSearchInput(value);
    const parsed = parseSearchString(value);
    setQuery(parsed);
  };

  const handleSubmit = () => {
    onSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTypeChange = (type: string, checked: boolean) => {
    const currentTypes = query.type ?? [];
    const newTypes = checked
      ? [...currentTypes, type]
      : currentTypes.filter((t) => t !== type);
    const newQuery = { ...query, type: newTypes.length > 0 ? newTypes : undefined };
    setQuery(newQuery);
    setSearchInput(serializeSearchString(newQuery));
  };

  const handleSortChange = (sort: string) => {
    const newQuery = {
      ...query,
      sort: sort === "relevance" ? undefined : sort,
    };
    setQuery(newQuery);
    setSearchInput(serializeSearchString(newQuery));
  };

  const preChips = preAppliedToChips(preAppliedFilters);

  return (
    <div className="flex flex-col gap-4">
      {/* Search input */}
      <div className="flex items-center gap-2">
        <TextField
          fullWidth
          size="small"
          placeholder={t("search.input.placeholder")}
          value={searchInput}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <IconButton color="primary" onClick={handleSubmit}>
          <SearchIcon />
        </IconButton>
        {onToggleBasic && (
          <IconButton onClick={onToggleBasic}>
            <CloseIcon />
          </IconButton>
        )}
      </div>

      {/* Pre-applied filter chips */}
      {preChips.length > 0 && <AppliedFilterChips filters={preChips} />}

      {/* Filter controls */}
      <div className="flex flex-wrap gap-4 items-start">
        {/* Content type */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium opacity-60">
            {t("search.filters.type", "Content Type")}
          </span>
          <div className="flex flex-wrap gap-1">
            {CONTENT_TYPES.map((type) => (
              <FormControlLabel
                key={type}
                control={
                  <Checkbox
                    size="small"
                    checked={query.type?.includes(type) ?? false}
                    onChange={(e) => handleTypeChange(type, e.target.checked)}
                  />
                }
                label={type}
                className="m-0"
              />
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium opacity-60">
            {t("search.filters.sort", "Sort By")}
          </span>
          <TextField
            select
            size="small"
            value={query.sort ?? "relevance"}
            onChange={(e) => handleSortChange(e.target.value)}
            className="min-w-[160px]"
          >
            {SORT_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        </div>

        {/* NSFW */}
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={query.nsfw ?? false}
              onChange={(e) => {
                const newQuery = { ...query, nsfw: e.target.checked || undefined };
                setQuery(newQuery);
                setSearchInput(serializeSearchString(newQuery));
              }}
            />
          }
          label="NSFW"
          className="m-0 mt-5"
        />

        {/* Licensed */}
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={query.isLicensed ?? false}
              onChange={(e) => {
                const newQuery = {
                  ...query,
                  isLicensed: e.target.checked || undefined,
                };
                setQuery(newQuery);
                setSearchInput(serializeSearchString(newQuery));
              }}
            />
          }
          label="Licensed"
          className="m-0 mt-5"
        />
      </div>

      {/* Tags input */}
      <TextField
        fullWidth
        size="small"
        label={t("search.input.tags_label", "Tags")}
        placeholder={t("search.input.tags_hint", "Enter tag slugs separated by comma")}
        value={query.tags?.map((t) => t.slug).join(", ") ?? ""}
        onChange={(e) => {
          const slugs = e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const newQuery = {
            ...query,
            tags: slugs.length > 0 ? slugs.map((slug) => ({ slug })) : undefined,
          };
          setQuery(newQuery);
        }}
      />
    </div>
  );
};
