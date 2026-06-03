import { type ShelfDTO, shelfQueries } from "@rezics/api/shelf/shelf";
import type { UnitTranslationDTO } from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { SearchablePaginatedTableCard } from "@/components/list/SearchablePaginatedTableCard";
import type { PaginatedColumn } from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";
import { fmtDate } from "@/utils/format";

function getPrimaryTitle(translations?: UnitTranslationDTO[] | null): string {
  if (!translations?.length)
    return getI18nRuntime().i18n.t("admin:unit_no_title");
  return (
    translations[0]?.title?.trim() ||
    getI18nRuntime().i18n.t("admin:unit_no_title")
  );
}

function optionalFilter(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default function ShelvesPage() {
  const [q, setQ] = React.useState("");
  const [queryIds, setQueryIds] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [kindKey, setKindKey] = React.useState("");
  const [containsUnitId, setContainsUnitId] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(20);

  const start = page * limit;
  const listQuery = useQuery(
    shelfQueries.list({
      start,
      limit,
      ids: optionalFilter(queryIds),
      userId: optionalFilter(userId),
      kindKey: optionalFilter(kindKey),
      containsUnitId: optionalFilter(containsUnitId),
    }),
  );

  const shelves = listQuery.data?.shelves ?? [];
  const total = listQuery.data?.total ?? 0;

  const columns = React.useMemo<PaginatedColumn<ShelfDTO>[]>(
    () => [
      {
        id: "unitId",
        header: getI18nRuntime().i18n.t("common:unit_id"),
        minWidth: 220,
        cell: (shelf) => (
          <span className="text-sm font-mono text-text-secondary">
            {shelf.unitId}
          </span>
        ),
      },
      {
        id: "title",
        header: getI18nRuntime().i18n.t("common:title"),
        minWidth: 220,
        cell: (shelf) => (
          <span className="text-sm font-medium">
            {getPrimaryTitle(shelf.translations)}
          </span>
        ),
      },
      {
        id: "slug",
        header: getI18nRuntime().i18n.t("common:slug"),
        minWidth: 160,
        cell: (shelf) => (
          <span className="text-sm font-mono">{shelf.slug ?? "-"}</span>
        ),
      },
      {
        id: "kind",
        header: "Kind",
        minWidth: 140,
        cell: (shelf) => shelf.kindKey ?? "-",
      },
      {
        id: "user",
        header: getI18nRuntime().i18n.t("common:user"),
        minWidth: 200,
        cell: (shelf) => (
          <div className="flex flex-col">
            <span className="text-sm whitespace-nowrap">
              {shelf.user?.name ?? shelf.userId ?? "-"}
            </span>
            {shelf.user?.slug ? (
              <span className="text-xs text-text-secondary whitespace-nowrap">
                @{shelf.user.slug}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "status",
        header: getI18nRuntime().i18n.t("common:status"),
        minWidth: 120,
        cell: (shelf) => shelf.status ?? "-",
      },
      {
        id: "visibility",
        header: "Visibility",
        minWidth: 120,
        cell: (shelf) => shelf.visibility ?? "-",
      },
      {
        id: "items",
        header: "Items",
        minWidth: 100,
        cell: (shelf) => shelf.itemCount ?? "-",
      },
      {
        id: "createdAt",
        header: getI18nRuntime().i18n.t("common:created"),
        minWidth: 170,
        cell: (shelf) => fmtDate(shelf.createdAt),
      },
      {
        id: "updatedAt",
        header: getI18nRuntime().i18n.t("common:updated"),
        minWidth: 170,
        cell: (shelf) => fmtDate(shelf.updatedAt),
      },
      {
        id: "actions",
        header: getI18nRuntime().i18n.t("admin:auth_actions_title"),
        minWidth: 120,
        cell: (shelf) => (
          <Button
            size="sm"
            variant="outline"
            render={(props) => (
              <Link
                to="/unit/$unitId"
                params={{ unitId: shelf.unitId }}
                {...props}
              >
                {getI18nRuntime().i18n.t("common:edit")}
              </Link>
            )}
          />
        ),
      },
    ],
    [],
  );

  return (
    <Page
      title={getI18nRuntime().i18n.t("admin:shelf_title")}
      description={getI18nRuntime().i18n.t("admin:shelf_description")}
    >
      <SearchablePaginatedTableCard<ShelfDTO>
        searchInputId="shelf-search"
        searchPlaceholder="unit id or CSV"
        q={q}
        onQChange={setQ}
        onSearch={() => {
          setPage(0);
          setQueryIds(q.trim());
        }}
        filters={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="shelf-filter-user" className="text-xs">
                {getI18nRuntime().i18n.t("common:user")}
              </Label>
              <Input
                id="shelf-filter-user"
                value={userId}
                onChange={(event) => {
                  setUserId(event.target.value);
                  setPage(0);
                }}
                placeholder="user id"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="shelf-filter-kind" className="text-xs">
                Kind
              </Label>
              <Input
                id="shelf-filter-kind"
                value={kindKey}
                onChange={(event) => {
                  setKindKey(event.target.value);
                  setPage(0);
                }}
                placeholder="kind key"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="shelf-filter-unit" className="text-xs">
                Contains unit
              </Label>
              <Input
                id="shelf-filter-unit"
                value={containsUnitId}
                onChange={(event) => {
                  setContainsUnitId(event.target.value);
                  setPage(0);
                }}
                placeholder="unit id"
              />
            </div>
          </div>
        }
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        columns={columns}
        rows={shelves}
        getRowId={(shelf) => shelf.unitId}
        count={total}
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
