"use client";

import { SearchIcon } from "lucide-react";
import { useQueryState } from "nuqs";

export function SearchContent() {
  const [query, setQuery] = useQueryState("q", { defaultValue: "" });

  return (
    <div className="space-y-6">
      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <input
          className="border-input bg-background ring-ring/20 w-full rounded-md border py-2 pl-10 pr-4 text-sm focus-visible:ring-2 focus-visible:outline-none"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search books, realms, posts, users..."
          type="search"
          value={query}
        />
      </div>

      {query.length > 0 ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          Searching for &ldquo;{query}&rdquo;...
        </div>
      ) : (
        <div className="text-muted-foreground py-8 text-center text-sm">
          Enter a search term to find content across rezics.
        </div>
      )}
    </div>
  );
}
