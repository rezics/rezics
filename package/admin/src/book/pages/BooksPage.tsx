import { type BookDTO, bookQueries } from "@rezics/api/book/book";
import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { BookListResponse } from "@rezics/contract";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useMatchRoute } from "@tanstack/react-router";
import React from "react";
import { SearchablePaginatedTableCard } from "@/components/list/SearchablePaginatedTableCard";
import type { PaginatedColumn } from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";
import { fmtDate } from "@/utils/format";

import { getI18nRuntime } from "@rezics/i18n/runtime";
/** Extract the best title from the translations array. */
function extractTitle(book: BookDTO): string {
  const translations = book.translations;
  if (!translations?.length)
    return getI18nRuntime().i18n.t("admin:unit_no_title");
  // Prefer default language match, fall back to first translation
  const primary =
    translations.find((t) => t.language === (book as any).defaultLanguage) ??
    translations[0];
  return primary?.title || getI18nRuntime().i18n.t("admin:unit_no_title");
}

/** Format credit attribution into a readable string. */
function formatCredits(book: BookDTO): string {
  const credits = book.creditAttributions ?? [];
  if (!credits.length) return "-";
  return credits.map((c) => `${c.name} (${c.role})`).join(", ");
}

export default function BooksPage() {
  const matchRoute = useMatchRoute();
  const isMeiliMode = Boolean(matchRoute({ to: "/book/meili" }));

  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(20);

  const trimmedQuery = query.trim();
  const start = page * limit;

  React.useEffect(() => {
    setQ("");
    setQuery("");
    setPage(0);
    setLimit(20);
  }, []);

  const listQuery = useQuery({
    ...bookQueries.list({ start, limit }),
    enabled: !isMeiliMode && trimmedQuery.length === 0,
  });

  const searchQuery = useQuery({
    ...bookQueries.search(trimmedQuery, { start, limit }),
    enabled: !isMeiliMode && trimmedQuery.length > 0,
  });

  const meiliQuery = useQuery({
    ...contentSearchQueryOptions({
      keyword: query || undefined,
      type: "BOOK",
      offset: start,
      limit,
    }),
    enabled: isMeiliMode,
  });

  const normalQuery = trimmedQuery.length > 0 ? searchQuery : listQuery;
  const data = isMeiliMode ? meiliQuery.data : normalQuery.data;
  const books = isMeiliMode
    ? ((data as any)?.items ?? [])
    : ((data as BookListResponse | undefined)?.books ?? []);
  const total = data?.total;

  const columns = React.useMemo(() => {
    const cols: PaginatedColumn<BookDTO>[] = [
      {
        id: "unitId",
        header: getI18nRuntime().i18n.t("common:unit_id"),
        minWidth: 220,
        cell: (b) => <span className="text-sm font-mono">{b.unitId}</span>,
      },
      {
        id: "title",
        header: getI18nRuntime().i18n.t("common:title"),
        minWidth: 260,
        cell: (b) => (
          <span className="text-sm font-bold whitespace-nowrap">
            {extractTitle(b)}
          </span>
        ),
      },
      {
        id: "isbn13",
        header: getI18nRuntime().i18n.t("admin:book_isbn13"),
        minWidth: 160,
        cell: (b) => b.isbn13 || "-",
      },
      {
        id: "credits",
        header: getI18nRuntime().i18n.t("admin:book_credits"),
        minWidth: 260,
        cell: (b) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={(props) => (
                  <span
                    className="text-sm whitespace-nowrap inline-block max-w-[240px] overflow-hidden text-ellipsis"
                    {...props}
                  >
                    {formatCredits(b)}
                  </span>
                )}
              />
              <TooltipContent>{formatCredits(b)}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      {
        id: "user",
        header: getI18nRuntime().i18n.t("common:user"),
        minWidth: 200,
        cell: (b) => (
          <div className="flex flex-col">
            <span className="text-sm whitespace-nowrap">
              {b.user?.name ?? b.userId ?? "-"}
            </span>
            {b.user?.slug ? (
              <span className="text-xs text-text-secondary whitespace-nowrap">
                @{b.user.slug}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "createdAt",
        header: getI18nRuntime().i18n.t("common:created"),
        minWidth: 170,
        cell: (b) => fmtDate(b.createdAt),
      },
      {
        id: "updatedAt",
        header: getI18nRuntime().i18n.t("common:updated"),
        minWidth: 170,
        cell: (b) => fmtDate(b.updatedAt),
      },
      {
        id: "actions",
        header: getI18nRuntime().i18n.t("common:actions"),
        minWidth: 140,
        cell: (b) => (
          <Button
            size="sm"
            variant="outline"
            render={(props) => (
              <Link to="/unit/$unitId" params={{ unitId: b.unitId }} {...props}>
                {getI18nRuntime().i18n.t("admin:book_edit_unit")}
              </Link>
            )}
          />
        ),
      },
    ];
    return cols;
  }, []);

  return (
    <Page
      title={
        isMeiliMode
          ? getI18nRuntime().i18n.t("admin:book_list_meili_title")
          : getI18nRuntime().i18n.t("admin:book_list_title")
      }
      description={
        isMeiliMode
          ? getI18nRuntime().i18n.t("admin:book_list_meili_description")
          : getI18nRuntime().i18n.t("admin:book_list_description")
      }
    >
      <SearchablePaginatedTableCard<BookDTO>
        searchInputId="book-search"
        searchPlaceholder={
          isMeiliMode
            ? getI18nRuntime().i18n.t("admin:book_meili_search_placeholder")
            : getI18nRuntime().i18n.t("admin:book_search_placeholder")
        }
        errorLabel={getI18nRuntime().i18n.t("admin:book_failed_load_list")}
        q={q}
        onQChange={setQ}
        onSearch={() => {
          setPage(0);
          setQuery(q.trim());
        }}
        isLoading={isMeiliMode ? meiliQuery.isLoading : normalQuery.isLoading}
        isError={isMeiliMode ? meiliQuery.isError : normalQuery.isError}
        error={isMeiliMode ? meiliQuery.error : normalQuery.error}
        columns={columns}
        rows={books}
        getRowId={(b) => b.unitId}
        count={typeof total === "number" ? total : 0}
        page={page}
        rowsPerPage={limit}
        onPageChange={(nextPage) => setPage(nextPage)}
        onRowsPerPageChange={(next) => {
          setLimit(next);
          setPage(0);
        }}
      />
    </Page>
  );
}
