import {useEffect, useState} from 'react';
import type {FC} from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {tokenQueries} from '@package/api/token/token.queries';
import {
  useCreateTokenMutation,
  useRevokeTokenMutation,
  useUpdateTokenMutation,
} from '@package/api/token/token.mutations';
import type {
  ApiTokenDTO,
  CreateApiTokenInput,
  UpdateApiTokenInput,
} from '@package/contract';
import {
  TokenTable,
  CreateTokenDialog,
  EditTokenDialog,
  TokenSecretDialog,
} from './component';

/**
 * TokenPage - 管理当前用户的 API tokens
 * - 列表展示
 * - 新建 token（仅返回一次的原始 token）
 * - 编辑 token（更新权限等）
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
  const updateMutation = useUpdateTokenMutation();

  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [revokingIds, setRevokingIds] = useState<Record<string, boolean>>({});

  // Create dialog state
  const [openCreate, setOpenCreate] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [creatingError, setCreatingError] = useState<string | null>(null);

  // Edit dialog state
  const [openEdit, setOpenEdit] = useState(false);
  const [editingToken, setEditingToken] = useState<ApiTokenDTO | null>(null);
  const [updatingError, setUpdatingError] = useState<string | null>(null);

  const handleCreate = async (input: CreateApiTokenInput) => {
    setCreatingError(null);
    try {
      setCreating(true);
      const res = await createMutation.mutateAsync(input);
      setCreatedSecret(res.token);
      setOpenCreate(false);
    } catch (err) {
      setCreatingError((err as Error)?.message ?? 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (token: ApiTokenDTO) => {
    setEditingToken(token);
    setUpdatingError(null);
    setOpenEdit(true);
  };

  const handleUpdate = async (id: string, input: UpdateApiTokenInput) => {
    setUpdatingError(null);
    try {
      setUpdating(true);
      await updateMutation.mutateAsync({id, input});
      setOpenEdit(false);
      setEditingToken(null);
    } catch (err) {
      setUpdatingError((err as Error)?.message ?? 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this token? This action cannot be undone.')) return;
    try {
      setRevokingIds(s => ({...s, [id]: true}));
      await revokeMutation.mutateAsync(id);
    } catch (err) {
      alert((err as Error)?.message ?? 'Revoke failed');
    } finally {
      setRevokingIds(s => ({...s, [id]: false}));
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
        <TokenTable
          tokens={tokens}
          revokingIds={revokingIds}
          onRevoke={handleRevoke}
          onEdit={handleEdit}
        />
      )}

      {/* Create dialog */}
      <CreateTokenDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreate={handleCreate}
        creating={creating}
        error={creatingError}
      />

      {/* Edit dialog */}
      <EditTokenDialog
        open={openEdit}
        token={editingToken}
        onClose={() => {
          setOpenEdit(false);
          setEditingToken(null);
        }}
        onUpdate={handleUpdate}
        updating={updating}
        error={updatingError}
      />

      {/* Created secret dialog (shown once) */}
      <TokenSecretDialog
        open={!!createdSecret}
        secret={createdSecret}
        onClose={() => setCreatedSecret(null)}
      />
    </Box>
  );
};

export default TokenPage;
