import {
  useCreateTokenMutation,
  useRevokeTokenMutation,
  useUpdateTokenMutation,
} from "@rezics/api/token/token.mutations";
import { tokenQueries } from "@rezics/api/token/token.queries";
import type {
  ApiTokenDTO,
  CreateApiTokenInput,
  UpdateApiTokenInput,
} from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { Spinner } from "@rezics/ui";
import { Alert, AlertDescription, Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { Page } from "@/core/layouts/Page";
import {
  CreateTokenDialog,
  EditTokenDialog,
  TokenSecretDialog,
  TokenTable,
} from "../components";

/**
 * TokenPage - 管理当前用户的 API tokens
 * - 列表展示
 * - 新建 token（仅返回一次的原始 token）
 * - 编辑 token（更新权限等）
 * - 撤销 token
 */
export const TokenPage: FC = () => {
  const { data, isLoading, error } = useQuery(tokenQueries.list());

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
      setCreatingError(
        (err as Error)?.message ?? m.admin_token_create_failed(),
      );
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
      await updateMutation.mutateAsync({ id, input });
      setOpenEdit(false);
      setEditingToken(null);
    } catch (err) {
      setUpdatingError(
        (err as Error)?.message ?? m.admin_token_update_failed(),
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm(m.admin_token_revoke_confirm())) return;
    try {
      setRevokingIds((s) => ({ ...s, [id]: true }));
      await revokeMutation.mutateAsync(id);
    } catch (err) {
      alert((err as Error)?.message ?? m.admin_token_revoke_failed());
    } finally {
      setRevokingIds((s) => ({ ...s, [id]: false }));
    }
  };

  return (
    <Page
      title={m.admin_token_title()}
      actions={
        <Button onClick={() => setOpenCreate(true)}>
          {m.admin_token_create_button()}
        </Button>
      }
    >
      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Spinner />
        </div>
      )}

      {error && (
        <Alert className="mb-4">
          <AlertDescription className="text-error-text">
            {(error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && tokens.length === 0 && (
        <div className="flex items-center justify-center h-40">
          <p className="text-base text-text-secondary">
            {m.admin_token_empty()}
          </p>
        </div>
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
    </Page>
  );
};

export default TokenPage;
