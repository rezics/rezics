import { useEntityList } from "@rezics/api/entity";
import type {
  EntityDTO,
  EntityKind,
  UnitTranslationDTO,
} from "@rezics/contract";
import { entityKindLabel } from "@rezics/i18n";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Separator,
} from "@rezics/ui/shadcn";
import { Search as SearchIcon } from "lucide-react";
import React from "react";
import {
  type PaginatedColumn,
  PaginatedTable,
} from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";
import {
  admin_auth_actions_title,
  admin_entity_failed_load_list,
  admin_entity_kind_filter_placeholder,
  admin_entity_list_description,
  admin_entity_list_title,
  admin_entity_primary_title,
  admin_entity_search_placeholder,
  admin_entity_search_title,
  admin_entity_verified,
  admin_entity_verified_filter_all,
  admin_unit_no_title,
  common_created,
  common_edit,
  common_no,
  common_search,
  common_slug,
  common_type,
  common_unit_id,
  common_unverified,
  common_yes,
} from "@rezics/i18n/messages";

function fmtDate(v?: string | Date) {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function getPrimaryTitle(translations?: UnitTranslationDTO[] | null): string {
  if (!translations || translations.length === 0) return admin_unit_no_title();
  return translations[0]?.title?.trim() || admin_unit_no_title();
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
        header: common_unit_id(),
        minWidth: 220,
        cell: (e) => (
          <span className="text-sm font-mono text-text-secondary">
            {e.unitId.slice(0, 8)}…
          </span>
        ),
      },
      {
        id: "title",
        header: admin_entity_primary_title(),
        minWidth: 200,
        cell: (e) => (
          <span className="text-sm font-medium">
            {getPrimaryTitle(e.translations)}
          </span>
        ),
      },
      {
        id: "kind",
        header: common_type(),
        minWidth: 120,
        cell: (e) => (
          <span className="text-sm text-text-secondary">
            {e.kind ? entityKindLabel(e.kind) : "-"}
          </span>
        ),
      },
      {
        id: "verified",
        header: admin_entity_verified(),
        minWidth: 100,
        cell: (e) => (
          <span className="text-sm">
            {e.verified ? common_yes() : common_no()}
          </span>
        ),
      },
      {
        id: "slug",
        header: common_slug(),
        minWidth: 160,
        cell: (e) => <span className="text-sm font-mono">{e.slug ?? "-"}</span>,
      },
      {
        id: "createdAt",
        header: common_created(),
        minWidth: 170,
        cell: (e) => fmtDate(e.createdAt),
      },
      {
        id: "actions",
        header: admin_auth_actions_title(),
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
    <Page
      title={admin_entity_list_title()}
      description={admin_entity_list_description()}
    >
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="flex-1 flex flex-col gap-1">
              <Label htmlFor="entity-search" className="text-xs">
                {admin_entity_search_title()}
              </Label>
              <Input
                id="entity-search"
                placeholder={admin_entity_search_placeholder()}
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
            <div className="flex flex-col gap-1 sm:w-40">
              <Label htmlFor="entity-kind" className="text-xs">
                {common_type()}
              </Label>
              <Input
                id="entity-kind"
                placeholder={admin_entity_kind_filter_placeholder()}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="flex flex-col gap-1 sm:w-40">
              <Label htmlFor="entity-verified" className="text-xs">
                {admin_entity_verified()}
              </Label>
              <select
                id="entity-verified"
                value={verifiedFilter}
                onChange={(e) => {
                  setVerifiedFilter(e.target.value as VerifiedFilter);
                  setPage(0);
                }}
                className="h-9 rounded-md border border-border-whisper bg-transparent px-2 text-sm"
              >
                <option value="all">
                  {admin_entity_verified_filter_all()}
                </option>
                <option value="true">{admin_entity_verified()}</option>
                <option value="false">{common_unverified()}</option>
              </select>
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
          </div>

          <Separator className="my-4" />

          {listQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : listQuery.isError ? (
            <p className="text-sm text-error-text">
              {admin_entity_failed_load_list()}
            </p>
          ) : (
            <PaginatedTable<EntityDTO>
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
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
