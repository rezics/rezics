import type React from "react";
import { BookSearch } from "@/book-library";
import {
  parseSearchString,
  useHomeSearchNavigate,
  useSearchQuery,
} from "@/search";

export type HomeSearchBarProps = object;

/**
 * HomeSearchBar
 * Wraps the BookSearch composer; on submit, navigate to /search with the
 * user's structured query encoded in the URL.
 */
export const HomeSearchBar: React.FC<HomeSearchBarProps> = () => {
  const { navigateByQuery } = useHomeSearchNavigate();
  const search = useSearchQuery({
    middleware: parseSearchString,
  });

  const handleSubmit = () => {
    navigateByQuery(search.query);
  };

  return (
    <BookSearch
      query={search.query}
      bind={search.bind}
      patch={search.patch}
      implicit={search.implicit}
      middleware={search.middleware}
      onSubmit={handleSubmit}
      showWordCount={false}
    />
  );
};
