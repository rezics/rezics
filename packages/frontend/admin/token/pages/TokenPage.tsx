import {
  useCreateTokenMutation,
  useRevokeTokenMutation,
  useUpdateTokenMutation,
} from "@rezics/contract/api/token/token.mutations";
import { tokenQueries } from "@rezics/contract/api/token/token.queries";
import type {
  ApiTokenDTO,
  CreateApiTokenInput,
  UpdateApiTokenInput,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Alert, AlertDescription, Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { Page } from "@/admin/core/layouts/Page";
import {
  CreateTokenDialog,
  EditTokenDialog,
  TokenSecretDialog,
  TokenTable,
} from "../components";

/**
 * TokenPage - manage the current user's API tokens.
 * - list view
 * - create token (raw token returned only once)
 * - edit token (update scopes, etc.)
 * - revoke token
 * TokenPage - 管理当前用户的 API tokens。
 * - 列表展示
 * - 新建 token（仅返回一次的原始 token）
 * - 编辑 token（更新权限等）
 * - 撤销 token
 */
export const TokenPage: FC = () => {
  const { t } = useTranslation(["admin"]);
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
  // 新建对话框状态
  const [openCreate, setOpenCreate] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [creatingError, setCreatingError] = useState<string | null>(null);

  // Edit dialog state
  // 编辑对话框状态
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
        (err as Error)?.message ?? t("admin:token_create_failed"),
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
        (err as Error)?.message ?? t("admin:token_update_failed"),
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm(t("admin:token_revoke_confirm"))) return;
    try {
      setRevokingIds((s) => ({ ...s, [id]: true }));
      await revokeMutation.mutateAsync(id);
    } catch (err) {
      alert((err as Error)?.message ?? t("admin:token_revoke_failed"));
    } finally {
      setRevokingIds((s) => ({ ...s, [id]: false }));
    }
  };

  return (
    <Page
      title={t("admin:token_title")}
      actions={
        <Button onClick={() => setOpenCreate(true)}>
          {t("admin:token_create_button")}
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
            {t("admin:token_empty")}
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

      <CreateTokenDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreate={handleCreate}
        creating={creating}
        error={creatingError}
      />

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

      {/* Created secret dialog (shown once). 新建密钥对话框（仅展示一次）。 */}
      <TokenSecretDialog
        open={!!createdSecret}
        secret={createdSecret}
        onClose={() => setCreatedSecret(null)}
      />
    </Page>
  );
};

export default TokenPage;
