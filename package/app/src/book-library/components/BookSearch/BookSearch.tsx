import TuneIcon from "@mui/icons-material/Tune";
import { IconButton } from "@mui/material";
import type { SearchQuery } from "@rezics/contract";
import type React from "react";
import { useTranslation } from "react-i18next";
import {
  AppliedFilterChips,
  KeywordInput,
  LicensedToggle,
  RatingMultiSelect,
  TagGroupSuggestions,
  TagPicker,
  WordCountRangeInput,
} from "@/search/components/primitive";
import type { UseSearchQueryReturn } from "@/search/hooks/useSearchQuery";
import { useAllowedRatings } from "@/user/hooks/useAllowedRatings";

export type BookSearchProps = {
  query: UseSearchQueryReturn["query"];
  bind: UseSearchQueryReturn["bind"];
  patch: UseSearchQueryReturn["patch"];
  implicit: UseSearchQueryReturn["implicit"];
  onSubmit: () => void;
  onToggleAdvanced?: () => void;
  middleware?: UseSearchQueryReturn["middleware"];
  tagGroups?: Record<string, string[]>;
  showWordCount?: boolean;
  keywordPlaceholder?: string;
};

const DEFAULT_TAG_GROUPS: Record<string, string[]> = {
  presetTags: [
    "fiction",
    "nonfiction",
    "mystery",
    "romance",
    "history",
    "science",
    "fantasy",
    "philosophy",
  ],
};

export const BookSearch: React.FC<BookSearchProps> = ({
  query,
  bind,
  patch,
  implicit,
  onSubmit,
  onToggleAdvanced,
  middleware,
  tagGroups = DEFAULT_TAG_GROUPS,
  showWordCount = true,
  keywordPlaceholder,
}) => {
  const { t } = useTranslation();
  const keyword = bind("keyword");
  const tags = bind("tags");
  const ratings = bind("ratings");
  const isLicensed = bind("isLicensed");
  const textLength = bind("textLength");
  const { allowed, isAuthenticated } = useAllowedRatings();

  const rendered: (keyof SearchQuery)[] = [
    "keyword",
    "tags",
    "ratings",
    "isLicensed",
  ];
  if (showWordCount) rendered.push("textLength");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <KeywordInput
            value={keyword.value ?? ""}
            onChange={(v) => keyword.onChange(v)}
            onPatch={(p) => patch(p)}
            onSubmit={onSubmit}
            middleware={middleware}
            placeholder={keywordPlaceholder ?? t("placeholders.search_books")}
          />
        </div>
        {onToggleAdvanced && (
          <IconButton onClick={onToggleAdvanced} aria-label="advanced search">
            <TuneIcon />
          </IconButton>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-0">
          <TagPicker
            value={tags.value ?? []}
            onChange={(v) => tags.onChange(v.length ? v : undefined)}
            label={t("search.input.tags_label")}
            placeholder={t("search.input.tags_hint")}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showWordCount && (
            <WordCountRangeInput
              value={textLength.value}
              onChange={textLength.onChange}
              label={t("search.input.word_count_label")}
            />
          )}
          <RatingMultiSelect
            value={ratings.value}
            onChange={ratings.onChange}
            allowed={allowed}
            isAuthenticated={isAuthenticated}
          />
          <LicensedToggle
            value={isLicensed.value}
            onChange={isLicensed.onChange}
          />
        </div>
      </div>

      <AppliedFilterChips
        query={query}
        hide={implicit}
        rendered={rendered}
        onRemove={patch}
      />

      <TagGroupSuggestions
        groups={tagGroups}
        onAddTag={(slug) => patch({ tags: [{ slug }] })}
      />
    </div>
  );
};
