import {
  useAdminBanUserMutation,
  useAdminRemoveUserMutation,
  useAdminSetRoleMutation,
  useAdminUnbanUserMutation,
} from "@rezics/api/auth/auth.mutations";
import { authQueries } from "@rezics/api/auth/auth.queries";
import * as m from "@rezics/i18n/messages";
import { Spinner } from "@rezics/ui";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  type PaginatedColumn,
  PaginatedTable,
} from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";

function fmtDate(v?: string | Date) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  createdAt: string;
};

export default function AuthUsersPage() {
  const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(20);
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const usersQuery = useQuery(authQueries.adminUsers());
  const banMutation = useAdminBanUserMutation();
  const unbanMutation = useAdminUnbanUserMutation();
  const setRoleMutation = useAdminSetRoleMutation();
  const removeMutation = useAdminRemoveUserMutation();

  const users = (usersQuery.data?.users ?? []) as AuthUser[];
  const total = users.length;
  const paginatedUsers = users.slice(page * limit, (page + 1) * limit);

  const columns = React.useMemo(() => {
    const cols: PaginatedColumn<AuthUser>[] = [
      {
        id: "id",
        header: m.common_id(),
        minWidth: 220,
        cell: (u) => <span className="text-sm font-mono">{u.id}</span>,
      },
      {
        id: "name",
        header: m.admin_auth_user_name(),
        minWidth: 160,
        cell: (u) => (
          <span className="text-sm font-bold whitespace-nowrap">{u.name}</span>
        ),
      },
      {
        id: "email",
        header: m.common_email(),
        minWidth: 240,
        cell: (u) => (
          <span className="text-sm whitespace-nowrap">{u.email}</span>
        ),
      },
      {
        id: "role",
        header: m.admin_auth_user_role(),
        minWidth: 140,
        cell: (u) => (
          <Select
            value={u.role ?? "user"}
            onValueChange={(value) =>
              value && setRoleMutation.mutate({ userId: u.id, role: value })
            }
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">{m.admin_auth_role_user()}</SelectItem>
              <SelectItem value="admin">{m.admin_auth_role_admin()}</SelectItem>
              <SelectItem value="owner">{m.admin_auth_role_owner()}</SelectItem>
            </SelectContent>
          </Select>
        ),
      },
      {
        id: "banned",
        header: m.admin_auth_users_banned(),
        minWidth: 100,
        cell: (u) =>
          u.banned ? (
            <Badge className="bg-error-fill text-white">
              {m.admin_auth_users_banned()}
            </Badge>
          ) : (
            <Badge className="bg-success-fill text-white">
              {m.common_active()}
            </Badge>
          ),
      },
      {
        id: "createdAt",
        header: m.common_created(),
        minWidth: 170,
        cell: (u) => fmtDate(u.createdAt),
      },
      {
        id: "actions",
        header: m.admin_auth_actions_title(),
        minWidth: 200,
        cell: (u) => (
          <div className="flex gap-1">
            {u.banned ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => unbanMutation.mutate({ userId: u.id })}
              >
                {m.admin_auth_users_unban()}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="text-warning-text"
                onClick={() => banMutation.mutate({ userId: u.id })}
              >
                {m.admin_auth_users_ban()}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-error-text"
              onClick={() =>
                setConfirmDialog({
                  open: true,
                  title: m.admin_auth_users_remove_title(),
                  message: m.admin_auth_users_remove_description({
                    name: u.name,
                    email: u.email,
                  }),
                  onConfirm: () => {
                    removeMutation.mutate({ userId: u.id });
                    setConfirmDialog((prev) => ({ ...prev, open: false }));
                  },
                })
              }
            >
              {m.common_remove()}
            </Button>
          </div>
        ),
      },
    ];
    return cols;
  }, [banMutation, unbanMutation, setRoleMutation, removeMutation]);

  return (
    <Page
      title={m.admin_auth_users_title()}
      description={m.admin_auth_users_description()}
    >
      <Card>
        <CardContent>
          {usersQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : usersQuery.isError ? (
            <p className="text-sm text-error-text">
              {m.admin_auth_users_failed_load()}
            </p>
          ) : (
            <PaginatedTable<AuthUser>
              columns={columns}
              rows={paginatedUsers}
              getRowId={(u) => u.id}
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

      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
            >
              {m.common_cancel()}
            </Button>
            <Button
              className="bg-error-fill text-white"
              onClick={confirmDialog.onConfirm}
            >
              {m.common_confirm()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
