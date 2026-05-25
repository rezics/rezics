import type { SearchQuery } from "@rezics/contract";
import {
  search_close_advanced_label,
  search_filters_postKind,
  search_filters_sort,
  search_filters_type,
  search_filters_wordCount,
  search_input_placeholder,
  search_input_tags_hint,
  search_input_tags_label,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { X as CloseIcon } from "lucide-react";
import type React from "react";
import { useAllowedRatings } from "@/user/hooks/useAllowedRatings";
import type { UseSearchQueryReturn } from "../hooks/useSearchQuery";
import {
  ContentTypeCheckboxes,
  KeywordInput,
  LicensedToggle,
  PostKindCheckboxes,
  RatingFilterChips,
  SortSelect,
  TagPicker,
  WordCountRangeInput,
} from "./primitive";

const i18nMessages = {
  search_close_advanced_label,
  search_filters_postKind,
  search_filters_sort,
  search_filters_type,
  search_filters_wordCount,
  search_input_placeholder,
  search_input_tags_hint,
  search_input_tags_label,
};

export type AdvancedSearchProps = {
  query: UseSearchQueryReturn["query"];
  bind: UseSearchQueryReturn["bind"];
  patch: UseSearchQueryReturn["patch"];
  implicit: UseSearchQueryReturn["implicit"];
  onSubmit: () => void;
  onToggleBasic?: () => void;
  middleware?: UseSearchQueryReturn["middleware"];
  keywordPlaceholder?: string;
};

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  bind,
  patch,
  onSubmit,
  onToggleBasic,
  middleware,
  keywordPlaceholder,
}) => {
  const m = useMessage(i18nMessages);
  const keyword = bind("keyword");
  const tags = bind("tags");
  const type = bind("type");
  const postKind = bind("postKind");
  const sort = bind("sort");
  const ratings = bind("ratings");
  const isLicensed = bind("isLicensed");
  const textLength = bind("textLength");
  const { allowed, isAuthenticated } = useAllowedRatings();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <KeywordInput
            value={keyword.value ?? ""}
            onChange={(v) => keyword.onChange(v)}
            onPatch={(p: Partial<SearchQuery>) => patch(p)}
            onSubmit={onSubmit}
            middleware={middleware}
            placeholder={keywordPlaceholder ?? m.search_input_placeholder()}
          />
        </div>
        {onToggleBasic && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onToggleBasic}
            aria-label={m.search_close_advanced_label()}
          >
            <CloseIcon />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <ContentTypeCheckboxes
          value={type.value ?? []}
          onChange={(v) => type.onChange(v.length ? v : undefined)}
          label={m.search_filters_type()}
        />
        <PostKindCheckboxes
          value={postKind.value ?? []}
          onChange={(v) => postKind.onChange(v.length ? v : undefined)}
          label={m.search_filters_postKind()}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium opacity-60">
            {m.search_filters_sort()}
          </span>
          <SortSelect value={sort.value} onChange={sort.onChange} />
        </div>
        <WordCountRangeInput
          value={textLength.value}
          onChange={textLength.onChange}
          label={m.search_filters_wordCount()}
        />
        <RatingFilterChips
          value={ratings.value}
          onChange={ratings.onChange}
          allowed={allowed}
          isAuthenticated={isAuthenticated}
        />
        <div className="flex items-center gap-2 mt-6">
          <LicensedToggle
            value={isLicensed.value}
            onChange={isLicensed.onChange}
          />
        </div>
      </div>

      <TagPicker
        value={tags.value ?? []}
        onChange={(v) => tags.onChange(v.length ? v : undefined)}
        label={m.search_input_tags_label()}
        placeholder={m.search_input_tags_hint()}
      />
    </div>
  );
};
