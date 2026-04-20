import CloseIcon from "@mui/icons-material/Close";
import { IconButton } from "@mui/material";
import type { SearchQuery } from "@rezics/contract";
import type React from "react";
import { useTranslation } from "react-i18next";
import type { UseSearchQueryReturn } from "../hooks/useSearchQuery";
import {
  ContentTypeCheckboxes,
  KeywordInput,
  LicensedToggle,
  NsfwToggle,
  PostKindCheckboxes,
  SortSelect,
  TagPicker,
  WordCountRangeInput,
} from "./primitive";

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
  const { t } = useTranslation();
  const keyword = bind("keyword");
  const tags = bind("tags");
  const type = bind("type");
  const postKind = bind("postKind");
  const sort = bind("sort");
  const nsfw = bind("nsfw");
  const isLicensed = bind("isLicensed");
  const textLength = bind("textLength");

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
            placeholder={keywordPlaceholder ?? t("search.input.placeholder")}
          />
        </div>
        {onToggleBasic && (
          <IconButton onClick={onToggleBasic} aria-label="close advanced">
            <CloseIcon />
          </IconButton>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <ContentTypeCheckboxes
          value={type.value ?? []}
          onChange={(v) => type.onChange(v.length ? v : undefined)}
          label={t("search.filters.type", "Content Type")}
        />
        <PostKindCheckboxes
          value={postKind.value ?? []}
          onChange={(v) => postKind.onChange(v.length ? v : undefined)}
          label={t("search.filters.postKind", "Post Kind")}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium opacity-60">
            {t("search.filters.sort", "Sort By")}
          </span>
          <SortSelect value={sort.value} onChange={sort.onChange} />
        </div>
        <WordCountRangeInput
          value={textLength.value}
          onChange={textLength.onChange}
          label={t("search.filters.wordCount", "Word Count")}
        />
        <div className="flex items-center gap-2 mt-5">
          <NsfwToggle value={nsfw.value} onChange={nsfw.onChange} />
          <LicensedToggle
            value={isLicensed.value}
            onChange={isLicensed.onChange}
          />
        </div>
      </div>

      <TagPicker
        value={tags.value ?? []}
        onChange={(v) => tags.onChange(v.length ? v : undefined)}
        label={t("search.input.tags_label", "Tags")}
        placeholder={t(
          "search.input.tags_hint",
          "Enter tag slugs separated by comma",
        )}
      />
    </div>
  );
};
