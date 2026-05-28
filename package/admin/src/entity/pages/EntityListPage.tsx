import { useEntityList } from "@rezics/api/entity";
import type {
  EntityDTO,
  EntityKind,
  UnitTranslationDTO,
} from "@rezics/contract";
import { entityKindLabel } from "@rezics/i18n";
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
import React from "react";
import { SearchablePaginatedTableCard } from "@/components/list/SearchablePaginatedTableCard";
import { type PaginatedColumn } from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";

import { getI18nRuntime } from "@rezics/i18n/runtime";
function fmtDate(v?: string | Date) {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function getPrimaryTitle(translations?: UnitTranslationDTO[] | null): string {
  if (!translations || translations.length === 0)
    return getI18nRuntime().i18n.t("admin:unit_no_title");
  return (
    translations[0]?.title?.trim() ||
    getI18nRuntime().i18n.t("admin:unit_no_title")
  );
}

type VerifiedFilter = "all" | "true" | "false";

export default function EntityListPage() {
  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState("");
  const [verifiedFilter, setVerifiedFilter] =
    React.useState<VerifiedFilter>("all");
  const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(20);

  const listQuery = useEntityList({
    page: page + 1,
    limit,
    q: query || undefined,
    kind: (kind || undefined) as EntityKind | undefined,
    verified: verifiedFilter === "all" ? undefined : verifiedFilter === "true",
  });

  const entities = listQuery.data?.entities ?? [];
  const total = listQuery.data?.total ?? 0;

  const columns = React.useMemo<PaginatedColumn<EntityDTO>[]>(
    () => [
      {
        id: "unitId",
        header: getI18nRuntime().i18n.t("common:unit_id"),
        minWidth: 220,
        cell: (e) => (
          <span className="text-sm font-mono text-text-secondary">
            {e.unitId.slice(0, 8)}…
          </span>
        ),
      },
      {
        id: "title",
        header: getI18nRuntime().i18n.t("admin:entity_primary_title"),
        minWidth: 200,
        cell: (e) => (
          <span className="text-sm font-medium">
            {getPrimaryTitle(e.translations)}
          </span>
        ),
      },
      {
        id: "kind",
        header: getI18nRuntime().i18n.t("common:type"),
        minWidth: 120,
        cell: (e) => (
          <span className="text-sm text-text-secondary">
            {e.kind ? entityKindLabel(e.kind) : "-"}
          </span>
        ),
      },
      {
        id: "verified",
        header: getI18nRuntime().i18n.t("admin:entity_verified"),
        minWidth: 100,
        cell: (e) => (
          <span className="text-sm">
            {e.verified
              ? getI18nRuntime().i18n.t("common:yes")
              : getI18nRuntime().i18n.t("common:no")}
          </span>
        ),
      },
      {
        id: "slug",
        header: getI18nRuntime().i18n.t("common:slug"),
        minWidth: 160,
        cell: (e) => <span className="text-sm font-mono">{e.slug ?? "-"}</span>,
      },
      {
        id: "createdAt",
        header: getI18nRuntime().i18n.t("common:created"),
        minWidth: 170,
        cell: (e) => fmtDate(e.createdAt),
      },
      {
        id: "actions",
        header: getI18nRuntime().i18n.t("admin:auth_actions_title"),
        minWidth: 120,
        cell: (e) => (
          <Button
            size="sm"
            variant="outline"
            render={(props) => (
              <Link
                to="/entity/$unitId"
                params={{ unitId: e.unitId }}
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
      title={getI18nRuntime().i18n.t("admin:entity_list_title")}
      description={getI18nRuntime().i18n.t("admin:entity_list_description")}
    >
      <SearchablePaginatedTableCard<EntityDTO>
        searchInputId="entity-search"
        searchLabel={getI18nRuntime().i18n.t("admin:entity_search_title")}
        searchPlaceholder={getI18nRuntime().i18n.t(
          "admin:entity_search_placeholder",
        )}
        errorLabel={getI18nRuntime().i18n.t("admin:entity_failed_load_list")}
        q={q}
        onQChange={setQ}
        onSearch={() => {
          setPage(0);
          setQuery(q.trim());
        }}
        filters={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="entity-kind" className="text-xs">
                {getI18nRuntime().i18n.t("common:type")}
              </Label>
              <Input
                id="entity-kind"
                placeholder={getI18nRuntime().i18n.t(
                  "admin:entity_kind_filter_placeholder",
                )}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="flex flex-col gap-1 sm:w-40">
              <Label htmlFor="entity-verified" className="text-xs">
                {getI18nRuntime().i18n.t("admin:entity_verified")}
              </Label>
              <Select
                value={verifiedFilter}
                onValueChange={(value) => {
                  setVerifiedFilter(value as VerifiedFilter);
                  setPage(0);
                }}
              >
                <SelectTrigger id="entity-verified">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {getI18nRuntime().i18n.t(
                      "admin:entity_verified_filter_all",
                    )}
                  </SelectItem>
                  <SelectItem value="true">
                    {getI18nRuntime().i18n.t("admin:entity_verified")}
                  </SelectItem>
                  <SelectItem value="false">
                    {getI18nRuntime().i18n.t("common:unverified")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        columns={columns}
        rows={entities}
        getRowId={(e) => e.unitId}
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
