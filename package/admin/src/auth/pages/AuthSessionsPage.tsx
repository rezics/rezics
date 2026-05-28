import {
  accountOperationsQueries,
  useRevokeAuthUserSessionMutation,
  useRevokeAuthUserSessionsMutation,
} from "@rezics/api/account-operation/account-operation";
import type { AdminAuthSession } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
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

type AuthSession = {
  id: string;
  authUserId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  impersonatedBy?: string | null;
};

type ConfirmDialogState =
  | {
      open: false;
      mode: "single" | "all";
      sessionId: string;
      reason: string;
    }
  | {
      open: true;
      mode: "single" | "all";
      sessionId: string;
      reason: string;
    };

function toSession(row: AdminAuthSession): AuthSession {
  return row;
}

export default function AuthSessionsPage() {
  const { t } = useTranslation(["admin", "common"]);
const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(20);
  const [authUserIdInput, setAuthUserIdInput] = React.useState("");
  const [authUserId, setAuthUserId] = React.useState("");
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmDialogState>({
    open: false,
    mode: "single",
    sessionId: "",
    reason: "",
  });

  const sessionsQuery = useQuery(
    accountOperationsQueries.authUserSessions(authUserId),
  );
  const revokeMutation = useRevokeAuthUserSessionMutation();
  const revokeAllMutation = useRevokeAuthUserSessionsMutation();

  const sessions = React.useMemo(
    () => (sessionsQuery.data?.sessions ?? []).map(toSession),
    [sessionsQuery.data?.sessions],
  );
  const total = sessions.length;
  const paginatedSessions = React.useMemo(
    () => sessions.slice(page * limit, (page + 1) * limit),
    [limit, page, sessions],
  );
  const reasonIsValid = confirmDialog.reason.trim().length > 0;

  const columns = React.useMemo(() => {
    const cols: PaginatedColumn<AuthSession>[] = [
      {
        id: "id",
        header: "Session",
        minWidth: 220,
        cell: (s) => (
          <span className="text-sm font-mono">{s.id.slice(0, 16)}</span>
        ),
      },
      {
        id: "createdAt",
        header: t("common:created"),
        minWidth: 170,
        cell: (s) => fmtDate(s.createdAt),
      },
      {
        id: "expiresAt",
        header: t("common:expires"),
        minWidth: 170,
        cell: (s) => fmtDate(s.expiresAt),
      },
      {
        id: "ipAddress",
        header: "IP",
        minWidth: 150,
        cell: (s) => (
          <span className="text-sm text-text-secondary">
            {s.ipAddress ?? "-"}
          </span>
        ),
      },
      {
        id: "userAgent",
        header: t("common:user_agent"),
        minWidth: 300,
        cell: (s) => (
          <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis inline-block max-w-[300px]">
            {s.userAgent ?? "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("admin:auth_actions_title"),
        minWidth: 120,
        cell: (s) => (
          <Button
            size="sm"
            variant="outline"
            className="text-error-text"
            onClick={() =>
              setConfirmDialog({
                open: true,
                mode: "single",
                sessionId: s.id,
                reason: "",
              })
            }
          >
            {t("common:revoke")}
          </Button>
        ),
      },
    ];
    return cols;
  }, [
    m.admin_auth_actions_title,
    m.common_created,
    m.common_expires,
    m.common_revoke,
    m.common_user_agent,
  ]);

  return (
    <Page
      title={t("admin:auth_sessions_title")}
      description={t("admin:auth_sessions_description")}
    >
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="auth-user-id">Auth user ID</Label>
              <Input
                id="auth-user-id"
                value={authUserIdInput}
                onChange={(event) => setAuthUserIdInput(event.target.value)}
                placeholder="auth user id"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPage(0);
                  setAuthUserId(authUserIdInput.trim());
                }}
              >
                Load sessions
              </Button>
              <Button
                variant="outline"
                className="text-error-text"
                disabled={!authUserId || sessions.length === 0}
                onClick={() =>
                  setConfirmDialog({
                    open: true,
                    mode: "all",
                    sessionId: "",
                    reason: "",
                  })
                }
              >
                Revoke all
              </Button>
            </div>
          </div>

          {!authUserId ? (
            <p className="text-sm text-text-secondary">
              Enter an auth user ID to review safe session metadata.
            </p>
          ) : sessionsQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : sessionsQuery.isError ? (
            <p className="text-sm text-error-text">
              {t("admin:auth_sessions_failed_load")}
            </p>
          ) : (
            <PaginatedTable<AuthSession>
              columns={columns}
              rows={paginatedSessions}
              getRowId={(s) => s.id}
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
            <DialogTitle>{t("admin:auth_sessions_revoke_title")}</DialogTitle>
            <DialogDescription>
              {confirmDialog.mode === "all"
                ? "Revoke every active session for this auth user."
                : t("admin:auth_sessions_revoke_description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="session-revoke-reason">Reason</Label>
            <Textarea
              id="session-revoke-reason"
              value={confirmDialog.reason}
              onChange={(event) =>
                setConfirmDialog((prev) => ({
                  ...prev,
                  reason: event.target.value,
                }))
              }
              placeholder="audit reason"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog({
                  open: false,
                  mode: "single",
                  sessionId: "",
                  reason: "",
                })
              }
            >
              {t("common:cancel")}
            </Button>
            <Button
              className="bg-error-fill text-white"
              disabled={
                !reasonIsValid ||
                revokeMutation.isPending ||
                revokeAllMutation.isPending
              }
              onClick={() => {
                const reason = confirmDialog.reason.trim();
                if (!reason || !authUserId) return;
                if (confirmDialog.mode === "all") {
                  revokeAllMutation.mutate({ authUserId, reason });
                } else {
                  revokeMutation.mutate({
                    authUserId,
                    sessionId: confirmDialog.sessionId,
                    reason,
                  });
                }
                setConfirmDialog({
                  open: false,
                  mode: "single",
                  sessionId: "",
                  reason: "",
                });
              }}
            >
              {t("common:revoke")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
