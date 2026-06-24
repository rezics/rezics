"use client";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n/locale";
import { SearchIcon } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

const CATEGORIES = ["all", "books", "realms", "posts", "users", "tags"] as const;
export type Category = (typeof CATEGORIES)[number];

// Runtime membership guard for Ark UI string callback
// Ark UI 字符串回调的运行时成员守卫
const categorySet: ReadonlySet<string> = new Set(CATEGORIES);
const isCategory = (v: string): v is Category => categorySet.has(v);

export function SearchContent() {
  const [{ q, category }, setParams] = useQueryStates({
    q: parseAsString.withDefault(""),
    category: parseAsStringLiteral(CATEGORIES).withDefault("all"),
  });

  return (
    <SearchContentView
      category={category}
      onCategoryChange={(nextCategory) => setParams({ category: nextCategory })}
      onQueryChange={(query) => setParams({ q: query })}
      query={q}
    />
  );
}

export function SearchContentView({
  query,
  category,
  onQueryChange,
  onCategoryChange,
  disabled = false,
}: {
  readonly query: string;
  readonly category: Category;
  readonly onQueryChange: (query: string) => void;
  readonly onCategoryChange: (category: Category) => void;
  readonly disabled?: boolean;
}) {
  const [t] = useT();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-10"
          disabled={disabled}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t.nav.searchPlaceholder}
          type="search"
          value={query}
        />
      </div>

      <Tabs
        onValueChange={(details) => {
          if (isCategory(details.value)) {
            onCategoryChange(details.value);
          }
        }}
        value={category}
      >
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="all">{t.search.all}</TabsTrigger>
          <TabsTrigger value="books">{t.library.title}</TabsTrigger>
          <TabsTrigger value="realms">{t.nav.realms}</TabsTrigger>
          <TabsTrigger value="posts">{t.search.posts}</TabsTrigger>
          <TabsTrigger value="users">{t.search.users}</TabsTrigger>
          <TabsTrigger value="tags">{t.search.tags}</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.length > 0 ? (
        <SearchResults category={category} query={query} />
      ) : (
        <div className="text-muted-foreground py-12 text-center text-sm">
          {t.nav.searchPlaceholder}
        </div>
      )}
    </div>
  );
}

function SearchResults({ query, category }: { readonly query: string; readonly category: Category }) {
  const [t] = useT();
  return (
    <div className="text-muted-foreground space-y-2 py-8 text-center text-sm">
      <p>{t.search.searching(query, category)}</p>
      <p>{t.search.connectingPlaceholder}</p>
    </div>
  );
}
