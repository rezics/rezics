import type { BookDTO, ContentSearchDocument } from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useMatchRoute } from "@tanstack/react-router";
import React from "react";
import { SearchablePaginatedTableCard } from "@/admin/components/list/SearchablePaginatedTableCard";
import type { PaginatedColumn } from "@/admin/components/table/PaginatedTable";
import { Page } from "@/admin/core/layouts/Page";
import { Link } from "@/admin/shared/ui/link";
import { fmtDate } from "@/admin/utils/format";
import {
  useBookContentSearchQuery,
  useBookListQuery,
} from "../hooks/useBookAdminQueries";

/**
 * Extract the best title from the translations array.
 * 从 translations 数组中提取最合适的标题。
 */
function extractTitle(book: BookDTO): string {
  const translations = book.translations;
  if (!translations?.length)
    return getI18nRuntime().i18n.t("admin:unit_no_title");
  // Prefer default language match, fall back to first translation
  // 优先匹配默认语言，否则回退到第一条 translation。
  const primary =
    translations.find((t) => t.language === (book as any).defaultLanguage) ??
    translations[0];
  return primary?.title || getI18nRuntime().i18n.t("admin:unit_no_title");
}

/**
 * Format credit attribution into a readable string.
 * 将贡献署名格式化为可读字符串。
 */
function formatCredits(book: BookDTO): string {
  const credits = book.creditAttributions ?? [];
  if (!credits.length) return "-";
  return credits.map((c) => `${c.name} (${c.role})`).join(", ");
}

function mapContentSearchDocumentToBookRow(
  document: ContentSearchDocument,
): BookDTO {
  const book = document as unknown as Partial<BookDTO>;
  const translations =
    book.translations ??
    document.translations?.map((translation) => ({
      ...translation,
      unitId: document.id,
    }));

  return {
    ...book,
    unitId: book.unitId ?? document.id,
    userId: book.userId ?? document.userId,
    defaultLanguage: book.defaultLanguage ?? document.defaultLanguage,
    resolvedLanguage: book.resolvedLanguage ?? document.resolvedLanguage,
    title: book.title ?? document.title ?? document.titles[0] ?? null,
    subtitle: book.subtitle ?? document.subtitle ?? document.subtitles[0] ?? null,
    summary: book.summary ?? document.summary ?? document.summaries[0] ?? null,
    description: book.description ?? document.description ?? null,
    translations,
    creditAttributions:
      book.creditAttributions ??
      document.creditNames.map((name) => ({
        entityId: name,
        name,
        role: "author" as const,
      })),
    createdAt: book.createdAt ?? document.createdAt,
    updatedAt: book.updatedAt ?? document.updatedAt,
    publishedAt: book.publishedAt ?? document.publishedAt,
    coverUrl: book.coverUrl ?? document.coverUrl,
    rating: book.rating ?? document.rating,
    visibility: book.visibility ?? document.visibility,
    textLength: book.textLength ?? document.textLength ?? undefined,
    isLicensed: book.isLicensed ?? document.isLicensed,
    referenceCount: book.referenceCount ?? document.referenceCount,
    shareCount: book.shareCount ?? document.shareCount,
  };
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

  const listQuery = useBookListQuery(
    { start, limit },
    trimmedQuery,
    !isMeiliMode,
  );

  const meiliQuery = useBookContentSearchQuery(
    {
      keyword: query || undefined,
      type: "BOOK",
      offset: start,
      limit,
    },
    isMeiliMode,
  );

  const data = isMeiliMode ? meiliQuery.data : listQuery.data;
  const books = isMeiliMode
    ? (meiliQuery.data?.items ?? []).map(mapContentSearchDocumentToBookRow)
    : (listQuery.data?.books ?? []);
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
        isLoading={isMeiliMode ? meiliQuery.isLoading : listQuery.isLoading}
        isError={isMeiliMode ? meiliQuery.isError : listQuery.isError}
        error={isMeiliMode ? meiliQuery.error : listQuery.error}
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
