import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import { type UnitDTO, unitQueries } from "@rezics/api/unit/unit";
import type { UnitListResponse } from "@rezics/contract";
import {
  admin_auth_actions_title,
  admin_auth_email_status,
  admin_unit_failed_load_list,
  admin_unit_list_description,
  admin_unit_list_meili_description,
  admin_unit_list_meili_title,
  admin_unit_list_title,
  admin_unit_no_title,
  admin_unit_search_label,
  admin_unit_search_placeholder,
  common_create,
  common_created,
  common_edit,
  common_id,
  common_search,
  common_title,
  common_type,
  common_updated,
  common_user,
} from "@rezics/i18n/messages";
import { Spinner } from "@rezics/ui";
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
import { Plus as AddIcon, Search as SearchIcon } from "lucide-react";
import React from "react";
import { SearchablePaginatedTableCard } from "@/components/list/SearchablePaginatedTableCard";
import {
  type PaginatedColumn,
  PaginatedTable,
} from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";
import { fmtDate } from "@/utils/format";

/** Extract the best title from the translations array on a UnitDTO. */
function extractUnitTitle(unit: UnitDTO): string {
  const translations = unit.translations;
  if (!translations?.length) return admin_unit_no_title();
  const primary =
    translations.find((t) => t.language === unit.defaultLanguage) ??
    translations[0];
  return primary?.title || admin_unit_no_title();
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
        header: common_id(),
        minWidth: 220,
        cell: (u) => <span className="text-sm font-mono">{u.id}</span>,
      },
      {
        id: "title",
        header: common_title(),
        minWidth: 220,
        cell: (u) => (
          <span className="text-sm font-semibold whitespace-nowrap">
            {extractUnitTitle(u)}
          </span>
        ),
      },
      {
        id: "type",
        header: common_type(),
        minWidth: 120,
        cell: (u) =>
          u.type ? <Badge variant="secondary">{u.type}</Badge> : "-",
      },
      {
        id: "status",
        header: admin_auth_email_status(),
        minWidth: 120,
        cell: (u) => u.status || "-",
      },
      {
        id: "user",
        header: common_user(),
        minWidth: 200,
        cell: (u) => (
          <div className="flex flex-col">
            <span className="text-sm whitespace-nowrap">
              {u.user?.name ?? u.userId}
            </span>
            {u.user?.slug ? (
              <span className="text-xs text-text-secondary whitespace-nowrap">
                @{u.user.slug}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "createdAt",
        header: common_created(),
        minWidth: 170,
        cell: (u) => fmtDate(u.createdAt),
      },
      {
        id: "updatedAt",
        header: common_updated(),
        minWidth: 170,
        cell: (u) => fmtDate(u.updatedAt),
      },
      {
        id: "actions",
        header: admin_auth_actions_title(),
        minWidth: 120,
        cell: (u) => (
          <Button
            size="sm"
            variant="outline"
            render={(props) => (
              <Link to="/unit/$unitId" params={{ unitId: u.id }} {...props}>
                {common_edit()}
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
        isMeiliMode ? admin_unit_list_meili_title() : admin_unit_list_title()
      }
      description={
        isMeiliMode
          ? admin_unit_list_meili_description()
          : admin_unit_list_description()
      }
    >
      {isMeiliMode ? (
        <SearchablePaginatedTableCard<UnitDTO>
          searchPlaceholder={admin_unit_search_placeholder()}
          q={q}
          onQChange={setQ}
          onSearch={() => {
            setPage(0);
            setQuery(q.trim());
          }}
          toolbarRight={
            <Button
              className="whitespace-nowrap"
              render={(props) => (
                <Link to="/unit/create" {...props}>
                  <AddIcon className="size-4" />
                  {common_create()}
                </Link>
              )}
            />
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
                  {admin_unit_search_label()}
                </Label>
                <Input
                  id="unit-search"
                  placeholder={admin_unit_search_placeholder()}
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
                aria-label={common_search()}
                onClick={() => {
                  setPage(0);
                  setQuery(q.trim());
                }}
                className="self-end sm:self-center"
              >
                <SearchIcon className="size-4" />
              </Button>
              <Button
                className="whitespace-nowrap"
                render={(props) => (
                  <Link to="/unit/create" {...props}>
                    <AddIcon className="size-4" />
                    {common_create()}
                  </Link>
                )}
              />
            </div>

            <Separator className="my-4" />

            {normalQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : normalQuery.isError ? (
              <div>
                <p className="text-sm text-error-text">
                  {admin_unit_failed_load_list()}
                </p>
                {normalQuery.error ? (
                  <p className="text-xs text-error-text">
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
