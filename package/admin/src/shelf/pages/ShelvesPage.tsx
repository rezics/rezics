import { type ShelfDTO, shelfQueries } from "@rezics/api/shelf/shelf";
import type { UnitTranslationDTO } from "@rezics/contract";
import {
  admin_auth_actions_title,
  admin_shelf_description,
  admin_shelf_title,
  admin_unit_no_title,
  common_created,
  common_edit,
  common_slug,
  common_status,
  common_title,
  common_unit_id,
  common_updated,
  common_user,
} from "@rezics/i18n/messages";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { SearchablePaginatedTableCard } from "@/components/list/SearchablePaginatedTableCard";
import type { PaginatedColumn } from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";
import { fmtDate } from "@/utils/format";

function getPrimaryTitle(translations?: UnitTranslationDTO[] | null): string {
  if (!translations?.length) return admin_unit_no_title();
  return translations[0]?.title?.trim() || admin_unit_no_title();
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
  const [containsWorkUnitId, setContainsWorkUnitId] = React.useState("");
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
      containsWorkUnitId: optionalFilter(containsWorkUnitId),
    }),
  );

  const shelves = listQuery.data?.shelves ?? [];
  const total = listQuery.data?.total ?? 0;

  const columns = React.useMemo<PaginatedColumn<ShelfDTO>[]>(
    () => [
      {
        id: "unitId",
        header: common_unit_id(),
        minWidth: 220,
        cell: (shelf) => (
          <span className="text-sm font-mono text-text-secondary">
            {shelf.unitId}
          </span>
        ),
      },
      {
        id: "title",
        header: common_title(),
        minWidth: 220,
        cell: (shelf) => (
          <span className="text-sm font-medium">
            {getPrimaryTitle(shelf.translations)}
          </span>
        ),
      },
      {
        id: "slug",
        header: common_slug(),
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
        header: common_user(),
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
        header: common_status(),
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
        header: common_created(),
        minWidth: 170,
        cell: (shelf) => fmtDate(shelf.createdAt),
      },
      {
        id: "updatedAt",
        header: common_updated(),
        minWidth: 170,
        cell: (shelf) => fmtDate(shelf.updatedAt),
      },
      {
        id: "actions",
        header: admin_auth_actions_title(),
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
                {common_edit()}
              </Link>
            )}
          />
        ),
      },
    ],
    [],
  );

  return (
    <Page title={admin_shelf_title()} description={admin_shelf_description()}>
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
                {common_user()}
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
            <div className="flex flex-col gap-1">
              <Label htmlFor="shelf-filter-work" className="text-xs">
                Contains work
              </Label>
              <Input
                id="shelf-filter-work"
                value={containsWorkUnitId}
                onChange={(event) => {
                  setContainsWorkUnitId(event.target.value);
                  setPage(0);
                }}
                placeholder="work unit id"
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
