import { getI18nRuntime } from "@rezics/i18n/runtime";
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
import { useUnblockAccountEnforcementMutation } from "@rezics/api/governance/governance";
import type { AdminAuthUserAccountSummary } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { SafeLink, Spinner } from "@rezics/ui";
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
  const { t } = useTranslation(["admin", "common"]);
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
  const [overrideDialog, setOverrideDialog] = React.useState<{
    open: boolean;
    user: AuthUser | null;
    targetUserId: string | null;
    activeKinds: string[];
    expiresAt: string | null;
    reason: string;
    error: string | null;
    resultCount: number | null;
  }>({
    open: false,
    user: null,
    targetUserId: null,
    activeKinds: [],
    expiresAt: null,
    reason: "",
    error: null,
    resultCount: null,
  });

  const usersQuery = useQuery(authQueries.adminUsers());
  const banMutation = useAdminBanUserMutation();
  const unbanMutation = useAdminUnbanUserMutation();
  const setRoleMutation = useAdminSetRoleMutation();
  const removeMutation = useAdminRemoveUserMutation();
  const impersonateMutation = useStartAuthUserImpersonationMutation();
  const unblockEnforcementMutation = useUnblockAccountEnforcementMutation();

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
        header: t("common:id"),
        minWidth: 220,
        cell: (u) => <span className="text-sm font-mono">{u.id}</span>,
      },
      {
        id: "name",
        header: t("admin:auth_user_name"),
        minWidth: 160,
        cell: (u) => (
          <span className="text-sm font-bold whitespace-nowrap">{u.name}</span>
        ),
      },
      {
        id: "email",
        header: t("common:email"),
        minWidth: 240,
        cell: (u) => (
          <span className="text-sm whitespace-nowrap">{u.email}</span>
        ),
      },
      {
        id: "role",
        header: t("admin:auth_user_role"),
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
              <SelectItem value="user">{t("admin:auth_role_user")}</SelectItem>
              <SelectItem value="admin">
                {t("admin:auth_role_admin")}
              </SelectItem>
              <SelectItem value="owner">
                {t("admin:auth_role_owner")}
              </SelectItem>
            </SelectContent>
          </Select>
        ),
      },
      {
        id: "banned",
        header: t("admin:auth_users_banned"),
        minWidth: 100,
        cell: (u) =>
          u.banned ? (
            <Badge className="bg-error-fill text-white">
              {t("admin:auth_users_banned")}
            </Badge>
          ) : (
            <Badge className="bg-success-fill text-white">
              {t("common:active")}
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
        header: t("common:created"),
        minWidth: 170,
        cell: (u) => fmtDate(u.createdAt),
      },
      {
        id: "actions",
        header: t("admin:auth_actions_title"),
        minWidth: 380,
        cell: (u) => {
          const summary = accountSummariesByAuthId.get(u.id);
          const enforcement = summary?.accountEnforcement;
          const canOverride =
            Boolean(summary?.mainUser?.unitId) &&
            Boolean(enforcement && enforcement.activeCount > 0);

          return (
            <div className="flex flex-wrap gap-1">
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
              {canOverride ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-warning-text"
                  onClick={() =>
                    setOverrideDialog({
                      open: true,
                      user: u,
                      targetUserId: summary?.mainUser?.unitId ?? null,
                      activeKinds: enforcement?.activeKinds ?? [],
                      expiresAt: enforcement?.expiresAt ?? null,
                      reason: "",
                      error: null,
                      resultCount: null,
                    })
                  }
                >
                  Override
                </Button>
              ) : null}
              {u.banned ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => unbanMutation.mutate({ userId: u.id })}
                >
                  {t("admin:auth_users_unban")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-warning-text"
                  onClick={() => banMutation.mutate({ userId: u.id })}
                >
                  {t("admin:auth_users_ban")}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-error-text"
                onClick={() =>
                  setConfirmDialog({
                    open: true,
                    title: t("admin:auth_users_remove_title"),
                    message: t("admin:auth_users_remove_description", {
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
                {t("common:remove")}
              </Button>
            </div>
          );
        },
      },
    ];
    return cols;
  }, [
    banMutation,
    unbanMutation,
    setRoleMutation,
    removeMutation,
    getI18nRuntime().i18n.t("admin:auth_actions_title"),
    getI18nRuntime().i18n.t("admin:auth_role_admin"),
    getI18nRuntime().i18n.t("admin:auth_role_owner"),
    getI18nRuntime().i18n.t("admin:auth_role_user"),
    getI18nRuntime().i18n.t("admin:auth_user_name"),
    getI18nRuntime().i18n.t("admin:auth_user_role"),
    getI18nRuntime().i18n.t("admin:auth_users_ban"),
    getI18nRuntime().i18n.t("admin:auth_users_banned"),
    getI18nRuntime().i18n.t("admin:auth_users_remove_description"),
    getI18nRuntime().i18n.t("admin:auth_users_remove_title"),
    getI18nRuntime().i18n.t("admin:auth_users_unban"),
    getI18nRuntime().i18n.t("common:active"),
    getI18nRuntime().i18n.t("common:created"),
    getI18nRuntime().i18n.t("common:email"),
    getI18nRuntime().i18n.t("common:id"),
    getI18nRuntime().i18n.t("common:remove"),
    accountSummariesByAuthId,
  ]);

  return (
    <Page
      title={t("admin:auth_users_title")}
      description={t("admin:auth_users_description")}
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
              {t("admin:auth_users_failed_load")}
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
              {t("common:cancel")}
            </Button>
            <Button
              className="bg-error-fill text-white"
              onClick={confirmDialog.onConfirm}
            >
              {t("common:confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={overrideDialog.open}
        onOpenChange={(open) =>
          setOverrideDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override account enforcement</DialogTitle>
            <DialogDescription>
              {overrideDialog.user
                ? `${overrideDialog.user.email} (${overrideDialog.targetUserId ?? "missing profile"})`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {overrideDialog.error ? (
              <p className="text-sm text-error-text">{overrideDialog.error}</p>
            ) : null}
            {overrideDialog.resultCount !== null ? (
              <div className="rounded-md bg-success-fill/10 p-3 text-sm text-success-text">
                Revoked {overrideDialog.resultCount} active enforcement record
                {overrideDialog.resultCount === 1 ? "" : "s"}.
              </div>
            ) : null}
            <div className="rounded-md bg-surface-subtle p-3 text-sm leading-[1.4]">
              <p className="font-medium">Impact preview</p>
              <p className="mt-1 text-text-secondary">
                Revokes active governance enforcement for the linked main
                profile. Current active kinds:{" "}
                {overrideDialog.activeKinds.length
                  ? overrideDialog.activeKinds.join(", ")
                  : "none"}
                .
              </p>
              <p className="mt-1 text-text-secondary">
                Expiration:{" "}
                {overrideDialog.expiresAt
                  ? fmtDate(overrideDialog.expiresAt)
                  : "none"}
                . Auth-service ban state is not changed by this override.
              </p>
              <p className="mt-1 text-text-secondary">
                The server re-checks account unblock policy and writes a staff
                audit entry for each revoked enforcement record.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enforcement-override-reason">Reason</Label>
              <Textarea
                id="enforcement-override-reason"
                value={overrideDialog.reason}
                onChange={(event) =>
                  setOverrideDialog((prev) => ({
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
                setOverrideDialog((prev) => ({ ...prev, open: false }))
              }
            >
              {t("common:cancel")}
            </Button>
            <Button
              disabled={
                !overrideDialog.targetUserId ||
                overrideDialog.reason.trim().length === 0 ||
                overrideDialog.resultCount !== null ||
                unblockEnforcementMutation.isPending
              }
              onClick={async () => {
                if (!overrideDialog.targetUserId) return;
                try {
                  const result = await unblockEnforcementMutation.mutateAsync({
                    targetUserId: overrideDialog.targetUserId,
                    input: { reason: overrideDialog.reason.trim() },
                  });
                  await accountSummaryQuery.refetch();
                  setOverrideDialog((prev) => ({
                    ...prev,
                    resultCount: result.length,
                    error: null,
                  }));
                } catch (error) {
                  setOverrideDialog((prev) => ({
                    ...prev,
                    error:
                      error instanceof Error
                        ? error.message
                        : "Enforcement override failed",
                  }));
                }
              }}
            >
              {t("common:confirm")}
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
                <SafeLink
                  className="mt-1 inline-flex font-medium underline underline-offset-2"
                  href={`/staff/audit?action=impersonation.start&targetKind=auth-user&targetId=${encodeURIComponent(
                    impersonationDialog.user?.id ?? "",
                  )}`}
                >
                  Audit log: {impersonationDialog.auditLogId}
                </SafeLink>
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
              {t("common:cancel")}
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
