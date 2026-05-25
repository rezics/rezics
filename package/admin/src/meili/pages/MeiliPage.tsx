import {
  type MeiliKey,
  meiliAdminMutations,
  meiliAdminQueries,
} from "@rezics/api/meili/meili.admin.queries";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  buttonVariants,
} from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, X as CloseIcon } from "lucide-react";
import { useState } from "react";
import { Page } from "@/core/layouts/Page";
import {
  MeiliDangerZoneSection,
  type MeiliDangerAction,
} from "../components/MeiliDangerZoneSection";
import { MeiliKeyManagementSection } from "../components/MeiliKeyManagementSection";
import {
  type MeiliAction,
  MeiliOperationsSection,
} from "../components/MeiliOperationsSection";
import {
  admin_meili_admin_key_created,
  admin_meili_admin_key_created_console,
  admin_meili_all_content_deleted,
  admin_meili_all_entities_deleted,
  admin_meili_all_feedbacks_deleted,
  admin_meili_all_indexes_deleted,
  admin_meili_all_posts_deleted,
  admin_meili_all_realms_deleted,
  admin_meili_all_users_deleted,
  admin_meili_checking_status,
  admin_meili_content_index_initialized,
  admin_meili_content_sync_started,
  admin_meili_delete_all_content,
  admin_meili_delete_all_content_confirm,
  admin_meili_delete_all_entities,
  admin_meili_delete_all_entities_confirm,
  admin_meili_delete_all_feedbacks,
  admin_meili_delete_all_feedbacks_confirm,
  admin_meili_delete_all_posts,
  admin_meili_delete_all_posts_confirm,
  admin_meili_delete_all_realms,
  admin_meili_delete_all_realms_confirm,
  admin_meili_delete_all_users,
  admin_meili_delete_all_users_confirm,
  admin_meili_delete_key_confirm,
  admin_meili_deleting,
  admin_meili_description,
  admin_meili_entities_index_initialized,
  admin_meili_entities_sync_started,
  admin_meili_feedbacks_index_initialized,
  admin_meili_feedbacks_sync_started,
  admin_meili_init_content_index,
  admin_meili_init_entities_index,
  admin_meili_init_feedbacks_index,
  admin_meili_init_posts_index,
  admin_meili_init_realms_index,
  admin_meili_init_users_index,
  admin_meili_initializing,
  admin_meili_key_deleted,
  admin_meili_posts_index_initialized,
  admin_meili_posts_sync_started,
  admin_meili_realms_index_initialized,
  admin_meili_realms_sync_started,
  admin_meili_status_label,
  admin_meili_sync_all_content,
  admin_meili_sync_all_entities,
  admin_meili_sync_all_feedbacks,
  admin_meili_sync_all_posts,
  admin_meili_sync_all_realms,
  admin_meili_sync_all_users,
  admin_meili_syncing,
  admin_meili_title,
  admin_meili_users_index_initialized,
  admin_meili_users_sync_started,
  common_dismiss,
  common_unknown,
} from "@rezics/i18n/messages";

type MessageState = {
  type: "success" | "error" | "info";
  text: string;
} | null;

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
  return admin_meili_delete_key_confirm({
    uid: key.uid ?? "",
    name: key.name ? ` (${key.name})` : "",
  });
}

