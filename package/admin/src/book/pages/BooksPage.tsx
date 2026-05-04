import { type BookDTO, bookQueries } from "@rezics/api/book/book";
import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { BookListResponse } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useMatchRoute } from "@tanstack/react-router";
import React from "react";
import { SearchablePaginatedTableCard } from "@/components/list/SearchablePaginatedTableCard";
import {
  type PaginatedColumn,
  PaginatedTable,
} from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";
import { fmtDate } from "@/utils/format";
import { Search as SearchIcon } from "lucide-react";

/** Extract the best title from the translations array. */
function extractTitle(book: BookDTO): string {
  const translations = book.translations;
  if (!translations?.length) return "(no title)";
  // Prefer default language match, fall back to first translation
  const primary =
    translations.find((t) => t.language === (book as any).defaultLanguage) ??
    translations[0];
  return primary?.title || "(no title)";
}

/** Format attribution credits into a readable string. */
function formatCredits(book: BookDTO): string {
  const attributions = book.attributions ?? [];
  if (!attributions.length) return "-";
  return attributions.map((c) => `${c.name} (${c.role})`).join(", ");
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
        header: "Unit ID",
        minWidth: 220,
        cell: (b) => <span className="text-sm font-mono">{b.unitId}</span>,
      },
      {
        id: "title",
        header: "Title",
        minWidth: 260,
        cell: (b) => (
          <span className="text-sm font-bold whitespace-nowrap">
            {extractTitle(b)}
          </span>
        ),
      },
      {
        id: "isbn13",
        header: "ISBN-13",
        minWidth: 160,
        cell: (b) => b.isbn13 || "-",
      },
      {
        id: "credits",
        header: "Credits",
        minWidth: 260,
        cell: (b) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="text-sm whitespace-nowrap inline-block max-w-[240px] overflow-hidden text-ellipsis"
                >
                  {formatCredits(b)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{formatCredits(b)}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
      },
      {
        id: "user",
        header: "User",
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
        header: "Created",
        minWidth: 170,
        cell: (b) => fmtDate(b.createdAt),
      },
      {
        id: "updatedAt",
        header: "Updated",
        minWidth: 170,
        cell: (b) => fmtDate(b.updatedAt),
      },
      {
        id: "actions",
        header: "Actions",
        minWidth: 140,
        cell: (b) => (
          <Button asChild size="sm" variant="outline">
            <Link to={`/unit/${b.unitId}`}>Edit Unit</Link>
          </Button>
        ),
      },
    ];
    return cols;
  }, []);

  return (
    <Page
      title={isMeiliMode ? "Books (Meili)" : "Books"}
      description={
        isMeiliMode ? "管理 Book（Meili 搜索）" : "管理 Book（普通列表）"
      }
    >
      {isMeiliMode ? (
        <SearchablePaginatedTableCard<BookDTO>
          searchPlaceholder="title/isbn/keyword..."
          q={q}
          onQChange={setQ}
          onSearch={() => {
            setPage(0);
            setQuery(q.trim());
          }}
          isLoading={meiliQuery.isLoading}
          isError={meiliQuery.isError}
          error={meiliQuery.error}
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
      ) : (
        <Card>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch">
              <div className="flex-1 flex flex-col gap-1">
                <Label htmlFor="book-search" className="text-xs">
                  Search
                </Label>
                <Input
                  id="book-search"
                  placeholder="q/title/isbn..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPage(0);
                      setQuery(q.trim());
                    }
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="search"
                onClick={() => {
                  setPage(0);
                  setQuery(q.trim());
                }}
                className="self-end sm:self-center"
              >
                <SearchIcon className="size-4" />
              </Button>
            </div>
            <Separator className="my-4" />

            {(isMeiliMode ? meiliQuery.isLoading : normalQuery.isLoading) ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : (isMeiliMode ? meiliQuery.isError : normalQuery.isError) ? (
              <div>
                <p className="text-sm text-error-text">
                  Failed to load books.
                </p>
                {(isMeiliMode ? meiliQuery.error : normalQuery.error) ? (
                  <p className="text-xs text-error-text">
                    {String(isMeiliMode ? meiliQuery.error : normalQuery.error)}
                  </p>
                ) : null}
              </div>
            ) : (
              <PaginatedTable<BookDTO>
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
            )}
          </CardContent>
        </Card>
      )}
    </Page>
  );
}
