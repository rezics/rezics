"use client";

import { SearchContent, SearchContentView, type Category } from "./content";

function FixedSearch({
  query,
  category,
  disabled = false,
}: {
  readonly query: string;
  readonly category: Category;
  readonly disabled?: boolean;
}) {
  return (
    <SearchContentView
      category={category}
      disabled={disabled}
      onCategoryChange={() => {}}
      onQueryChange={() => {}}
      query={query}
    />
  );
}

export default {
  Default: <SearchContent />,
  EmptyMobile: (
    <div className="w-[320px] p-4">
      <FixedSearch category="all" query="" />
    </div>
  ),
  LongQueryBooks: (
    <div className="w-[320px] p-4">
      <FixedSearch
        category="books"
        query="multilingual disputed edition with very long title and missing ISBN"
      />
    </div>
  ),
  UsersDisabled: (
    <div className="p-4">
      <FixedSearch disabled category="users" query="permission locked directory search" />
    </div>
  ),
  WideTags: (
    <div className="w-[1536px] p-4">
      <FixedSearch category="tags" query="classification" />
    </div>
  ),
};
