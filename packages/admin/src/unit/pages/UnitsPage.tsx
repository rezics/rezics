import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import { type UnitDTO, unitQueries } from "@rezics/api/unit/unit";
import {
  defaultSupportLanguage,
  type UnitListResponse,
  UnitStatus,
  UnitType,
  UnitVisibility,
} from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import {
  Badge,
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
import { useMatchRoute } from "@tanstack/react-router";
import { Plus as AddIcon } from "lucide-react";
import React from "react";
import { SearchablePaginatedTableCard } from "@/components/list/SearchablePaginatedTableCard";
import type { PaginatedColumn } from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";
import { fmtDate } from "@/utils/format";

/**
 * Extract the best title from the translations array on a UnitDTO.
 * 从 UnitDTO 的 translations 数组中提取最合适的标题。
 */
function extractUnitTitle(unit: UnitDTO): string {
  const translations = unit.translations;
  if (!translations?.length)
    return getI18nRuntime().i18n.t("admin:unit_no_title");
  const primary =
    translations.find(
      (t) =>
        t.language ===
        (defaultSupportLanguage(unit.supportLanguages) ??
          unit.resolvedLanguage),
    ) ?? translations[0];
  return primary?.title || getI18nRuntime().i18n.t("admin:unit_no_title");
}

type UnitOperationsFilters = {
  id: string;
  slug: string;
  title: string;
  type: string;
  ownerUserId: string;
  status: string;
  visibility: string;
};

const emptyFilters: UnitOperationsFilters = {
  id: "",
  slug: "",
  title: "",
  type: "",
  ownerUserId: "",
  status: "",
  visibility: "",
};

const unitTypes = Object.values(UnitType);
const unitStatuses = Object.values(UnitStatus);
const unitVisibilities = Object.values(UnitVisibility);

function optionalFilter(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default function UnitsPage() {
  const matchRoute = useMatchRoute();
  const isMeiliMode = Boolean(matchRoute({ to: "/unit/meili" }));

  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [filterDraft, setFilterDraft] =
    React.useState<UnitOperationsFilters>(emptyFilters);
  const [filters, setFilters] =
    React.useState<UnitOperationsFilters>(emptyFilters);
  const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(20);

  const trimmedQuery = query.trim();
  const start = page * limit;
  const effectiveMeiliMode = isMeiliMode;
  const listFilters = React.useMemo(
    () => ({
      start,
      limit,
      ...(optionalFilter(filters.id) ? { id: filters.id.trim() } : {}),
      ...(optionalFilter(filters.slug) ? { slug: filters.slug.trim() } : {}),
      ...(optionalFilter(filters.title) ? { title: filters.title.trim() } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(optionalFilter(filters.ownerUserId)
        ? { userId: filters.ownerUserId.trim() }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.visibility ? { visibility: filters.visibility } : {}),
    }),
    [filters, limit, start],
  );

  React.useEffect(() => {
    setQ("");
    setQuery("");
    setFilterDraft(emptyFilters);
    setFilters(emptyFilters);
    setPage(0);
    setLimit(20);
  }, []);

  const listQuery = useQuery({
    ...unitQueries.list(listFilters),
    enabled: !effectiveMeiliMode && trimmedQuery.length === 0,
  });

  const searchQuery = useQuery({
    ...unitQueries.search(trimmedQuery, listFilters),
    enabled: !effectiveMeiliMode && trimmedQuery.length > 0,
  });

  const meiliQuery = useQuery({
    ...contentSearchQueryOptions({
      keyword: query || undefined,
      ...(filters.type ? { type: filters.type } : {}),
      ...(optionalFilter(filters.ownerUserId)
        ? { userId: filters.ownerUserId.trim() }
        : {}),
      offset: start,
      limit,
    }),
    enabled: effectiveMeiliMode,
  });

  const normalQuery = trimmedQuery.length > 0 ? searchQuery : listQuery;
  const data = effectiveMeiliMode ? meiliQuery.data : normalQuery.data;
  const units = effectiveMeiliMode
    ? ((data as any)?.items ?? [])
    : ((data as UnitListResponse | undefined)?.units ?? []);
  const total = data?.total;

  const columns = React.useMemo(() => {
    const cols: PaginatedColumn<UnitDTO>[] = [
      {
        id: "id",
        header: getI18nRuntime().i18n.t("common:id"),
        minWidth: 220,
        cell: (u) => <span className="text-sm font-mono">{u.id}</span>,
      },
      {
        id: "title",
        header: getI18nRuntime().i18n.t("common:title"),
        minWidth: 220,
        cell: (u) => (
          <span className="text-sm font-semibold whitespace-nowrap">
            {extractUnitTitle(u)}
          </span>
        ),
      },
      {
        id: "type",
        header: getI18nRuntime().i18n.t("common:type"),
        minWidth: 120,
        cell: (u) =>
          u.type ? <Badge variant="secondary">{u.type}</Badge> : "-",
      },
      {
        id: "status",
        header: getI18nRuntime().i18n.t("admin:auth_email_status"),
        minWidth: 120,
        cell: (u) => u.status || "-",
      },
      {
        id: "user",
        header: getI18nRuntime().i18n.t("common:user"),
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
        header: getI18nRuntime().i18n.t("common:created"),
        minWidth: 170,
        cell: (u) => fmtDate(u.createdAt),
      },
      {
        id: "updatedAt",
        header: getI18nRuntime().i18n.t("common:updated"),
        minWidth: 170,
        cell: (u) => fmtDate(u.updatedAt),
      },
      {
        id: "actions",
        header: getI18nRuntime().i18n.t("admin:auth_actions_title"),
        minWidth: 120,
        cell: (u) => (
          <Button
            size="sm"
            variant="outline"
            render={(props) => (
              <Link to="/unit/$unitId" params={{ unitId: u.id }} {...props}>
                {getI18nRuntime().i18n.t("common:edit")}
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
          ? getI18nRuntime().i18n.t("admin:unit_list_meili_title")
          : getI18nRuntime().i18n.t("admin:unit_list_title")
      }
      description={
        isMeiliMode
          ? getI18nRuntime().i18n.t("admin:unit_list_meili_description")
          : getI18nRuntime().i18n.t("admin:unit_list_description")
      }
    >
      <SearchablePaginatedTableCard<UnitDTO>
        searchInputId="unit-search"
        searchLabel={
          isMeiliMode
            ? getI18nRuntime().i18n.t("common:search")
            : getI18nRuntime().i18n.t("admin:unit_search_label")
        }
        searchPlaceholder={getI18nRuntime().i18n.t(
          "admin:unit_search_placeholder",
        )}
        errorLabel={getI18nRuntime().i18n.t("admin:unit_failed_load_list")}
        q={q}
        onQChange={setQ}
        onSearch={() => {
          setPage(0);
          setQuery(q.trim());
          setFilters(filterDraft);
        }}
        filters={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <div className="flex flex-col gap-1">
              <Label htmlFor="unit-filter-id" className="text-xs">
                Unit ID
              </Label>
              <Input
                id="unit-filter-id"
                value={filterDraft.id}
                onChange={(event) =>
                  setFilterDraft((prev) => ({
                    ...prev,
                    id: event.target.value,
                  }))
                }
                placeholder="unit id"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="unit-filter-slug" className="text-xs">
                Slug
              </Label>
              <Input
                id="unit-filter-slug"
                value={filterDraft.slug}
                onChange={(event) =>
                  setFilterDraft((prev) => ({
                    ...prev,
                    slug: event.target.value,
                  }))
                }
                placeholder="slug"
                disabled={effectiveMeiliMode}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="unit-filter-title" className="text-xs">
                Title
              </Label>
              <Input
                id="unit-filter-title"
                value={filterDraft.title}
                onChange={(event) =>
                  setFilterDraft((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                placeholder="title"
                disabled={effectiveMeiliMode}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="unit-filter-type" className="text-xs">
                Type
              </Label>
              <Select
                value={filterDraft.type || "__all"}
                onValueChange={(value) =>
                  setFilterDraft((prev) => ({
                    ...prev,
                    type: value === "__all" ? "" : value,
                  }))
                }
              >
                <SelectTrigger id="unit-filter-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All</SelectItem>
                  {unitTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="unit-filter-owner" className="text-xs">
                Owner
              </Label>
              <Input
                id="unit-filter-owner"
                value={filterDraft.ownerUserId}
                onChange={(event) =>
                  setFilterDraft((prev) => ({
                    ...prev,
                    ownerUserId: event.target.value,
                  }))
                }
                placeholder="owner unit id"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="unit-filter-status" className="text-xs">
                Status
              </Label>
              <Select
                value={filterDraft.status || "__all"}
                onValueChange={(value) =>
                  setFilterDraft((prev) => ({
                    ...prev,
                    status: value === "__all" ? "" : value,
                  }))
                }
                disabled={effectiveMeiliMode}
              >
                <SelectTrigger id="unit-filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All</SelectItem>
                  {unitStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="unit-filter-visibility" className="text-xs">
                Visibility
              </Label>
              <Select
                value={filterDraft.visibility || "__all"}
                onValueChange={(value) =>
                  setFilterDraft((prev) => ({
                    ...prev,
                    visibility: value === "__all" ? "" : value,
                  }))
                }
                disabled={effectiveMeiliMode}
              >
                <SelectTrigger id="unit-filter-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All</SelectItem>
                  {unitVisibilities.map((visibility) => (
                    <SelectItem key={visibility} value={visibility}>
                      {visibility}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        toolbarRight={
          <>
            <Button
              variant="outline"
              className="whitespace-nowrap"
              onClick={() => {
                setQ("");
                setQuery("");
                setFilterDraft(emptyFilters);
                setFilters(emptyFilters);
                setPage(0);
              }}
            >
              Reset
            </Button>
            <Button
              className="whitespace-nowrap"
              render={(props) => (
                <Link to="/unit/create" {...props}>
                  <AddIcon className="size-4" />
                  {getI18nRuntime().i18n.t("common:create")}
                </Link>
              )}
            />
          </>
        }
        isLoading={
          effectiveMeiliMode ? meiliQuery.isLoading : normalQuery.isLoading
        }
        isError={effectiveMeiliMode ? meiliQuery.isError : normalQuery.isError}
        error={effectiveMeiliMode ? meiliQuery.error : normalQuery.error}
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
    </Page>
  );
}
