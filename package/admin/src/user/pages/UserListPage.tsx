import { userSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
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
import { Plus as AddIcon, Search as SearchIcon } from "lucide-react";
import React from "react";
import {
  type PaginatedColumn,
  PaginatedTable,
} from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";

function fmtDate(v?: string | Date) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

export default function UserListPage() {
  const { t } = useTranslation(["admin", "common"]);
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
        id: "userId",
        header: t("admin:user_user_id"),
        minWidth: 220,
        cell: (u) => <span className="text-sm font-mono">{u.unitId}</span>,
      },
      {
        id: "email",
        header: t("admin:user_rezics_email_label"),
        minWidth: 240,
        cell: (u) => (
          <span className="text-sm whitespace-nowrap">{u.email ?? "-"}</span>
        ),
      },
      {
        id: "name",
        header: t("admin:user_name_label"),
        minWidth: 160,
        cell: (u) => (
          <span className="text-sm font-bold whitespace-nowrap">{u.name}</span>
        ),
      },
      {
        id: "slug",
        header: t("admin:user_slug"),
        minWidth: 160,
        cell: (u) => (
          <span className="text-sm whitespace-nowrap">
            {u.slug ? `@${u.slug}` : "-"}
          </span>
        ),
      },
      {
        id: "roles",
        header: t("admin:user_roles"),
        minWidth: 220,
        cell: (u) => (
          <span className="text-sm whitespace-nowrap">
            {u.permission?.role?.length ? u.permission.role.join(", ") : "-"}
          </span>
        ),
      },
      {
        id: "joinDate",
        header: t("admin:user_join_date"),
        minWidth: 170,
        cell: (u) => fmtDate(u.joinDate),
      },
      {
        id: "actions",
        header: t("admin:user_actions"),
        minWidth: 120,
        cell: (u) => (
          <Button
            size="sm"
            variant="outline"
            render={(props) => (
              <Link to="/user/$userId" params={{ userId: u.unitId }} {...props}>
                {t("common:edit")}
              </Link>
            )}
          />
        ),
      },
    ];
    return cols;
  }, [
    m.admin_user_actions,
    m.admin_user_join_date,
    m.admin_user_name_label,
    m.admin_user_rezics_email_label,
    m.admin_user_roles,
    m.admin_user_slug,
    m.admin_user_user_id,
    m.common_edit,
  ]);

  return (
    <Page
      title={
        isMeiliMode
          ? t("admin:user_list_meili_title")
          : t("admin:user_list_title")
      }
      description={
        isMeiliMode
          ? t("admin:user_list_meili_description")
          : t("admin:user_list_description")
      }
    >
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="flex-1 flex flex-col gap-1">
              <Label htmlFor="user-search" className="text-xs">
                {t("common:search")}
              </Label>
              <Input
                id="user-search"
                placeholder={t("admin:user_search_placeholder")}
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
              aria-label={t("admin:user_search_action")}
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
                <Link to="/user/create" {...props}>
                  <AddIcon className="size-4" />
                  {t("common:create")}
                </Link>
              )}
            />
          </div>

          <Separator className="my-4" />

          {(isMeiliMode ? meiliQuery.isLoading : listQuery.isLoading) ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : (isMeiliMode ? meiliQuery.isError : listQuery.isError) ? (
            <p className="text-sm text-error-text">
              {t("admin:user_failed_to_load_users")}
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
