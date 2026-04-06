import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import {
  useAdminBanUserMutation,
  useAdminRemoveUserMutation,
  useAdminSetRoleMutation,
  useAdminUnbanUserMutation,
} from "@rezics/api/auth/auth.mutations";
import { authQueries } from "@rezics/api/auth/auth.queries";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  type PaginatedColumn,
  PaginatedTable,
} from "@/component/table/PaginatedTable";
import { Page } from "@/core/layout/Page";

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
        header: "ID",
        minWidth: 220,
        cell: (u) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {u.id}
          </Typography>
        ),
      },
      {
        id: "name",
        header: "Name",
        minWidth: 160,
        cell: (u) => (
          <Typography variant="body2" fontWeight={700} noWrap>
            {u.name}
          </Typography>
        ),
      },
      {
        id: "email",
        header: "Email",
        minWidth: 240,
        cell: (u) => (
          <Typography variant="body2" noWrap>
            {u.email}
          </Typography>
        ),
      },
      {
        id: "role",
        header: "Role",
        minWidth: 140,
        cell: (u) => (
          <Select
            size="small"
            value={u.role ?? "user"}
            onChange={(e) =>
              setRoleMutation.mutate({ userId: u.id, role: e.target.value })
            }
          >
            <MenuItem value="user">user</MenuItem>
            <MenuItem value="admin">admin</MenuItem>
            <MenuItem value="owner">owner</MenuItem>
          </Select>
        ),
      },
      {
        id: "banned",
        header: "Banned",
        minWidth: 100,
        cell: (u) =>
          u.banned ? (
            <Chip size="small" label="Banned" color="error" />
          ) : (
            <Chip size="small" label="Active" color="success" />
          ),
      },
      {
        id: "createdAt",
        header: "Created",
        minWidth: 170,
        cell: (u) => fmtDate(u.createdAt),
      },
      {
        id: "actions",
        header: "Actions",
        minWidth: 200,
        cell: (u) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {u.banned ? (
              <Button
                size="small"
                variant="outlined"
                onClick={() => unbanMutation.mutate({ userId: u.id })}
              >
                Unban
              </Button>
            ) : (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={() => banMutation.mutate({ userId: u.id })}
              >
                Ban
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() =>
                setConfirmDialog({
                  open: true,
                  title: "Remove User",
                  message: `Are you sure you want to remove "${u.name}" (${u.email})? This action cannot be undone.`,
                  onConfirm: () => {
                    removeMutation.mutate({ userId: u.id });
                    setConfirmDialog((prev) => ({ ...prev, open: false }));
                  },
                })
              }
            >
              Remove
            </Button>
          </Box>
        ),
      },
    ];
    return cols;
  }, [banMutation, unbanMutation, setRoleMutation, removeMutation]);

  return (
    <Page title="Auth Users" description="Manage auth server users">
      <Card>
        <CardContent>
          {usersQuery.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={24} />
            </Box>
          ) : usersQuery.isError ? (
            <Typography color="error" variant="body2">
              Failed to load auth users.
            </Typography>
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
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmDialog.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setConfirmDialog((prev) => ({ ...prev, open: false }))
            }
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDialog.onConfirm}
            color="error"
            variant="contained"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
