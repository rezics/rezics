import { type RealmDTO, realmQueries } from "@rezics/api/realm/realm";
import type { UnitTranslationDTO } from "@rezics/contract";
import {
  admin_auth_actions_title,
  admin_realm_description,
  admin_realm_title,
  admin_unit_no_title,
  common_all,
  common_created,
  common_edit,
  common_no,
  common_slug,
  common_title,
  common_unit_id,
  common_updated,
  common_user,
  common_yes,
} from "@rezics/i18n/messages";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { SearchablePaginatedTableCard } from "@/components/list/SearchablePaginatedTableCard";
import type { PaginatedColumn } from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";
import { fmtDate } from "@/utils/format";

type BooleanFilter = "all" | "true" | "false";

function getPrimaryTitle(translations?: UnitTranslationDTO[] | null): string {
  if (!translations?.length) return admin_unit_no_title();
  return translations[0]?.title?.trim() || admin_unit_no_title();
}

function optionalFilter(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalBoolean(value: BooleanFilter) {
  if (value === "all") return undefined;
  return value === "true";
}

export default function RealmsPage() {
  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [unitIds, setUnitIds] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [isPublic, setIsPublic] = React.useState<BooleanFilter>("all");
  const [isOfficial, setIsOfficial] = React.useState<BooleanFilter>("all");
  const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(20);

  const trimmedQuery = query.trim();
  const start = page * limit;
  const filters = {
    start,
    limit,
    ids: optionalFilter(unitIds),
    userId: optionalFilter(userId),
    isPublic: optionalBoolean(isPublic),
    isOfficial: optionalBoolean(isOfficial),
  };

  const listQuery = useQuery({
    ...realmQueries.list(filters),
    enabled: trimmedQuery.length === 0,
  });
  const searchQuery = useQuery({
    ...realmQueries.search(trimmedQuery, filters),
    enabled: trimmedQuery.length > 0,
  });

  const activeQuery = trimmedQuery.length > 0 ? searchQuery : listQuery;
  const realms = activeQuery.data?.realms ?? [];
  const total = activeQuery.data?.total ?? 0;

  const columns = React.useMemo<PaginatedColumn<RealmDTO>[]>(
    () => [
      {
        id: "unitId",
        header: common_unit_id(),
        minWidth: 220,
        cell: (realm) => (
          <span className="text-sm font-mono text-text-secondary">
            {realm.unitId}
          </span>
        ),
      },
      {
        id: "title",
        header: common_title(),
        minWidth: 220,
        cell: (realm) => (
          <span className="text-sm font-medium">
            {getPrimaryTitle(realm.translations)}
          </span>
        ),
      },
      {
        id: "slug",
        header: common_slug(),
        minWidth: 160,
        cell: (realm) => (
          <span className="text-sm font-mono">{realm.slug ?? "-"}</span>
        ),
      },
      {
        id: "user",
        header: common_user(),
        minWidth: 200,
        cell: (realm) => (
          <div className="flex flex-col">
            <span className="text-sm whitespace-nowrap">
              {realm.user?.name ?? realm.userId ?? "-"}
            </span>
            {realm.user?.slug ? (
              <span className="text-xs text-text-secondary whitespace-nowrap">
                @{realm.user.slug}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "public",
        header: "Public",
        minWidth: 100,
        cell: (realm) => (
          <span className="text-sm">
            {realm.isPublic ? common_yes() : common_no()}
          </span>
        ),
      },
      {
        id: "official",
        header: "Official",
        minWidth: 100,
        cell: (realm) => (
          <span className="text-sm">
            {realm.isOfficial ? common_yes() : common_no()}
          </span>
        ),
      },
      {
        id: "members",
        header: "Members",
        minWidth: 100,
        cell: (realm) => realm.memberCount,
      },
      {
        id: "createdAt",
        header: common_created(),
        minWidth: 170,
        cell: (realm) => fmtDate(realm.createdAt),
      },
      {
        id: "updatedAt",
        header: common_updated(),
        minWidth: 170,
        cell: (realm) => fmtDate(realm.updatedAt),
      },
      {
        id: "actions",
        header: admin_auth_actions_title(),
        minWidth: 120,
        cell: (realm) => (
          <Button
            size="sm"
            variant="outline"
            render={(props) => (
              <Link
                to="/unit/$unitId"
                params={{ unitId: realm.unitId }}
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
    <Page title={admin_realm_title()} description={admin_realm_description()}>
      <SearchablePaginatedTableCard<RealmDTO>
        searchInputId="realm-search"
        searchPlaceholder="title, slug, or keyword"
        q={q}
        onQChange={setQ}
        onSearch={() => {
          setPage(0);
          setQuery(q.trim());
        }}
        filters={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="realm-filter-ids" className="text-xs">
                {common_unit_id()}
              </Label>
              <Input
                id="realm-filter-ids"
                value={unitIds}
                onChange={(event) => {
                  setUnitIds(event.target.value);
                  setPage(0);
                }}
                placeholder="unit id or CSV"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="realm-filter-user" className="text-xs">
                {common_user()}
              </Label>
              <Input
                id="realm-filter-user"
                value={userId}
                onChange={(event) => {
                  setUserId(event.target.value);
                  setPage(0);
                }}
                placeholder="user id"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="realm-filter-public" className="text-xs">
                Public
              </Label>
              <Select
                value={isPublic}
                onValueChange={(value) => {
                  setIsPublic(value as BooleanFilter);
                  setPage(0);
                }}
              >
                <SelectTrigger id="realm-filter-public">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{common_all()}</SelectItem>
                  <SelectItem value="true">{common_yes()}</SelectItem>
                  <SelectItem value="false">{common_no()}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="realm-filter-official" className="text-xs">
                Official
              </Label>
              <Select
                value={isOfficial}
                onValueChange={(value) => {
                  setIsOfficial(value as BooleanFilter);
                  setPage(0);
                }}
              >
                <SelectTrigger id="realm-filter-official">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{common_all()}</SelectItem>
                  <SelectItem value="true">{common_yes()}</SelectItem>
                  <SelectItem value="false">{common_no()}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        isLoading={activeQuery.isLoading}
        isError={activeQuery.isError}
        error={activeQuery.error}
        columns={columns}
        rows={realms}
        getRowId={(realm) => realm.unitId}
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
