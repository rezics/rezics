import { useRevokeSessionMutation } from "@rezics/api/auth/auth.mutations";
import { authQueries } from "@rezics/api/auth/auth.queries";
import * as m from "@rezics/i18n/messages";
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
  token: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
};

export default function AuthSessionsPage() {
  const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(20);
  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean;
    token: string;
  }>({ open: false, token: "" });

  const sessionsQuery = useQuery(authQueries.sessions());
  const revokeMutation = useRevokeSessionMutation();

  const sessions = (sessionsQuery.data?.sessions ?? []) as AuthSession[];
  const total = sessions.length;
  const paginatedSessions = sessions.slice(page * limit, (page + 1) * limit);

  const columns = React.useMemo(() => {
    const cols: PaginatedColumn<AuthSession>[] = [
      {
        id: "token",
        header: m.admin_auth_sessions_token(),
        minWidth: 220,
        cell: (s) => (
          <span className="text-sm font-mono">{s.token.slice(0, 16)}…</span>
        ),
      },
      {
        id: "createdAt",
        header: m.common_created(),
        minWidth: 170,
        cell: (s) => fmtDate(s.createdAt),
      },
      {
        id: "expiresAt",
        header: m.common_expires(),
        minWidth: 170,
        cell: (s) => fmtDate(s.expiresAt),
      },
      {
        id: "userAgent",
        header: m.common_user_agent(),
        minWidth: 300,
        cell: (s) => (
          <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis inline-block max-w-[300px]">
            {s.userAgent ?? "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: m.admin_auth_actions_title(),
        minWidth: 120,
        cell: (s) => (
          <Button
            size="sm"
            variant="outline"
            className="text-error-text"
            onClick={() => setConfirmDialog({ open: true, token: s.token })}
          >
            {m.common_revoke()}
          </Button>
        ),
      },
    ];
    return cols;
  }, []);

  return (
    <Page
      title={m.admin_auth_sessions_title()}
      description={m.admin_auth_sessions_description()}
    >
      <Card>
        <CardContent>
          {sessionsQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : sessionsQuery.isError ? (
            <p className="text-sm text-error-text">
              {m.admin_auth_sessions_failed_load()}
            </p>
          ) : (
            <PaginatedTable<AuthSession>
              columns={columns}
              rows={paginatedSessions}
              getRowId={(s) => s.token}
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
            <DialogTitle>{m.admin_auth_sessions_revoke_title()}</DialogTitle>
            <DialogDescription>
              {m.admin_auth_sessions_revoke_description()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, token: "" })}
            >
              {m.common_cancel()}
            </Button>
            <Button
              className="bg-error-fill text-white"
              onClick={() => {
                revokeMutation.mutate({ token: confirmDialog.token });
                setConfirmDialog({ open: false, token: "" });
              }}
            >
              {m.common_revoke()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
