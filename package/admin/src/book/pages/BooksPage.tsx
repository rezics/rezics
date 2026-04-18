import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { type BookDTO, bookQueries } from "@rezics/api/book/book";
import { meiliContentApi } from "@rezics/api/meili/meili.api";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
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

/** Format person/org credits into a readable string. */
function formatCredits(book: BookDTO): string {
  const parts: string[] = [];
  if (book.personCredits?.length) {
    parts.push(...book.personCredits.map((c) => `${c.name} (${c.roleKey})`));
  }
  if (book.orgCredits?.length) {
    parts.push(...book.orgCredits.map((c) => `${c.name} (${c.roleKey})`));
  }
  return parts.length ? parts.join(", ") : "-";
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
    queryKey: ["meili-books", page, limit, query],
    queryFn: () =>
      meiliContentApi.contentSearch({
        keyword: query || undefined,
        type: "BOOK",
        offset: start,
        limit,
      }),
    enabled: isMeiliMode,
  });

  const normalQuery = trimmedQuery.length > 0 ? searchQuery : listQuery;
  const data = isMeiliMode ? meiliQuery.data : normalQuery.data;
  const books = (isMeiliMode ? (data as any)?.items : data?.books) ?? [];
  const total = data?.total;

  const columns = React.useMemo(() => {
    const cols: PaginatedColumn<BookDTO>[] = [
      {
        id: "unitId",
        header: "Unit ID",
        minWidth: 220,
        cell: (b) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {b.unitId}
          </Typography>
        ),
      },
      {
        id: "title",
        header: "Title",
        minWidth: 260,
        cell: (b) => (
          <Typography variant="body2" fontWeight={700} noWrap>
            {extractTitle(b)}
          </Typography>
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
          <Tooltip title={formatCredits(b)} arrow>
            <Typography variant="body2" noWrap sx={{ maxWidth: 240 }}>
              {formatCredits(b)}
            </Typography>
          </Tooltip>
        ),
      },
      {
        id: "user",
        header: "User",
        minWidth: 200,
        cell: (b) => (
          <Stack spacing={0}>
            <Typography variant="body2" noWrap>
              {b.user?.name ?? b.userId ?? "-"}
            </Typography>
            {b.user?.slug ? (
              <Typography variant="caption" color="text.secondary" noWrap>
                @{b.user.slug}
              </Typography>
            ) : null}
          </Stack>
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
          <Button
            size="small"
            component={Link}
            to={`/units/${b.unitId}`}
            variant="outlined"
          >
            Edit Unit
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
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems="stretch"
            >
              <TextField
                size="small"
                label="Search"
                placeholder="q/title/isbn..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(0);
                    setQuery(q.trim());
                  }
                }}
                fullWidth
              />
              <IconButton
                aria-label="search"
                onClick={() => {
                  setPage(0);
                  setQuery(q.trim());
                }}
                sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}
              >
                <SearchIcon />
              </IconButton>
            </Stack>
            <Divider sx={{ my: 2 }} />

            {(isMeiliMode ? meiliQuery.isLoading : normalQuery.isLoading) ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (isMeiliMode ? meiliQuery.isError : normalQuery.isError) ? (
              <Box>
                <Typography color="error" variant="body2">
                  Failed to load books.
                </Typography>
                {(isMeiliMode ? meiliQuery.error : normalQuery.error) ? (
                  <Typography color="error" variant="caption">
                    {String(isMeiliMode ? meiliQuery.error : normalQuery.error)}
                  </Typography>
                ) : null}
              </Box>
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
