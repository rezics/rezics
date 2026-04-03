import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import React from 'react';
import {useQuery} from '@tanstack/react-query';

import {authQueries} from '@rezics/api/auth/auth.queries';
import {useRevokeSessionMutation} from '@rezics/api/auth/auth.mutations';

import {Page} from '@/core/layout/Page';
import {
  PaginatedTable,
  type PaginatedColumn,
} from '@/component/table/PaginatedTable';

function fmtDate(v?: string | Date) {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
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
  }>({open: false, token: ''});

  const sessionsQuery = useQuery(authQueries.sessions());
  const revokeMutation = useRevokeSessionMutation();

  const sessions = (sessionsQuery.data?.sessions ?? []) as AuthSession[];
  const total = sessions.length;
  const paginatedSessions = sessions.slice(page * limit, (page + 1) * limit);

  const columns = React.useMemo(() => {
    const cols: PaginatedColumn<AuthSession>[] = [
      {
        id: 'token',
        header: 'Token',
        minWidth: 220,
        cell: s => (
          <Typography variant="body2" sx={{fontFamily: 'monospace'}}>
            {s.token.slice(0, 16)}…
          </Typography>
        ),
      },
      {
        id: 'createdAt',
        header: 'Created',
        minWidth: 170,
        cell: s => fmtDate(s.createdAt),
      },
      {
        id: 'expiresAt',
        header: 'Expires',
        minWidth: 170,
        cell: s => fmtDate(s.expiresAt),
      },
      {
        id: 'userAgent',
        header: 'User Agent',
        minWidth: 300,
        cell: s => (
          <Typography variant="body2" noWrap>
            {s.userAgent ?? '-'}
          </Typography>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        minWidth: 120,
        cell: s => (
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => setConfirmDialog({open: true, token: s.token})}
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
            <Box sx={{display: 'flex', justifyContent: 'center', py: 6}}>
              <CircularProgress size={24} />
            </Box>
          ) : sessionsQuery.isError ? (
            <Typography color="error" variant="body2">
              Failed to load sessions.
            </Typography>
          ) : (
            <PaginatedTable<AuthSession>
              columns={columns}
              rows={paginatedSessions}
              getRowId={s => s.token}
              count={total}
              page={page}
              rowsPerPage={limit}
              onPageChange={nextPage => setPage(nextPage)}
              onRowsPerPageChange={next => {
                setLimit(next);
                setPage(0);
              }}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({open: false, token: ''})}
      >
        <DialogTitle>Revoke Session</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to revoke this session? The user will be
            logged out.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({open: false, token: ''})}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              revokeMutation.mutate({token: confirmDialog.token});
              setConfirmDialog({open: false, token: ''});
            }}
            color="error"
            variant="contained"
          >
            Revoke
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
