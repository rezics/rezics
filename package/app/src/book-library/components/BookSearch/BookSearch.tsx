import type { ContentSearchOptions } from "@rezics/contract";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type SearchInfo, SearchInput, toContentSearchOptions } from "@/search";

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
  onSearch: (options: ContentSearchOptions) => void;
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

  const tagGroups = useMemo(() => ({}), []);

  const handleSearch = (info: SearchInfo) => {
    const options = toContentSearchOptions(info);

    if (sort.type && sort.type !== "relevance") {
      const sortField =
        sort.type === "createdAt" || sort.type === "updatedAt"
          ? sort.type
          : "createdAt";
      options.sort = {
        field: sortField,
        order: sort.order,
      };
    }

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
