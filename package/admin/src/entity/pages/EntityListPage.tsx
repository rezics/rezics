import { useEntityList } from "@rezics/api/entity";
import type { EntityDTO, UnitTranslationDTO } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
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

function fmtDate(v?: string | Date) {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function getPrimaryTitle(translations?: UnitTranslationDTO[] | null): string {
  if (!translations || translations.length === 0) return "Untitled";
  return translations[0]?.title?.trim() || "Untitled";
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
    kind: kind || undefined,
    verified: verifiedFilter === "all" ? undefined : verifiedFilter === "true",
  });

  const entities = listQuery.data?.entities ?? [];
  const total = listQuery.data?.total ?? 0;

  const columns = React.useMemo<PaginatedColumn<EntityDTO>[]>(
    () => [
      {
        id: "unitId",
        header: "Unit ID",
        minWidth: 220,
        cell: (e) => (
          <span className="text-sm font-mono text-text-secondary">
            {e.unitId.slice(0, 8)}…
          </span>
        ),
      },
      {
        id: "title",
        header: "Primary title",
        minWidth: 200,
        cell: (e) => (
          <span className="text-sm font-medium">
            {getPrimaryTitle(e.translations)}
          </span>
        ),
      },
      {
        id: "kind",
        header: "Kind",
        minWidth: 120,
        cell: (e) => (
          <span className="text-sm text-text-secondary">{e.kind ?? "-"}</span>
        ),
      },
      {
        id: "verified",
        header: "Verified",
        minWidth: 100,
        cell: (e) => (
          <span className="text-sm">{e.verified ? "Yes" : "No"}</span>
        ),
      },
      {
        id: "slug",
        header: "Slug",
        minWidth: 160,
        cell: (e) => <span className="text-sm font-mono">{e.slug ?? "-"}</span>,
      },
      {
        id: "createdAt",
        header: "Created",
        minWidth: 170,
        cell: (e) => fmtDate(e.createdAt),
      },
      {
        id: "actions",
        header: "Actions",
        minWidth: 120,
        cell: (e) => (
          <Button
            size="sm"
            variant="outline"
            render={(props) => (
              <Link
                to="/entities/$unitId"
                params={{ unitId: e.unitId }}
                {...props}
              >
                Edit
              </Link>
            )}
          />
        ),
      },
    ],
    [],
  );

  return (
    <Page title="Entities" description="Curate ENTITY-typed units">
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="flex-1 flex flex-col gap-1">
              <Label htmlFor="entity-search" className="text-xs">
                Search title
              </Label>
              <Input
                id="entity-search"
                placeholder="search translation titles…"
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
                Kind
              </Label>
              <Input
                id="entity-kind"
                placeholder="person…"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="flex flex-col gap-1 sm:w-40">
              <Label htmlFor="entity-verified" className="text-xs">
                Verified
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
                <option value="all">All</option>
                <option value="true">Verified</option>
                <option value="false">Unverified</option>
              </select>
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
          </div>

          <Separator className="my-4" />

          {listQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : listQuery.isError ? (
            <p className="text-sm text-error-text">Failed to load entities.</p>
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
