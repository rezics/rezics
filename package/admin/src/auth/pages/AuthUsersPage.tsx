import {
  useAdminBanUserMutation,
  useAdminRemoveUserMutation,
  useAdminSetRoleMutation,
  useAdminUnbanUserMutation,
} from "@rezics/api/auth/auth.mutations";
import { authApi } from "@rezics/api/auth/auth.api";
import { authQueries } from "@rezics/api/auth/auth.queries";
import {
  accountOperationsQueries,
  useStartAuthUserImpersonationMutation,
} from "@rezics/api/account-operation/account-operation";
import type { AdminAuthUserAccountSummary } from "@rezics/contract";
import {
  admin_auth_actions_title,
  admin_auth_role_admin,
  admin_auth_role_owner,
  admin_auth_role_user,
  admin_auth_user_name,
  admin_auth_user_role,
  admin_auth_users_ban,
  admin_auth_users_banned,
  admin_auth_users_description,
  admin_auth_users_failed_load,
  admin_auth_users_remove_description,
  admin_auth_users_remove_title,
  admin_auth_users_title,
  admin_auth_users_unban,
  common_active,
  common_cancel,
  common_confirm,
  common_created,
  common_email,
  common_id,
  common_remove,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  type PaginatedColumn,
  PaginatedTable,
} from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";

const i18nMessages = {
  admin_auth_actions_title,
  admin_auth_role_admin,
  admin_auth_role_owner,
  admin_auth_role_user,
  admin_auth_user_name,
  admin_auth_user_role,
  admin_auth_users_ban,
  admin_auth_users_banned,
  admin_auth_users_description,
  admin_auth_users_failed_load,
  admin_auth_users_remove_description,
  admin_auth_users_remove_title,
  admin_auth_users_title,
  admin_auth_users_unban,
  common_active,
  common_cancel,
  common_confirm,
  common_created,
  common_email,
  common_id,
  common_remove,
};

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
  emailVerified?: boolean;
  sessions?: unknown[];
  sessionCount?: number;
  createdAt: string;
};

function formatMainUser(summary?: AdminAuthUserAccountSummary) {
  const mainUser = summary?.mainUser;
  if (!mainUser) return null;
  return mainUser.slug ? `@${mainUser.slug}` : mainUser.unitId;
}

function getSessionCount(user: AuthUser): number | null {
  if (typeof user.sessionCount === "number") return user.sessionCount;
  if (Array.isArray(user.sessions)) return user.sessions.length;
  return null;
}

