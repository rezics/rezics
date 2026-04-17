import type { ContentSearchOptions } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { BookSearchInput } from "@/book-library/components/BookSearch/BookSearch";

export type HomeSearchBarProps = object;

/**
 * HomeSearchBar
 * Wraps the BookSearchContainer; on submit, navigate to /search.
 */
export const HomeSearchBar: React.FC<HomeSearchBarProps> = () => {
  const navigate = useNavigate();
  function handleSearch(options: ContentSearchOptions) {
    const params = new URLSearchParams();
    if (options.keyword) params.set("keyword", options.keyword);
    if (options.nsfw) params.set("nsfw", "true");
    if (options.isLicensed) params.set("isLicensed", "true");
    if (options.type) {
      const types = Array.isArray(options.type)
        ? options.type.join(",")
        : options.type;
      params.set("type", types);
    }
    const query = params.toString();
    navigate({ to: query ? `/search?${query}` : "/search" });
  }
  return (
    <BookSearchInput onSearch={handleSearch} hiddenWordCountFilter={true} />
  );
};

export default HomeSearchBar;
