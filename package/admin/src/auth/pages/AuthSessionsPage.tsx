import { useRevokeSessionMutation } from "@rezics/api/auth/auth.mutations";
import { authQueries } from "@rezics/api/auth/auth.queries";
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
        header: "Token",
        minWidth: 220,
        cell: (s) => (
          <span className="text-sm font-mono">{s.token.slice(0, 16)}…</span>
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        minWidth: 170,
        cell: (s) => fmtDate(s.createdAt),
      },
      {
        id: "expiresAt",
        header: "Expires",
        minWidth: 170,
        cell: (s) => fmtDate(s.expiresAt),
      },
      {
        id: "userAgent",
        header: "User Agent",
        minWidth: 300,
        cell: (s) => (
          <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis inline-block max-w-[300px]">
            {s.userAgent ?? "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        minWidth: 120,
        cell: (s) => (
          <Button
            size="sm"
            variant="outline"
            className="text-rezics-color-danger"
            onClick={() => setConfirmDialog({ open: true, token: s.token })}
          >
            Revoke
          </Button>
        ),
      },
    ];
    return cols;
  }, []);

  return (
    <Page title="Auth Sessions" description="Manage auth server sessions">
      <Card>
        <CardContent>
          {sessionsQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : sessionsQuery.isError ? (
            <p className="text-sm text-rezics-color-danger">
              Failed to load sessions.
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
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this session? The user will be
              logged out.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, token: "" })}
            >
              Cancel
            </Button>
            <Button
              className="bg-rezics-color-danger text-white"
              onClick={() => {
                revokeMutation.mutate({ token: confirmDialog.token });
                setConfirmDialog({ open: false, token: "" });
              }}
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
