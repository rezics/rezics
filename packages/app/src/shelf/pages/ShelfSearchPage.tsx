import type { ShelfDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useMemo, useState } from "react";
import { KeywordInput, useSearchQuery } from "@/search";
import { useLocalizedContentSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import { ShelfCard } from "../components/ShelfCard";
import { mapContentSearchDocToShelfDTO } from "../models/contentSearchDocToShelfDTO";

/**
 * Shelf search page.
 *
 * Keyword-based full-text search for shelves via Meilisearch with optional filters.
 * Supports pagination and respects user's language context.
 *
 * 书架搜索页面。基于关键词的全文搜索，通过 Meilisearch 实现。
 * 支持分页和可选过滤器。尊重用户的语言上下文。
 *
 * Desktop (1200px):
 * +------------------------------------------+
 * | Search Shelves                           |
 * +------------------------------------------+
 * | [Search keyword...] [Search]             |
 * | Filters: [Type ▼] [Sort ▼]               |
 * +------------------------------------------+
 * | [Shelf 1]      [Shelf 2]    [Shelf 3]    |
 * | Cover          Cover        Cover        |
 * | Title 1        Title 2      Title 3      |
 * | 12 items       8 items     15 items      |
 * |                                          |
 * | [Shelf 4]      [Shelf 5]    [Shelf 6]    |
 * | [Prev] 1/12 [Next]                       |
 * +------------------------------------------+
 *
 * Tablet (768px):
 * +----------------------------+
 * | Search Shelves             |
 * +----------------------------+
 * | [Search...] [Search]       |
 * | [Type ▼] [Sort ▼]          |
 * +----------------------------+
 * | [Shelf 1]      [Shelf 2]   |
 * | Cover          Cover       |
 * | Title 1        Title 2     |
 * | 12 items       8 items     |
 * |                            |
 * | [Prev] 1/6 [Next]          |
 * +----------------------------+
 *
 * Mobile (360px):
 * +----------+
 * | Search   |
 * +----------+
 * | [___]    |
 * | [Search] |
 * | [Filters]|
 * +----------+
 * | [Shelf]  |
 * | Cover    |
 * | Title    |
 * | 12 items |
 * +----------+
 * | [Prev]   |
 * | 1/6      |
 * | [Next]   |
 * +----------+
 *
 * Empty State:
 * +-----------+
 * | No results|
 * +-----------+
 */
export function ShelfSearchPage() {
  const { t } = useTranslation(["common", "entity"]);
  const search = useSearchQuery({
    implicitInitial: { type: ["SHELF"] },
  });
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const keywordBind = search.bind("keyword");
  const searchOpts = search.toOptions();

  const { data, isLoading } = useLocalizedContentSearch({
    ...searchOpts,
    offset,
    limit,
  });

  const shelves = useMemo<ShelfDTO[]>(
    () => (data?.items ?? []).map(mapContentSearchDocToShelfDTO),
    [data],
  );
  const total = data?.total ?? 0;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPreviousPage = offset > 0;
  const hasNextPage = offset + limit < total;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">
        {t("entity:shelf_search_title")}
      </h1>

      <div className="mb-6">
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          onSubmit={() => setOffset(0)}
          placeholder={t("entity:shelf_search_placeholder")}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : shelves.length === 0 ? (
        <p className="py-8 text-center text-text-secondary">
          {t("entity:shelf_none_found")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {shelves.map((shelf) => (
              <ShelfCard key={shelf.unitId} shelf={shelf} />
            ))}
          </div>
          {(hasPreviousPage || hasNextPage) && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={!hasPreviousPage || isLoading}
                onClick={() => setOffset((value) => Math.max(0, value - limit))}
              >
                {t("common:prev")}
              </Button>
              <span className="text-sm text-text-secondary">
                {currentPage} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={!hasNextPage || isLoading}
                onClick={() => setOffset((value) => value + limit)}
              >
                {t("common:next")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
