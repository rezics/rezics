import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import { type UnitDTO, unitQueries } from "@rezics/api/unit/unit";
import type { UnitListResponse } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Separator,
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
import { Plus as AddIcon, Search as SearchIcon } from "lucide-react";

/** Extract the best title from the translations array on a UnitDTO. */
function extractUnitTitle(unit: UnitDTO): string {
  const translations = unit.translations;
  if (!translations?.length) return "(no title)";
  const primary =
    translations.find((t) => t.language === unit.defaultLanguage) ??
    translations[0];
  return primary?.title || "(no title)";
}

export default function UnitsPage() {
  const matchRoute = useMatchRoute();
  const isMeiliMode = Boolean(matchRoute({ to: "/unit/meili" }));

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
    ...unitQueries.list({ start, limit }),
    enabled: !isMeiliMode && trimmedQuery.length === 0,
  });

  const searchQuery = useQuery({
    ...unitQueries.search(trimmedQuery, { start, limit }),
    enabled: !isMeiliMode && trimmedQuery.length > 0,
  });

  const meiliQuery = useQuery({
    ...contentSearchQueryOptions({
      keyword: query || undefined,
      offset: start,
      limit,
    }),
    enabled: isMeiliMode,
  });

  const normalQuery = trimmedQuery.length > 0 ? searchQuery : listQuery;
  const data = isMeiliMode ? meiliQuery.data : normalQuery.data;
  const units = isMeiliMode
    ? ((data as any)?.items ?? [])
    : ((data as UnitListResponse | undefined)?.units ?? []);
  const total = data?.total;

  const columns = React.useMemo(() => {
    const cols: PaginatedColumn<UnitDTO>[] = [
      {
        id: "id",
        header: "ID",
        minWidth: 220,
        cell: (u) => <span className="text-sm font-mono">{u.id}</span>,
      },
      {
        id: "title",
        header: "Title",
        minWidth: 220,
        cell: (u) => (
          <span className="text-sm font-semibold whitespace-nowrap">
            {extractUnitTitle(u)}
          </span>
        ),
      },
      {
        id: "type",
        header: "Type",
        minWidth: 120,
        cell: (u) =>
          u.type ? (
            <Badge variant="secondary">{u.type}</Badge>
          ) : (
            "-"
          ),
      },
      {
        id: "status",
        header: "Status",
        minWidth: 120,
        cell: (u) => u.status || "-",
      },
      {
        id: "user",
        header: "User",
        minWidth: 200,
        cell: (u) => (
          <div className="flex flex-col">
            <span className="text-sm whitespace-nowrap">
              {u.user?.name ?? u.userId}
            </span>
            {u.user?.slug ? (
              <span className="text-xs text-rezics-color-fg-muted whitespace-nowrap">
                @{u.user.slug}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        minWidth: 170,
        cell: (u) => fmtDate(u.createdAt),
      },
      {
        id: "updatedAt",
        header: "Updated",
        minWidth: 170,
        cell: (u) => fmtDate(u.updatedAt),
      },
      {
        id: "actions",
        header: "Actions",
        minWidth: 120,
        cell: (u) => (
          <Button asChild size="sm" variant="outline">
            <Link to={`/unit/${u.id}`}>Edit</Link>
          </Button>
        ),
      },
    ];
    return cols;
  }, []);

  return (
    <Page
      title={isMeiliMode ? "Units (Meili)" : "Units"}
      description={
        isMeiliMode ? "管理 Unit（Meili 搜索）" : "管理 Unit（普通列表）"
      }
    >
      {isMeiliMode ? (
        <SearchablePaginatedTableCard<UnitDTO>
          searchPlaceholder="title/userId/type..."
          q={q}
          onQChange={setQ}
          onSearch={() => {
            setPage(0);
            setQuery(q.trim());
          }}
          toolbarRight={
            <Button asChild className="whitespace-nowrap">
              <Link to="/unit/create">
                <AddIcon className="size-4" />
                Create
              </Link>
            </Button>
          }
          isLoading={meiliQuery.isLoading}
          isError={meiliQuery.isError}
          error={meiliQuery.error}
          columns={columns}
          rows={units}
          getRowId={(u) => u.id}
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
                <Label htmlFor="unit-search" className="text-xs">
                  Search
                </Label>
                <Input
                  id="unit-search"
                  placeholder="q/userId/type..."
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
              <Button asChild className="whitespace-nowrap">
                <Link to="/unit/create">
                  <AddIcon className="size-4" />
                  Create
                </Link>
              </Button>
            </div>

            <Separator className="my-4" />

            {normalQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : normalQuery.isError ? (
              <div>
                <p className="text-sm text-rezics-color-danger">
                  Failed to load units.
                </p>
                {normalQuery.error ? (
                  <p className="text-xs text-rezics-color-danger">
                    {String(normalQuery.error)}
                  </p>
                ) : null}
              </div>
            ) : (
              <PaginatedTable<UnitDTO>
                columns={columns}
                rows={units}
                getRowId={(u) => u.id}
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
