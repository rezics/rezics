import type { SearchQuery } from "@rezics/contract";
import type React from "react";
import { useTranslation } from "@rezics/i18n/react";
import {
  AppliedFilterChips,
  KeywordInput,
  TagPicker,
} from "@/search/components/primitive";
import type { UseSearchQueryReturn } from "@/search/hooks/useSearchQuery";

export type ReviewSearchProps = {
  query: UseSearchQueryReturn["query"];
  bind: UseSearchQueryReturn["bind"];
  patch: UseSearchQueryReturn["patch"];
  implicit: UseSearchQueryReturn["implicit"];
  onSubmit: () => void;
  middleware?: UseSearchQueryReturn["middleware"];
  keywordPlaceholder?: string;
};

export const ReviewSearch: React.FC<ReviewSearchProps> = ({
  query,
  bind,
  patch,
  implicit,
  onSubmit,
  middleware,
  keywordPlaceholder,
}) => {
  const { t } = useTranslation();
  const keyword = bind("keyword");
  const tags = bind("tags");

  const rendered: (keyof SearchQuery)[] = ["keyword", "tags"];

  return (
    <div className="flex flex-col gap-3">
      <KeywordInput
        value={keyword.value ?? ""}
        onChange={(v) => keyword.onChange(v)}
        onPatch={(p) => patch(p)}
        onSubmit={onSubmit}
        middleware={middleware}
        placeholder={keywordPlaceholder ?? "Search reviews..."}
      />
      <TagPicker
        value={tags.value ?? []}
        onChange={(v) => tags.onChange(v.length ? v : undefined)}
        label={t("search.input.tags_label")}
        placeholder={t("search.input.tags_hint")}
      />
      <AppliedFilterChips
        query={query}
        hide={implicit}
        rendered={rendered}
        onRemove={patch}
      />
    </div>
  );
};