export function MeiliPage() {
  const [message, setMessage] = useState<MessageState>(null);
  const [lastAdminKey, setLastAdminKey] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  const { data: health, isLoading: isHealthLoading } = useQuery(
    meiliAdminQueries.health(),
  );

  const {
    data: keyList,
    isLoading: isKeysLoading,
    refetch: refetchKeys,
  } = useQuery(meiliAdminQueries.keys());

  const initContentMutation = meiliAdminMutations.useInitContentIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_content_index_initialized(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initFeedbacksMutation = meiliAdminMutations.useInitFeedbacksIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_feedbacks_index_initialized(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initUsersMutation = meiliAdminMutations.useInitUsersIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_users_index_initialized(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initPostsMutation = meiliAdminMutations.useInitPostsIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_posts_index_initialized(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initRealmsMutation = meiliAdminMutations.useInitRealmsIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_realms_index_initialized(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initEntitiesMutation = meiliAdminMutations.useInitEntitiesIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_entities_index_initialized(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncContentMutation = meiliAdminMutations.useSyncContent({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: admin_meili_content_sync_started(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncFeedbacksMutation = meiliAdminMutations.useSyncFeedbacks({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: admin_meili_feedbacks_sync_started(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncUsersMutation = meiliAdminMutations.useSyncUsers({
    onSuccess: () => {
      setMessage({ type: "success", text: admin_meili_users_sync_started() });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncPostsMutation = meiliAdminMutations.useSyncPosts({
    onSuccess: () => {
      setMessage({ type: "success", text: admin_meili_posts_sync_started() });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncRealmsMutation = meiliAdminMutations.useSyncRealms({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: admin_meili_realms_sync_started(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncEntitiesMutation = meiliAdminMutations.useSyncEntities({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: admin_meili_entities_sync_started(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllContentMutation = meiliAdminMutations.useDeleteAllContent({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_all_content_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllFeedbacksMutation = meiliAdminMutations.useDeleteAllFeedbacks({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_all_feedbacks_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllUsersMutation = meiliAdminMutations.useDeleteAllUsers({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_all_users_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllPostsMutation = meiliAdminMutations.useDeleteAllPosts({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_all_posts_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllRealmsMutation = meiliAdminMutations.useDeleteAllRealms({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_all_realms_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllEntitiesMutation = meiliAdminMutations.useDeleteAllEntities({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_all_entities_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const resetAllIndexesMutation = meiliAdminMutations.useResetAllIndexes({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_all_indexes_deleted(),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const createAdminKeyMutation = meiliAdminMutations.useCreateAdminKey({
    onSuccess: (res) => {
      const keyString =
        typeof (res as any).key === "string" ? (res as any).key : null;
      setLastAdminKey(keyString);
      setMessage({
        type: "success",
        text: keyString
          ? admin_meili_admin_key_created()
          : admin_meili_admin_key_created_console(),
      });
      if (!keyString) console.log("Meili admin key response", res);
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteKeyMutation = meiliAdminMutations.useDeleteKey({
    onSuccess: async (res) => {
      setMessage({
        type: "success",
        text: res.message || admin_meili_key_deleted(),
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

  const initActions: MeiliAction[] = [
    {
      id: "content",
      label: admin_meili_init_content_index(),
      pendingLabel: admin_meili_initializing(),
      isPending: initContentMutation.isPending,
      onClick: () => initContentMutation.mutate(),
    },
    {
      id: "feedbacks",
      label: admin_meili_init_feedbacks_index(),
      pendingLabel: admin_meili_initializing(),
      isPending: initFeedbacksMutation.isPending,
      onClick: () => initFeedbacksMutation.mutate(),
    },
    {
      id: "users",
      label: admin_meili_init_users_index(),
      pendingLabel: admin_meili_initializing(),
      isPending: initUsersMutation.isPending,
      onClick: () => initUsersMutation.mutate(),
    },
    {
      id: "posts",
      label: admin_meili_init_posts_index(),
      pendingLabel: admin_meili_initializing(),
      isPending: initPostsMutation.isPending,
      onClick: () => initPostsMutation.mutate(),
    },
    {
      id: "realms",
      label: admin_meili_init_realms_index(),
      pendingLabel: admin_meili_initializing(),
      isPending: initRealmsMutation.isPending,
      onClick: () => initRealmsMutation.mutate(),
    },
    {
      id: "entities",
      label: admin_meili_init_entities_index(),
      pendingLabel: admin_meili_initializing(),
      isPending: initEntitiesMutation.isPending,
      onClick: () => initEntitiesMutation.mutate(),
    },
  ];

  const syncActions: MeiliAction[] = [
    {
      id: "content",
      label: admin_meili_sync_all_content(),
      pendingLabel: admin_meili_syncing(),
      isPending: syncContentMutation.isPending,
      onClick: () => syncContentMutation.mutate(),
      variant: "outline",
    },
    {
      id: "feedbacks",
      label: admin_meili_sync_all_feedbacks(),
      pendingLabel: admin_meili_syncing(),
      isPending: syncFeedbacksMutation.isPending,
      onClick: () => syncFeedbacksMutation.mutate(),
      variant: "outline",
    },
    {
      id: "users",
      label: admin_meili_sync_all_users(),
      pendingLabel: admin_meili_syncing(),
      isPending: syncUsersMutation.isPending,
      onClick: () => syncUsersMutation.mutate(),
      variant: "outline",
    },
    {
      id: "posts",
      label: admin_meili_sync_all_posts(),
      pendingLabel: admin_meili_syncing(),
      isPending: syncPostsMutation.isPending,
      onClick: () => syncPostsMutation.mutate(),
      variant: "outline",
    },
    {
      id: "realms",
      label: admin_meili_sync_all_realms(),
      pendingLabel: admin_meili_syncing(),
      isPending: syncRealmsMutation.isPending,
      onClick: () => syncRealmsMutation.mutate(),
      variant: "outline",
    },
    {
      id: "entities",
      label: admin_meili_sync_all_entities(),
      pendingLabel: admin_meili_syncing(),
      isPending: syncEntitiesMutation.isPending,
      onClick: () => syncEntitiesMutation.mutate(),
      variant: "outline",
    },
  ];

  const deleteActions: MeiliDangerAction[] = [
    {
      id: "content",
      label: admin_meili_delete_all_content(),
      pendingLabel: admin_meili_deleting(),
      confirmLabel: admin_meili_delete_all_content_confirm(),
      isPending: deleteAllContentMutation.isPending,
      onConfirm: () => deleteAllContentMutation.mutate(),
    },
    {
      id: "feedbacks",
      label: admin_meili_delete_all_feedbacks(),
      pendingLabel: admin_meili_deleting(),
      confirmLabel: admin_meili_delete_all_feedbacks_confirm(),
      isPending: deleteAllFeedbacksMutation.isPending,
      onConfirm: () => deleteAllFeedbacksMutation.mutate(),
    },
    {
      id: "users",
      label: admin_meili_delete_all_users(),
      pendingLabel: admin_meili_deleting(),
      confirmLabel: admin_meili_delete_all_users_confirm(),
      isPending: deleteAllUsersMutation.isPending,
      onConfirm: () => deleteAllUsersMutation.mutate(),
    },
    {
      id: "posts",
      label: admin_meili_delete_all_posts(),
      pendingLabel: admin_meili_deleting(),
      confirmLabel: admin_meili_delete_all_posts_confirm(),
      isPending: deleteAllPostsMutation.isPending,
      onConfirm: () => deleteAllPostsMutation.mutate(),
    },
    {
      id: "realms",
      label: admin_meili_delete_all_realms(),
      pendingLabel: admin_meili_deleting(),
      confirmLabel: admin_meili_delete_all_realms_confirm(),
      isPending: deleteAllRealmsMutation.isPending,
      onConfirm: () => deleteAllRealmsMutation.mutate(),
    },
    {
      id: "entities",
      label: admin_meili_delete_all_entities(),
      pendingLabel: admin_meili_deleting(),
      confirmLabel: admin_meili_delete_all_entities_confirm(),
      isPending: deleteAllEntitiesMutation.isPending,
      onConfirm: () => deleteAllEntitiesMutation.mutate(),
    },
  ];

  return (
    <Page
      title={admin_meili_title()}
      description={
        <div className="space-y-2">
          <p>{admin_meili_description()}</p>
          {isHealthLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Spinner size="sm" />
              <span>{admin_meili_checking_status()}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span>{admin_meili_status_label()}</span>
              <Badge
                variant="outline"
                className={
                  health?.status === "available"
                    ? "border-border-whisper bg-surface-subtle text-success-text"
                    : "border-border-whisper bg-surface-subtle text-warning-text"
                }
              >
                {health?.status ?? common_unknown()}
              </Badge>
            </div>
          )}
        </div>
      }
      actions={
        <Link
          to="/meili/observability"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <BarChart3 className="size-4" aria-hidden="true" />
          狀態觀測
        </Link>
      }
    >
      <div className="space-y-4">
        {message ? (
          <Alert>
            <AlertDescription
              className={`flex flex-row items-center justify-between gap-3 ${messageClass(message.type)}`}
            >
              <span>{message.text}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={common_dismiss()}
                onClick={() => setMessage(null)}
              >
                <CloseIcon className="size-4" />
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <MeiliOperationsSection
          initActions={initActions}
          syncActions={syncActions}
        />

        <MeiliDangerZoneSection
          deleteActions={deleteActions}
          resetDialogOpen={resetDialogOpen}
          resetConfirmText={resetConfirmText}
          isResetPending={resetAllIndexesMutation.isPending}
          onResetDialogOpenChange={setResetDialogOpen}
          onResetConfirmTextChange={setResetConfirmText}
          onReset={() => resetAllIndexesMutation.mutate()}
        />

        <MeiliKeyManagementSection
          keyList={keyList}
          lastAdminKey={lastAdminKey}
          isKeysLoading={isKeysLoading}
          isCreating={createAdminKeyMutation.isPending}
          isDeleting={deleteKeyMutation.isPending}
          onCreateAdminKey={() => createAdminKeyMutation.mutate()}
          onRefreshKeys={() => {
            void refetchKeys();
          }}
          onDeleteKey={handleDeleteKey}
        />
      </div>
    </Page>
  );
}

export default MeiliPage;
