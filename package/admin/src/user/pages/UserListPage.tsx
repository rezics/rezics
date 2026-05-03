import { userSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";

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
import { useQuery } from "@tanstack/react-query";
import { useMatchRoute } from "@tanstack/react-router";
import React from "react";
import {
  type PaginatedColumn,
  PaginatedTable,
} from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";
import { Plus as AddIcon, Search as SearchIcon } from "lucide-react";

function fmtDate(v?: string | Date) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

export default function UserListPage() {
  const matchRoute = useMatchRoute();
  const isMeiliMode = Boolean(matchRoute({ to: "/user/meili" }));

  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(20);

  React.useEffect(() => {
    setQ("");
    setQuery("");
    setPage(0);
    setLimit(20);
  }, []);

  const listQuery = useQuery({
    ...userQueries.adminList({
      page: page + 1,
      limit,
      ...(query ? { q: query } : {}),
    }),
    enabled: !isMeiliMode,
  });

  const meiliQuery = useQuery({
    ...userSearchQueryOptions({
      q: query || undefined,
      page: page + 1,
      limit,
    }),
    enabled: isMeiliMode,
  });

  const data = isMeiliMode ? meiliQuery.data : listQuery.data;

  const users = (data?.users ?? []) as UserDTO[];
  const total = data?.total ?? 0;

  const columns = React.useMemo(() => {
    const cols: PaginatedColumn<UserDTO>[] = [
      {
        id: "unitId",
        header: "Unit ID",
        minWidth: 220,
        cell: (u) => <span className="text-sm font-mono">{u.unitId}</span>,
      },
      {
        id: "email",
        header: "Email",
        minWidth: 240,
        cell: (u) => (
          <span className="text-sm whitespace-nowrap">{u.email ?? "-"}</span>
        ),
      },
      {
        id: "name",
        header: "Name",
        minWidth: 160,
        cell: (u) => (
          <span className="text-sm font-bold whitespace-nowrap">{u.name}</span>
        ),
      },
      {
        id: "slug",
        header: "Slug",
        minWidth: 160,
        cell: (u) => (
          <span className="text-sm whitespace-nowrap">
            {u.slug ? `@${u.slug}` : "-"}
          </span>
        ),
      },
      {
        id: "roles",
        header: "Roles",
        minWidth: 220,
        cell: (u) => (
          <span className="text-sm whitespace-nowrap">
            {u.permission?.role?.length ? u.permission.role.join(", ") : "-"}
          </span>
        ),
      },
      {
        id: "joinDate",
        header: "Join Date",
        minWidth: 170,
        cell: (u) => fmtDate(u.joinDate),
      },
      {
        id: "actions",
        header: "Actions",
        minWidth: 120,
        cell: (u) => (
          <Button asChild size="sm" variant="outline">
            <Link to={`/user/${u.unitId}`}>Edit</Link>
          </Button>
        ),
      },
    ];
    return cols;
  }, []);

  return (
    <Page
      title={isMeiliMode ? "Users (Meili)" : "Users"}
      description={
        isMeiliMode
          ? "管理 User（Meili 搜索）"
          : "管理 User（普通列表 / 翻页 / 创建 / 编辑）"
      }
    >
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="flex-1 flex flex-col gap-1">
              <Label htmlFor="user-search" className="text-xs">
                Search
              </Label>
              <Input
                id="user-search"
                placeholder="q/email/slug..."
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
              <Link to="/user/create">
                <AddIcon className="size-4" />
                Create
              </Link>
            </Button>
          </div>

          <Separator className="my-4" />

          {(isMeiliMode ? meiliQuery.isLoading : listQuery.isLoading) ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : (isMeiliMode ? meiliQuery.isError : listQuery.isError) ? (
            <p className="text-sm text-rezics-color-danger">
              Failed to load users.
            </p>
          ) : (
            <PaginatedTable<UserDTO>
              columns={columns}
              rows={users}
              getRowId={(u) => u.unitId}
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