export default function AuthUsersPage() {
  const m = useMessage(i18nMessages);
  const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(20);
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });
  const [impersonationDialog, setImpersonationDialog] = React.useState<{
    open: boolean;
    user: AuthUser | null;
    reason: string;
    durationSeconds: number;
    auditLogId: string | null;
    error: string | null;
  }>({
    open: false,
    user: null,
    reason: "",
    durationSeconds: 900,
    auditLogId: null,
    error: null,
  });

  const usersQuery = useQuery(authQueries.adminUsers());
  const banMutation = useAdminBanUserMutation();
  const unbanMutation = useAdminUnbanUserMutation();
  const setRoleMutation = useAdminSetRoleMutation();
  const removeMutation = useAdminRemoveUserMutation();
  const impersonateMutation = useStartAuthUserImpersonationMutation();

  const users = (usersQuery.data?.users ?? []) as AuthUser[];
  const total = users.length;
  const paginatedUsers = users.slice(page * limit, (page + 1) * limit);
  const visibleAuthUserIds = React.useMemo(
    () => paginatedUsers.map((user) => user.id),
    [paginatedUsers],
  );
  const accountSummaryQuery = useQuery(
    accountOperationsQueries.authUserSummary(visibleAuthUserIds),
  );
  const accountSummariesByAuthId = React.useMemo(() => {
    return new Map(
      (accountSummaryQuery.data?.summaries ?? []).map((summary) => [
        summary.authUserId,
        summary,
      ]),
    );
  }, [accountSummaryQuery.data?.summaries]);

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
        id: "mainUser",
        header: "Main profile",
        minWidth: 220,
        cell: (u) => {
          const summary = accountSummariesByAuthId.get(u.id);
          const label = formatMainUser(summary);
          if (!summary) {
            return (
              <span className="text-sm text-text-tertiary">Loading...</span>
            );
          }
          if (!summary.mainUser || !label) {
            return (
              <Badge variant="outline" className="text-warning-text">
                Missing profile
              </Badge>
            );
          }
          return (
            <div className="flex flex-col gap-0.5">
              <Link
                to="/user/$userId"
                params={{ userId: summary.mainUser.unitId }}
                className="text-sm font-medium text-text-primary"
              >
                {label}
              </Link>
              {summary.mainUser.email ? (
                <span className="text-xs text-text-secondary">
                  {summary.mainUser.email}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "sessions",
        header: "Sessions",
        minWidth: 120,
        cell: (u) => {
          const count = getSessionCount(u);
          return (
            <Link to="/auth/sessions" className="text-sm text-text-secondary">
              {count === null ? "View sessions" : count.toLocaleString()}
            </Link>
          );
        },
      },
      {
        id: "enforcement",
        header: "Enforcement",
        minWidth: 170,
        cell: (u) => {
          const summary = accountSummariesByAuthId.get(u.id);
          const enforcement = summary?.accountEnforcement;
          if (!summary || !enforcement) {
            return (
              <span className="text-sm text-text-tertiary">Loading...</span>
            );
          }
          if (enforcement.activeCount === 0) {
            return <span className="text-sm text-text-secondary">None</span>;
          }
          return (
            <div className="flex flex-col gap-1">
              <Badge className="bg-error-fill text-white">
                {enforcement.strongestKind ?? "ACTIVE"}
              </Badge>
              <span className="text-xs text-text-secondary">
                {enforcement.activeKinds.join(", ")}
              </span>
            </div>
          );
        },
      },
      {
        id: "warnings",
        header: "Reconciliation",
        minWidth: 220,
        cell: (u) => {
          const warnings =
            accountSummariesByAuthId.get(u.id)?.reconciliationWarnings ?? [];
          if (warnings.length === 0) {
            return <span className="text-sm text-text-secondary">OK</span>;
          }
          return (
            <div className="flex flex-col gap-1">
              {warnings.map((item) => (
                <Badge
                  key={item.code}
                  variant="outline"
                  className={
                    item.severity === "error"
                      ? "text-error-text"
                      : "text-warning-text"
                  }
                >
                  {item.suggestedAction ?? item.message}
                </Badge>
              ))}
            </div>
          );
        },
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
        minWidth: 300,
        cell: (u) => (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setImpersonationDialog({
                  open: true,
                  user: u,
                  reason: "",
                  durationSeconds: 900,
                  auditLogId: null,
                  error: null,
                })
              }
            >
              Impersonate
            </Button>
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
  }, [
    banMutation,
    unbanMutation,
    setRoleMutation,
    removeMutation,
    m.admin_auth_actions_title,
    m.admin_auth_role_admin,
    m.admin_auth_role_owner,
    m.admin_auth_role_user,
    m.admin_auth_user_name,
    m.admin_auth_user_role,
    m.admin_auth_users_ban,
    m.admin_auth_users_banned,
    m.admin_auth_users_remove_description,
    m.admin_auth_users_remove_title,
    m.admin_auth_users_unban,
    m.common_active,
    m.common_created,
    m.common_email,
    m.common_id,
    m.common_remove,
    accountSummariesByAuthId,
  ]);

  return (
    <Page
      title={m.admin_auth_users_title()}
      description={m.admin_auth_users_description()}
    >
      <Card>
        <CardContent>
          {accountSummaryQuery.isError ? (
            <p className="mb-4 text-sm text-warning-text">
              Account enrichment failed; auth-owned controls are still
              available.
            </p>
          ) : null}
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

      <Dialog
        open={impersonationDialog.open}
        onOpenChange={(open) =>
          setImpersonationDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start impersonation</DialogTitle>
            <DialogDescription>
              {impersonationDialog.user
                ? `${impersonationDialog.user.email} (${impersonationDialog.user.id})`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {impersonationDialog.error ? (
              <p className="text-sm text-error-text">
                {impersonationDialog.error}
              </p>
            ) : null}
            {impersonationDialog.auditLogId ? (
              <div className="rounded-md bg-success-fill/10 p-3 text-sm text-success-text">
                <p>Impersonation session started.</p>
                <a
                  className="mt-1 inline-flex font-medium underline underline-offset-2"
                  href={`/staff/audit?action=impersonation.start&targetKind=auth-user&targetId=${encodeURIComponent(
                    impersonationDialog.user?.id ?? "",
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Audit log: {impersonationDialog.auditLogId}
                </a>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="impersonation-duration">Duration</Label>
              <Select
                value={String(impersonationDialog.durationSeconds)}
                onValueChange={(value) =>
                  setImpersonationDialog((prev) => ({
                    ...prev,
                    durationSeconds: Number(value),
                  }))
                }
              >
                <SelectTrigger id="impersonation-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="900">15 minutes</SelectItem>
                  <SelectItem value="1800">30 minutes</SelectItem>
                  <SelectItem value="3600">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="impersonation-reason">Reason</Label>
              <Textarea
                id="impersonation-reason"
                value={impersonationDialog.reason}
                onChange={(event) =>
                  setImpersonationDialog((prev) => ({
                    ...prev,
                    reason: event.target.value,
                  }))
                }
                placeholder="audit reason"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setImpersonationDialog((prev) => ({ ...prev, open: false }))
              }
            >
              {m.common_cancel()}
            </Button>
            <Button
              disabled={
                !impersonationDialog.user ||
                Boolean(impersonationDialog.auditLogId) ||
                impersonationDialog.reason.trim().length === 0 ||
                impersonateMutation.isPending
              }
              onClick={async () => {
                if (!impersonationDialog.user) return;
                try {
                  const result = await impersonateMutation.mutateAsync({
                    targetAuthUserId: impersonationDialog.user.id,
                    reason: impersonationDialog.reason.trim(),
                    durationSeconds: impersonationDialog.durationSeconds,
                  });
                  await authApi.refreshMainSession();
                  setImpersonationDialog((prev) => ({
                    ...prev,
                    auditLogId: result.auditLogId,
                    error: null,
                  }));
                } catch (error) {
                  setImpersonationDialog((prev) => ({
                    ...prev,
                    error:
                      error instanceof Error
                        ? error.message
                        : "Impersonation failed",
                  }));
                }
              }}
            >
              Start
            </Button>
            {impersonationDialog.auditLogId ? (
              <Button onClick={() => window.location.assign("/")}>
                Continue
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
