import {useEffect, useState} from 'react';
import type {FC} from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {useQuery} from '@tanstack/react-query';
import {tokenQueries} from '@/api/token/token.queries';
import {
  useCreateTokenMutation,
  useRevokeTokenMutation,
} from '@/api/token/token.mutations';
import type {ApiTokenDTO, CreateApiTokenInput} from '@package/contract';

/**
 * TokenPage - 管理当前用户的 API tokens
 * - 列表展示
 * - 新建 token（仅返回一次的原始 token）
 * - 撤销 token
 */
export const TokenPage: FC = () => {
  const {data, isLoading, error} = useQuery(tokenQueries.list());

  const [tokens, setTokens] = useState<ApiTokenDTO[]>([]);

  useEffect(() => {
    if (data?.tokens) setTokens(data.tokens);
  }, [data]);

  const createMutation = useCreateTokenMutation();
  const revokeMutation = useRevokeTokenMutation();

  const [creating, setCreating] = useState(false);
  const [revokingIds, setRevokingIds] = useState<Record<string, boolean>>({});

  // Create dialog state
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [creatingError, setCreatingError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreatingError(null);
    const input: CreateApiTokenInput = {
      name: name || 'New Token',
      ...(expiresAt ? {expiresAt} : {}),
    };

    try {
      setCreating(true);
      const res = await createMutation.mutateAsync(input);
      // res: {token, tokenInfo}
      setCreatedSecret(res.token);
      setOpenCreate(false);
      setName('');
      setExpiresAt('');
    } catch (err) {
      setCreatingError((err as Error)?.message ?? 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this token? This action cannot be undone.')) return;
    try {
      setRevokingIds(s => ({...s, [id]: true}));
      await revokeMutation.mutateAsync(id);
    } catch (err) {
      // simple alert for errors
      alert((err as Error)?.message ?? 'Revoke failed');
    } finally {
      setRevokingIds(s => ({...s, [id]: false}));
    }
  };

  const copyToClipboard = async (text: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      // ignore
    }
  };

  return (
    <Box className="w-11/12 mx-auto mt-10">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h3" className="font-bold mb-6">
          API Tokens
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setOpenCreate(true)}
        >
          Create Token
        </Button>
      </Stack>

      {isLoading && (
        <Box className="flex items-center justify-center h-40">
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" className="mb-4">
          {(error as Error).message}
        </Alert>
      )}

      {!isLoading && !error && tokens.length === 0 && (
        <Box className="flex items-center justify-center h-40">
          <Typography variant="h6" color="textSecondary">
            No API tokens found
          </Typography>
        </Box>
      )}

      {!isLoading && !error && tokens.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Revoked</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tokens.map(t => (
              <TableRow key={t.id} hover>
                <TableCell>{t.name}</TableCell>
                <TableCell>
                  {t.createdAt ? new Date(t.createdAt).toLocaleString() : '-'}
                </TableCell>
                <TableCell>
                  {t.expiresAt
                    ? new Date(t.expiresAt).toLocaleString()
                    : 'Never'}
                </TableCell>
                <TableCell>{t.revoked ? 'Yes' : 'No'}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Tooltip title="Revoke">
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleRevoke(t.id)}
                        disabled={(t.revoked ?? false) || !!revokingIds[t.id]}
                      >
                        Revoke
                      </Button>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create dialog */}
      <Dialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create API Token</DialogTitle>
        <DialogContent>
          <Box className="space-y-4 mt-2">
            <TextField
              fullWidth
              label="Token name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <div className="my-6" />
            <TextField
              fullWidth
              type="datetime-local"
              label="Expires At (optional)"
              InputLabelProps={{shrink: true}}
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
            />
            {creatingError && <Alert severity="error">{creatingError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            color="primary"
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Created secret dialog (shown once) */}
      <Dialog
        open={!!createdSecret}
        onClose={() => setCreatedSecret(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Token Created — Copy & Store</DialogTitle>
        <DialogContent>
          <Box className="mt-2">
            <Alert severity="warning">
              This token value is only shown once. Be sure to copy and store it
              securely.
            </Alert>

            <Box className="mt-4 flex items-center justify-between">
              <Typography
                variant="body1"
                component="pre"
                style={{whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}
              >
                {createdSecret}
              </Typography>
              <IconButton onClick={() => copyToClipboard(createdSecret)}>
                <ContentCopyIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreatedSecret(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TokenPage;
