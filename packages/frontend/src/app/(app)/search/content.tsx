"use client";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n/locale";
import { SearchIcon } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

const CATEGORIES = ["all", "books", "realms", "posts", "users", "tags"] as const;
type Category = (typeof CATEGORIES)[number];

export function SearchContent() {
  const [t] = useT();
  const [{ q, category }, setParams] = useQueryStates({
    q: parseAsString.withDefault(""),
    category: parseAsStringLiteral(CATEGORIES).withDefault("all"),
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-10"
          onChange={(e) => setParams({ q: e.target.value })}
          placeholder={t.nav.searchPlaceholder}
          type="search"
          value={q}
        />
      </div>

      <Tabs
        onValueChange={(details) => setParams({ category: details.value as Category })}
        value={category}
      >
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="books">{t.library.title}</TabsTrigger>
          <TabsTrigger value="realms">{t.nav.realms}</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>
      </Tabs>

      {q.length > 0 ? (
        <SearchResults category={category} query={q} />
      ) : (
        <div className="text-muted-foreground py-12 text-center text-sm">
          {t.nav.searchPlaceholder}
        </div>
      )}
    </div>
  );
}

function SearchResults({ query, category }: { readonly query: string; readonly category: Category }) {
  return (
    <div className="text-muted-foreground space-y-2 py-8 text-center text-sm">
      <p>
        Searching for &ldquo;{query}&rdquo; in {category}...
      </p>
      <p>Search results will appear here once Meilisearch is connected.</p>
    </div>
  );
}
