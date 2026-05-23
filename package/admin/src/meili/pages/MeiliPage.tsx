import {
  type MeiliKey,
  meiliAdminMutations,
  meiliAdminQueries,
} from "@rezics/api/meili/meili.admin.queries";
import * as m from "@rezics/i18n/messages";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Separator,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { X as CloseIcon } from "lucide-react";
import { useState } from "react";

type MessageState = {
  type: "success" | "error" | "info";
  text: string;
} | null;

const RESET_CONFIRMATION_TOKEN = "RESET";

function messageClass(type: "success" | "error" | "info") {
  switch (type) {
    case "success":
      return "text-success-text";
    case "error":
      return "text-error-text";
    default:
      return "text-info-text";
  }
}

function meiliDeleteConfirmLabel(key: MeiliKey) {
  return m.admin_meili_delete_key_confirm({
    uid: key.uid ?? "",
    name: key.name ? ` (${key.name})` : "",
  });
}

export function MeiliPage() {
  const [message, setMessage] = useState<MessageState>(null);
  const [lastAdminKey, setLastAdminKey] = useState<string | null>(null);

  const { data: health, isLoading: isHealthLoading } = useQuery(
    meiliAdminQueries.health(),
  );

  const {
    data: keyList,
    isLoading: isKeysLoading,
    refetch: refetchKeys,
  } = useQuery(meiliAdminQueries.keys());

  // Index initialization
  const initContentMutation = meiliAdminMutations.useInitContentIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_content_index_initialized(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initFeedbacksMutation = meiliAdminMutations.useInitFeedbacksIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_feedbacks_index_initialized(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initUsersMutation = meiliAdminMutations.useInitUsersIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_users_index_initialized(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initPostsMutation = meiliAdminMutations.useInitPostsIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_posts_index_initialized(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initRealmsMutation = meiliAdminMutations.useInitRealmsIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_realms_index_initialized(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initEntitiesMutation = meiliAdminMutations.useInitEntitiesIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_entities_index_initialized(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  // Full sync
  const syncContentMutation = meiliAdminMutations.useSyncContent({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: m.admin_meili_content_sync_started(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncFeedbacksMutation = meiliAdminMutations.useSyncFeedbacks({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: m.admin_meili_feedbacks_sync_started(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncUsersMutation = meiliAdminMutations.useSyncUsers({
    onSuccess: () => {
      setMessage({ type: "success", text: m.admin_meili_users_sync_started() });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncPostsMutation = meiliAdminMutations.useSyncPosts({
    onSuccess: () => {
      setMessage({ type: "success", text: m.admin_meili_posts_sync_started() });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncRealmsMutation = meiliAdminMutations.useSyncRealms({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: m.admin_meili_realms_sync_started(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncEntitiesMutation = meiliAdminMutations.useSyncEntities({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: m.admin_meili_entities_sync_started(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  // Dangerous operations
  const deleteAllContentMutation = meiliAdminMutations.useDeleteAllContent({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_all_content_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllFeedbacksMutation = meiliAdminMutations.useDeleteAllFeedbacks({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_all_feedbacks_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllUsersMutation = meiliAdminMutations.useDeleteAllUsers({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_all_users_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllPostsMutation = meiliAdminMutations.useDeleteAllPosts({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_all_posts_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllRealmsMutation = meiliAdminMutations.useDeleteAllRealms({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_all_realms_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllEntitiesMutation = meiliAdminMutations.useDeleteAllEntities({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_all_entities_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const resetAllIndexesMutation = meiliAdminMutations.useResetAllIndexes({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_all_indexes_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  // Key management
  const createAdminKeyMutation = meiliAdminMutations.useCreateAdminKey({
    onSuccess: (res) => {
      const keyString =
        typeof (res as any).key === "string" ? (res as any).key : null;
      setLastAdminKey(keyString);
      setMessage({
        type: "success",
        text: keyString
          ? m.admin_meili_admin_key_created()
          : m.admin_meili_admin_key_created_console(),
      });
      if (!keyString) console.log("Meili admin key response", res);
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteKeyMutation = meiliAdminMutations.useDeleteKey({
    onSuccess: async (res) => {
      setMessage({
        type: "success",
        text: res.message || m.admin_meili_key_deleted(),
      });
      await refetchKeys();
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const handleDeleteKey = (key: MeiliKey) => {
    if (!key.uid) return;
    const ok = window.confirm(meiliDeleteConfirmLabel(key));
    if (!ok) return;
    deleteKeyMutation.mutate(key.uid);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-8xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{m.admin_meili_title()}</h1>
          <p className="text-sm text-text-secondary">
            {m.admin_meili_description()}
          </p>
          {isHealthLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Spinner size="sm" />
              <span>{m.admin_meili_checking_status()}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span>{m.admin_meili_status_label()}</span>
              <Badge
                className={
                  health?.status === "available"
                    ? "bg-success-fill text-white"
                    : "bg-warning-fill text-white"
                }
              >
                {health?.status ?? m.common_unknown()}
              </Badge>
            </div>
          )}
        </div>

        {message && (
          <Alert className="shadow-sm">
            <AlertDescription
              className={`flex flex-row items-center justify-between ${messageClass(message.type)}`}
            >
              <span>{message.text}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={m.common_dismiss()}
                onClick={() => setMessage(null)}
                className="size-6"
              >
                <CloseIcon className="size-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          {/* Index initialization */}
          <Card>
            <CardHeader>
              <CardTitle>
                {m.admin_meili_index_initialization_title()}
              </CardTitle>
              <CardDescription>
                {m.admin_meili_index_initialization_description()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => initContentMutation.mutate()}
                  disabled={initContentMutation.isPending}
                >
                  {initContentMutation.isPending
                    ? m.admin_meili_initializing()
                    : m.admin_meili_init_content_index()}
                </Button>
                <Button
                  size="sm"
                  onClick={() => initFeedbacksMutation.mutate()}
                  disabled={initFeedbacksMutation.isPending}
                >
                  {initFeedbacksMutation.isPending
                    ? m.admin_meili_initializing()
                    : m.admin_meili_init_feedbacks_index()}
                </Button>
                <Button
                  size="sm"
                  onClick={() => initUsersMutation.mutate()}
                  disabled={initUsersMutation.isPending}
                >
                  {initUsersMutation.isPending
                    ? m.admin_meili_initializing()
                    : m.admin_meili_init_users_index()}
                </Button>
                <Button
                  size="sm"
                  onClick={() => initPostsMutation.mutate()}
                  disabled={initPostsMutation.isPending}
                >
                  {initPostsMutation.isPending
                    ? m.admin_meili_initializing()
                    : m.admin_meili_init_posts_index()}
                </Button>
                <Button
                  size="sm"
                  onClick={() => initRealmsMutation.mutate()}
                  disabled={initRealmsMutation.isPending}
                >
                  {initRealmsMutation.isPending
                    ? m.admin_meili_initializing()
                    : m.admin_meili_init_realms_index()}
                </Button>
                <Button
                  size="sm"
                  onClick={() => initEntitiesMutation.mutate()}
                  disabled={initEntitiesMutation.isPending}
                >
                  {initEntitiesMutation.isPending
                    ? m.admin_meili_initializing()
                    : m.admin_meili_init_entities_index()}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Full sync */}
          <Card>
            <CardHeader>
              <CardTitle>{m.admin_meili_full_sync_title()}</CardTitle>
              <CardDescription>
                {m.admin_meili_full_sync_description()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncContentMutation.mutate()}
                  disabled={syncContentMutation.isPending}
                >
                  {syncContentMutation.isPending
                    ? m.admin_meili_syncing()
                    : m.admin_meili_sync_all_content()}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncFeedbacksMutation.mutate()}
                  disabled={syncFeedbacksMutation.isPending}
                >
                  {syncFeedbacksMutation.isPending
                    ? m.admin_meili_syncing()
                    : m.admin_meili_sync_all_feedbacks()}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncUsersMutation.mutate()}
                  disabled={syncUsersMutation.isPending}
                >
                  {syncUsersMutation.isPending
                    ? m.admin_meili_syncing()
                    : m.admin_meili_sync_all_users()}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncPostsMutation.mutate()}
                  disabled={syncPostsMutation.isPending}
                >
                  {syncPostsMutation.isPending
                    ? m.admin_meili_syncing()
                    : m.admin_meili_sync_all_posts()}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncRealmsMutation.mutate()}
                  disabled={syncRealmsMutation.isPending}
                >
                  {syncRealmsMutation.isPending
                    ? m.admin_meili_syncing()
                    : m.admin_meili_sync_all_realms()}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncEntitiesMutation.mutate()}
                  disabled={syncEntitiesMutation.isPending}
                >
                  {syncEntitiesMutation.isPending
                    ? m.admin_meili_syncing()
                    : m.admin_meili_sync_all_entities()}
                </Button>
              </div>
              <p className="text-xs text-text-secondary">
                {m.admin_meili_sync_help()}
              </p>
            </CardContent>
          </Card>

          {/* Dangerous operations */}
          <Card>
            <CardHeader>
              <CardTitle>
                {m.admin_meili_dangerous_operations_title()}
              </CardTitle>
              <CardDescription>
                {m.admin_meili_dangerous_operations_description()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-1">
                  {m.admin_meili_delete_all_documents_title()}
                </p>
                <p className="text-xs text-text-secondary block mb-2">
                  {m.admin_meili_delete_all_documents_description()}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-error-fill text-white"
                    onClick={() => {
                      const ok = window.confirm(
                        m.admin_meili_delete_all_content_confirm(),
                      );
                      if (!ok) return;
                      deleteAllContentMutation.mutate();
                    }}
                    disabled={deleteAllContentMutation.isPending}
                  >
                    {deleteAllContentMutation.isPending
                      ? m.admin_meili_deleting()
                      : m.admin_meili_delete_all_content()}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-error-fill text-white"
                    onClick={() => {
                      const ok = window.confirm(
                        m.admin_meili_delete_all_feedbacks_confirm(),
                      );
                      if (!ok) return;
                      deleteAllFeedbacksMutation.mutate();
                    }}
                    disabled={deleteAllFeedbacksMutation.isPending}
                  >
                    {deleteAllFeedbacksMutation.isPending
                      ? m.admin_meili_deleting()
                      : m.admin_meili_delete_all_feedbacks()}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-error-fill text-white"
                    onClick={() => {
                      const ok = window.confirm(
                        m.admin_meili_delete_all_users_confirm(),
                      );
                      if (!ok) return;
                      deleteAllUsersMutation.mutate();
                    }}
                    disabled={deleteAllUsersMutation.isPending}
                  >
                    {deleteAllUsersMutation.isPending
                      ? m.admin_meili_deleting()
                      : m.admin_meili_delete_all_users()}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-error-fill text-white"
                    onClick={() => {
                      const ok = window.confirm(
                        m.admin_meili_delete_all_posts_confirm(),
                      );
                      if (!ok) return;
                      deleteAllPostsMutation.mutate();
                    }}
                    disabled={deleteAllPostsMutation.isPending}
                  >
                    {deleteAllPostsMutation.isPending
                      ? m.admin_meili_deleting()
                      : m.admin_meili_delete_all_posts()}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-error-fill text-white"
                    onClick={() => {
                      const ok = window.confirm(
                        m.admin_meili_delete_all_realms_confirm(),
                      );
                      if (!ok) return;
                      deleteAllRealmsMutation.mutate();
                    }}
                    disabled={deleteAllRealmsMutation.isPending}
                  >
                    {deleteAllRealmsMutation.isPending
                      ? m.admin_meili_deleting()
                      : m.admin_meili_delete_all_realms()}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-error-fill text-white"
                    onClick={() => {
                      const ok = window.confirm(
                        m.admin_meili_delete_all_entities_confirm(),
                      );
                      if (!ok) return;
                      deleteAllEntitiesMutation.mutate();
                    }}
                    disabled={deleteAllEntitiesMutation.isPending}
                  >
                    {deleteAllEntitiesMutation.isPending
                      ? m.admin_meili_deleting()
                      : m.admin_meili_delete_all_entities()}
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-semibold mb-1 text-error-text">
                  {m.admin_meili_reset_everything_title()}
                </p>
                <p className="text-xs text-text-secondary block mb-2">
                  {m.admin_meili_reset_everything_description()}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-error-text"
                  onClick={() => setResetDialogOpen(true)}
                  disabled={resetAllIndexesMutation.isPending}
                >
                  {resetAllIndexesMutation.isPending
                    ? m.admin_meili_resetting()
                    : m.admin_meili_reset_everything_title()}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Reset confirmation dialog */}
          <Dialog
            open={resetDialogOpen}
            onOpenChange={(o) => {
              if (!o) {
                setResetDialogOpen(false);
                setResetConfirmText("");
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{m.admin_meili_reset_dialog_title()}</DialogTitle>
                <DialogDescription>
                  {m.admin_meili_reset_dialog_description()}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2">
                <p className="text-sm mb-2">
                  {m.admin_meili_reset_type_to_confirm_prefix()}{" "}
                  <strong>{RESET_CONFIRMATION_TOKEN}</strong>{" "}
                  {m.admin_meili_reset_type_to_confirm_suffix()}
                </p>
                <Input
                  autoFocus
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder={RESET_CONFIRMATION_TOKEN}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setResetDialogOpen(false);
                    setResetConfirmText("");
                  }}
                >
                  {m.common_cancel()}
                </Button>
                <Button
                  className="bg-error-fill text-white"
                  disabled={resetConfirmText !== RESET_CONFIRMATION_TOKEN}
                  onClick={() => {
                    resetAllIndexesMutation.mutate();
                    setResetDialogOpen(false);
                    setResetConfirmText("");
                  }}
                >
                  {m.admin_meili_delete_all_indexes()}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Key management */}
        <Card>
          <CardHeader>
            <CardTitle>{m.admin_meili_key_management_title()}</CardTitle>
            <CardDescription>
              {m.admin_meili_key_management_description()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-warning-text"
                onClick={() => createAdminKeyMutation.mutate()}
                disabled={createAdminKeyMutation.isPending}
              >
                {createAdminKeyMutation.isPending
                  ? m.admin_meili_creating()
                  : m.admin_meili_create_admin_key()}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchKeys()}
                disabled={isKeysLoading}
              >
                {m.admin_meili_refresh_key_list()}
              </Button>
            </div>

            {lastAdminKey && (
              <div className="text-xs break-all space-y-1">
                <div className="font-semibold text-warning-text">
                  {m.admin_meili_latest_admin_key()}
                </div>
                <code className="px-2 py-1 rounded bg-surface-elevated">
                  {lastAdminKey}
                </code>
              </div>
            )}

            <div className="border-t border-border-whisper pt-3">
              <p className="text-sm font-semibold mb-2">
                {m.admin_meili_existing_keys_title()}
              </p>
              {isKeysLoading ? (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Spinner size="sm" />
                  <span>{m.admin_meili_loading_keys()}</span>
                </div>
              ) : !keyList || keyList.results.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  {m.admin_meili_no_keys_found()}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-border-whisper text-text-secondary">
                      <tr>
                        <th className="py-1 pr-3">{m.common_uid()}</th>
                        <th className="py-1 pr-3">{m.common_name()}</th>
                        <th className="py-1 pr-3">{m.common_actions()}</th>
                        <th className="py-1 pr-3">{m.common_indexes()}</th>
                        <th className="py-1 pr-3">{m.common_expires()}</th>
                        <th className="py-1 pr-3">{m.common_action()}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keyList.results.map((key) => (
                        <tr
                          key={key.uid}
                          className="border-b border-border-whisper"
                        >
                          <td className="py-1 pr-3 align-top font-mono text-[11px]">
                            {key.uid}
                          </td>
                          <td className="py-1 pr-3 align-top text-[11px]">
                            {key.name || "-"}
                          </td>
                          <td className="py-1 pr-3 align-top text-[11px]">
                            {(key.actions || []).join(", ") || "-"}
                          </td>
                          <td className="py-1 pr-3 align-top text-[11px]">
                            {(key.indexes || []).join(", ") || "-"}
                          </td>
                          <td className="py-1 pr-3 align-top text-[11px]">
                            {key.expiresAt || m.common_never()}
                          </td>
                          <td className="py-1 pr-3 align-top">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-error-text"
                              onClick={() => handleDeleteKey(key)}
                              disabled={deleteKeyMutation.isPending}
                            >
                              {m.common_delete()}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default MeiliPage;
