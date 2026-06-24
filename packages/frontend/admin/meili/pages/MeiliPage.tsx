import {
  type MeiliKey,
  meiliAdminMutations,
  meiliAdminQueries,
} from "@rezics/contract/api/meili/meili.admin.queries";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  buttonVariants,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BarChart3, X as CloseIcon } from "lucide-react";
import { useState } from "react";
import { Page } from "@/admin/core/layouts/Page";
import {
  type MeiliDangerAction,
  MeiliDangerZoneSection,
} from "../components/MeiliDangerZoneSection";
import { MeiliKeyManagementSection } from "../components/MeiliKeyManagementSection";
import {
  type MeiliAction,
  MeiliOperationsSection,
} from "../components/MeiliOperationsSection";

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
  return getI18nRuntime().i18n.t("admin:meili_delete_key_confirm", {
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
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_content_index_initialized"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initFeedbacksMutation = meiliAdminMutations.useInitFeedbacksIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_feedbacks_index_initialized"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initUsersMutation = meiliAdminMutations.useInitUsersIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_users_index_initialized"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initPostsMutation = meiliAdminMutations.useInitPostsIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_posts_index_initialized"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initPollsMutation = meiliAdminMutations.useInitPollsIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_polls_index_initialized"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initRealmsMutation = meiliAdminMutations.useInitRealmsIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_realms_index_initialized"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initZonesMutation = meiliAdminMutations.useInitZonesIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_zones_index_initialized"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initTagsMutation = meiliAdminMutations.useInitTagsIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_tags_index_initialized"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initLabelsMutation = meiliAdminMutations.useInitLabelsIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_labels_index_initialized"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initEntitiesMutation = meiliAdminMutations.useInitEntitiesIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_entities_index_initialized"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncContentMutation = meiliAdminMutations.useSyncContent({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: getI18nRuntime().i18n.t("admin:meili_content_sync_started"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncFeedbacksMutation = meiliAdminMutations.useSyncFeedbacks({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: getI18nRuntime().i18n.t("admin:meili_feedbacks_sync_started"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncUsersMutation = meiliAdminMutations.useSyncUsers({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: getI18nRuntime().i18n.t("admin:meili_users_sync_started"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncPostsMutation = meiliAdminMutations.useSyncPosts({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: getI18nRuntime().i18n.t("admin:meili_posts_sync_started"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncPollsMutation = meiliAdminMutations.useSyncPolls({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: getI18nRuntime().i18n.t("admin:meili_polls_sync_started"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncRealmsMutation = meiliAdminMutations.useSyncRealms({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: getI18nRuntime().i18n.t("admin:meili_realms_sync_started"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncZonesMutation = meiliAdminMutations.useSyncZones({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: getI18nRuntime().i18n.t("admin:meili_zones_sync_started"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncTagsMutation = meiliAdminMutations.useSyncTags({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: getI18nRuntime().i18n.t("admin:meili_tags_sync_started"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncLabelsMutation = meiliAdminMutations.useSyncLabels({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: getI18nRuntime().i18n.t("admin:meili_labels_sync_started"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncEntitiesMutation = meiliAdminMutations.useSyncEntities({
    onSuccess: () => {
      setMessage({
        type: "success",
        text: getI18nRuntime().i18n.t("admin:meili_entities_sync_started"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllContentMutation = meiliAdminMutations.useDeleteAllContent({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_all_content_deleted"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllFeedbacksMutation = meiliAdminMutations.useDeleteAllFeedbacks({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_all_feedbacks_deleted"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllUsersMutation = meiliAdminMutations.useDeleteAllUsers({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_all_users_deleted"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllPostsMutation = meiliAdminMutations.useDeleteAllPosts({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_all_posts_deleted"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllPollsMutation = meiliAdminMutations.useDeleteAllPolls({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_all_polls_deleted"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllRealmsMutation = meiliAdminMutations.useDeleteAllRealms({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_all_realms_deleted"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllZonesMutation = meiliAdminMutations.useDeleteAllZones({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_all_zones_deleted"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllEntitiesMutation = meiliAdminMutations.useDeleteAllEntities({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_all_entities_deleted"),
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const resetAllIndexesMutation = meiliAdminMutations.useResetAllIndexes({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          getI18nRuntime().i18n.t("admin:meili_all_indexes_deleted"),
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
          ? getI18nRuntime().i18n.t("admin:meili_admin_key_created")
          : getI18nRuntime().i18n.t("admin:meili_admin_key_created_console"),
      });
      if (!keyString) console.log("Meili admin key response", res);
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteKeyMutation = meiliAdminMutations.useDeleteKey({
    onSuccess: async (res) => {
      setMessage({
        type: "success",
        text: res.message || getI18nRuntime().i18n.t("admin:meili_key_deleted"),
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
      label: getI18nRuntime().i18n.t("admin:meili_init_content_index"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_initializing"),
      isPending: initContentMutation.isPending,
      onClick: () => initContentMutation.mutate(),
    },
    {
      id: "feedbacks",
      label: getI18nRuntime().i18n.t("admin:meili_init_feedbacks_index"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_initializing"),
      isPending: initFeedbacksMutation.isPending,
      onClick: () => initFeedbacksMutation.mutate(),
    },
    {
      id: "users",
      label: getI18nRuntime().i18n.t("admin:meili_init_users_index"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_initializing"),
      isPending: initUsersMutation.isPending,
      onClick: () => initUsersMutation.mutate(),
    },
    {
      id: "posts",
      label: getI18nRuntime().i18n.t("admin:meili_init_posts_index"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_initializing"),
      isPending: initPostsMutation.isPending,
      onClick: () => initPostsMutation.mutate(),
    },
    {
      id: "polls",
      label: getI18nRuntime().i18n.t("admin:meili_init_polls_index"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_initializing"),
      isPending: initPollsMutation.isPending,
      onClick: () => initPollsMutation.mutate(),
    },
    {
      id: "realms",
      label: getI18nRuntime().i18n.t("admin:meili_init_realms_index"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_initializing"),
      isPending: initRealmsMutation.isPending,
      onClick: () => initRealmsMutation.mutate(),
    },
    {
      id: "zones",
      label: getI18nRuntime().i18n.t("admin:meili_init_zones_index"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_initializing"),
      isPending: initZonesMutation.isPending,
      onClick: () => initZonesMutation.mutate(),
    },
    {
      id: "tags",
      label: getI18nRuntime().i18n.t("admin:meili_init_tags_index"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_initializing"),
      isPending: initTagsMutation.isPending,
      onClick: () => initTagsMutation.mutate(),
    },
    {
      id: "labels",
      label: getI18nRuntime().i18n.t("admin:meili_init_labels_index"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_initializing"),
      isPending: initLabelsMutation.isPending,
      onClick: () => initLabelsMutation.mutate(),
    },
    {
      id: "entities",
      label: getI18nRuntime().i18n.t("admin:meili_init_entities_index"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_initializing"),
      isPending: initEntitiesMutation.isPending,
      onClick: () => initEntitiesMutation.mutate(),
    },
  ];

  const syncActions: MeiliAction[] = [
    {
      id: "content",
      label: getI18nRuntime().i18n.t("admin:meili_sync_all_content"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_syncing"),
      isPending: syncContentMutation.isPending,
      onClick: () => syncContentMutation.mutate(),
      variant: "outline",
    },
    {
      id: "feedbacks",
      label: getI18nRuntime().i18n.t("admin:meili_sync_all_feedbacks"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_syncing"),
      isPending: syncFeedbacksMutation.isPending,
      onClick: () => syncFeedbacksMutation.mutate(),
      variant: "outline",
    },
    {
      id: "users",
      label: getI18nRuntime().i18n.t("admin:meili_sync_all_users"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_syncing"),
      isPending: syncUsersMutation.isPending,
      onClick: () => syncUsersMutation.mutate(),
      variant: "outline",
    },
    {
      id: "posts",
      label: getI18nRuntime().i18n.t("admin:meili_sync_all_posts"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_syncing"),
      isPending: syncPostsMutation.isPending,
      onClick: () => syncPostsMutation.mutate(),
      variant: "outline",
    },
    {
      id: "polls",
      label: getI18nRuntime().i18n.t("admin:meili_sync_all_polls"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_syncing"),
      isPending: syncPollsMutation.isPending,
      onClick: () => syncPollsMutation.mutate(),
      variant: "outline",
    },
    {
      id: "realms",
      label: getI18nRuntime().i18n.t("admin:meili_sync_all_realms"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_syncing"),
      isPending: syncRealmsMutation.isPending,
      onClick: () => syncRealmsMutation.mutate(),
      variant: "outline",
    },
    {
      id: "zones",
      label: getI18nRuntime().i18n.t("admin:meili_sync_all_zones"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_syncing"),
      isPending: syncZonesMutation.isPending,
      onClick: () => syncZonesMutation.mutate(),
      variant: "outline",
    },
    {
      id: "tags",
      label: getI18nRuntime().i18n.t("admin:meili_sync_all_tags"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_syncing"),
      isPending: syncTagsMutation.isPending,
      onClick: () => syncTagsMutation.mutate(),
      variant: "outline",
    },
    {
      id: "labels",
      label: getI18nRuntime().i18n.t("admin:meili_sync_all_labels"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_syncing"),
      isPending: syncLabelsMutation.isPending,
      onClick: () => syncLabelsMutation.mutate(),
      variant: "outline",
    },
    {
      id: "entities",
      label: getI18nRuntime().i18n.t("admin:meili_sync_all_entities"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_syncing"),
      isPending: syncEntitiesMutation.isPending,
      onClick: () => syncEntitiesMutation.mutate(),
      variant: "outline",
    },
  ];

  const deleteActions: MeiliDangerAction[] = [
    {
      id: "content",
      label: getI18nRuntime().i18n.t("admin:meili_delete_all_content"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_deleting"),
      confirmLabel: getI18nRuntime().i18n.t(
        "admin:meili_delete_all_content_confirm",
      ),
      isPending: deleteAllContentMutation.isPending,
      onConfirm: () => deleteAllContentMutation.mutate(),
    },
    {
      id: "feedbacks",
      label: getI18nRuntime().i18n.t("admin:meili_delete_all_feedbacks"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_deleting"),
      confirmLabel: getI18nRuntime().i18n.t(
        "admin:meili_delete_all_feedbacks_confirm",
      ),
      isPending: deleteAllFeedbacksMutation.isPending,
      onConfirm: () => deleteAllFeedbacksMutation.mutate(),
    },
    {
      id: "users",
      label: getI18nRuntime().i18n.t("admin:meili_delete_all_users"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_deleting"),
      confirmLabel: getI18nRuntime().i18n.t(
        "admin:meili_delete_all_users_confirm",
      ),
      isPending: deleteAllUsersMutation.isPending,
      onConfirm: () => deleteAllUsersMutation.mutate(),
    },
    {
      id: "posts",
      label: getI18nRuntime().i18n.t("admin:meili_delete_all_posts"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_deleting"),
      confirmLabel: getI18nRuntime().i18n.t(
        "admin:meili_delete_all_posts_confirm",
      ),
      isPending: deleteAllPostsMutation.isPending,
      onConfirm: () => deleteAllPostsMutation.mutate(),
    },
    {
      id: "polls",
      label: getI18nRuntime().i18n.t("admin:meili_delete_all_polls"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_deleting"),
      confirmLabel: getI18nRuntime().i18n.t(
        "admin:meili_delete_all_polls_confirm",
      ),
      isPending: deleteAllPollsMutation.isPending,
      onConfirm: () => deleteAllPollsMutation.mutate(),
    },
    {
      id: "realms",
      label: getI18nRuntime().i18n.t("admin:meili_delete_all_realms"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_deleting"),
      confirmLabel: getI18nRuntime().i18n.t(
        "admin:meili_delete_all_realms_confirm",
      ),
      isPending: deleteAllRealmsMutation.isPending,
      onConfirm: () => deleteAllRealmsMutation.mutate(),
    },
    {
      id: "zones",
      label: getI18nRuntime().i18n.t("admin:meili_delete_all_zones"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_deleting"),
      confirmLabel: getI18nRuntime().i18n.t(
        "admin:meili_delete_all_zones_confirm",
      ),
      isPending: deleteAllZonesMutation.isPending,
      onConfirm: () => deleteAllZonesMutation.mutate(),
    },
    {
      id: "entities",
      label: getI18nRuntime().i18n.t("admin:meili_delete_all_entities"),
      pendingLabel: getI18nRuntime().i18n.t("admin:meili_deleting"),
      confirmLabel: getI18nRuntime().i18n.t(
        "admin:meili_delete_all_entities_confirm",
      ),
      isPending: deleteAllEntitiesMutation.isPending,
      onConfirm: () => deleteAllEntitiesMutation.mutate(),
    },
  ];

  return (
    <Page
      title={getI18nRuntime().i18n.t("admin:meili_title")}
      description={
        <div className="space-y-2">
          <p>{getI18nRuntime().i18n.t("admin:meili_description")}</p>
          {isHealthLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Spinner size="sm" />
              <span>
                {getI18nRuntime().i18n.t("admin:meili_checking_status")}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span>{getI18nRuntime().i18n.t("admin:meili_status_label")}</span>
              <Badge
                variant="outline"
                className={
                  health?.status === "available"
                    ? "border-border-whisper bg-surface-subtle text-success-text"
                    : "border-border-whisper bg-surface-subtle text-warning-text"
                }
              >
                {health?.status ?? getI18nRuntime().i18n.t("common:unknown")}
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
                aria-label={getI18nRuntime().i18n.t("common:dismiss")}
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
