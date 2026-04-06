import type { BookQueryOptions } from "@rezics/contract";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type SearchInfo, SearchInput } from "@/search";

/** Available sort types for book search. */
export type BookSortType =
  | "relevance"
  | "createdAt"
  | "updatedAt"
  | "favorites"
  | "wordCount"
  | "monthlyVotes"
  | "recommendation"
  | "custom";

/** Props for BookSearchInput component. */
export type BookSearchInputProps = {
  /** Callback when search is triggered. */
  onSearch: (options: BookQueryOptions) => void;
  /** Default search values. */
  defaultValue?: SearchInfo;
  /** Whether to hide the word count filter. */
  hiddenWordCountFilter?: boolean;
};

/**
 * Book Search Input - Search bar with filters for book library.
 *
 * Provides keyword search, tag filtering, and other search options.
 */
export const BookSearchInput: React.FC<BookSearchInputProps> = ({
  onSearch,
  defaultValue,
  hiddenWordCountFilter = false,
}) => {
  const { t } = useTranslation();
  const [sort, _setSort] = useState<{
    type?: BookSortType;
    order?: "asc" | "desc";
  }>({ order: "desc" });

  // TODO 实际上应该由 echokv 提供data
  // const tagGroups = useMemo(
  //   () => ({
  //     presetTags: [
  //       'fiction',
  //       'nonfiction',
  //       'mystery',
  //       'romance',
  //       'history',
  //       'science',
  //       'fantasy',
  //       'philosophy',
  //     ],
  //     statusTags: [
  //       '10万字',
  //       '20万字',
  //       '50万字',
  //       '100万字',
  //       '200万字',
  //       '连载中',
  //       '已完结',
  //     ],
  //   }),
  //   [],
  // );

  const tagGroups = useMemo(() => ({}), []);

  const handleSearch = (info: SearchInfo) => {
    const options: BookQueryOptions = {
      keyword: info.keyword ?? undefined,
      tags: info.tags?.length ? info.tags : undefined,
      user: info.user ?? undefined,
      textLength: info.textLength ?? undefined,
      nsfw: info.nsfw ?? false,
      isLicensed: info.isLicensed ?? undefined,
      sort:
        sort.type || sort.order
          ? { type: sort.type as any, order: sort.order }
          : undefined,
    } as BookQueryOptions;

    // const q = toBookQueryString(options);
    onSearch(options);
  };

  return (
    <div>
      <div id="book-search-input">
        <SearchInput
          onSearch={handleSearch}
          placeholder={t("placeholders.search_books")}
          tagGroups={tagGroups}
          defaultValue={defaultValue}
          hiddenWordCountFilter={hiddenWordCountFilter}
        />
      </div>
      <div className="mt-4" />
    </div>
  );
};
