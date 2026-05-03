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

function messageClass(type: "success" | "error" | "info") {
  switch (type) {
    case "success":
      return "text-rezics-color-success";
    case "error":
      return "text-rezics-color-danger";
    case "info":
    default:
      return "text-rezics-color-info";
  }
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
        text: res.message || "Content index initialized",
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initFeedbacksMutation = meiliAdminMutations.useInitFeedbacksIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || "Feedbacks index initialized",
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initUsersMutation = meiliAdminMutations.useInitUsersIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || "Users index initialized",
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initPostsMutation = meiliAdminMutations.useInitPostsIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || "Posts index initialized",
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const initRealmsMutation = meiliAdminMutations.useInitRealmsIndex({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || "Realms index initialized",
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  // Full sync
  const syncContentMutation = meiliAdminMutations.useSyncContent({
    onSuccess: () => {
      setMessage({ type: "success", text: "Content sync started" });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncFeedbacksMutation = meiliAdminMutations.useSyncFeedbacks({
    onSuccess: () => {
      setMessage({ type: "success", text: "Feedbacks sync started" });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncUsersMutation = meiliAdminMutations.useSyncUsers({
    onSuccess: () => {
      setMessage({ type: "success", text: "Users sync started" });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncPostsMutation = meiliAdminMutations.useSyncPosts({
    onSuccess: () => {
      setMessage({ type: "success", text: "Posts sync started" });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const syncRealmsMutation = meiliAdminMutations.useSyncRealms({
    onSuccess: () => {
      setMessage({ type: "success", text: "Realms sync started" });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  // Dangerous operations
  const deleteAllContentMutation = meiliAdminMutations.useDeleteAllContent({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || "All content deleted from Meili",
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllFeedbacksMutation = meiliAdminMutations.useDeleteAllFeedbacks({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || "All feedbacks deleted from Meili",
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllUsersMutation = meiliAdminMutations.useDeleteAllUsers({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || "All users deleted from Meili",
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllPostsMutation = meiliAdminMutations.useDeleteAllPosts({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || "All posts deleted from Meili",
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteAllRealmsMutation = meiliAdminMutations.useDeleteAllRealms({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || "All realms deleted from Meili",
      });
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const resetAllIndexesMutation = meiliAdminMutations.useResetAllIndexes({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text: res.message || "All indexes deleted. Run Init to recreate.",
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
          ? "Admin Key created"
          : "Admin Key created (see console for details)",
      });
      if (!keyString) console.log("Meili admin key response", res);
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const deleteKeyMutation = meiliAdminMutations.useDeleteKey({
    onSuccess: async (res) => {
      setMessage({
        type: "success",
        text: res.message || "Key deleted",
      });
      await refetchKeys();
    },
    onError: (err) => setMessage({ type: "error", text: err.message }),
  });

  const handleDeleteKey = (key: MeiliKey) => {
    if (!key.uid) return;
    const ok = window.confirm(
      `Delete Key: ${key.uid}${key.name ? ` (${key.name})` : ""}? This cannot be undone.`,
    );
    if (!ok) return;
    deleteKeyMutation.mutate(key.uid);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-8xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Meili Admin</h1>
          <p className="text-sm text-rezics-color-fg-muted">
            Root-only panel for index initialization, full sync, and Meilisearch
            API key management.
          </p>
          {isHealthLoading ? (
            <div className="flex items-center gap-2 text-sm text-rezics-color-fg-muted">
              <Spinner size="sm" />
              <span>Checking Meili status...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span>Meili status:</span>
              <Badge
                className={
                  health?.status === "available"
                    ? "bg-rezics-color-success text-white"
                    : "bg-rezics-color-warning text-white"
                }
              >
                {health?.status ?? "unknown"}
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
                aria-label="dismiss"
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
              <CardTitle>Index Initialization</CardTitle>
              <CardDescription>
                Run once when creating indexes or updating index settings.
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
                    ? "Initializing..."
                    : "Init Content Index"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => initFeedbacksMutation.mutate()}
                  disabled={initFeedbacksMutation.isPending}
                >
                  {initFeedbacksMutation.isPending
                    ? "Initializing..."
                    : "Init Feedbacks Index"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => initUsersMutation.mutate()}
                  disabled={initUsersMutation.isPending}
                >
                  {initUsersMutation.isPending
                    ? "Initializing..."
                    : "Init Users Index"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => initPostsMutation.mutate()}
                  disabled={initPostsMutation.isPending}
                >
                  {initPostsMutation.isPending
                    ? "Initializing..."
                    : "Init Posts Index"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => initRealmsMutation.mutate()}
                  disabled={initRealmsMutation.isPending}
                >
                  {initRealmsMutation.isPending
                    ? "Initializing..."
                    : "Init Realms Index"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Full sync */}
          <Card>
            <CardHeader>
              <CardTitle>Full Sync</CardTitle>
              <CardDescription>
                Re-sync all data from database to Meilisearch. Use after bulk
                imports or schema changes.
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
                    ? "Syncing..."
                    : "Sync All Content"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncFeedbacksMutation.mutate()}
                  disabled={syncFeedbacksMutation.isPending}
                >
                  {syncFeedbacksMutation.isPending
                    ? "Syncing..."
                    : "Sync All Feedbacks"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncUsersMutation.mutate()}
                  disabled={syncUsersMutation.isPending}
                >
                  {syncUsersMutation.isPending
                    ? "Syncing..."
                    : "Sync All Users"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncPostsMutation.mutate()}
                  disabled={syncPostsMutation.isPending}
                >
                  {syncPostsMutation.isPending
                    ? "Syncing..."
                    : "Sync All Posts"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncRealmsMutation.mutate()}
                  disabled={syncRealmsMutation.isPending}
                >
                  {syncRealmsMutation.isPending
                    ? "Syncing..."
                    : "Sync All Realms"}
                </Button>
              </div>
              <p className="text-xs text-rezics-color-fg-muted">
                Sync operations are async tasks. Check the backend or Meili
                dashboard for progress.
              </p>
            </CardContent>
          </Card>

          {/* Dangerous operations */}
          <Card>
            <CardHeader>
              <CardTitle>Dangerous Operations</CardTitle>
              <CardDescription>
                These operations directly affect search index data. Use with
                caution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-1">
                  Delete All Documents
                </p>
                <p className="text-xs text-rezics-color-fg-muted block mb-2">
                  Removes all documents from an index but keeps index settings
                  intact. You can re-sync afterward.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-rezics-color-danger text-white"
                    onClick={() => {
                      const ok = window.confirm(
                        "Delete all content from Meili? This will clear search results and cannot be undone!",
                      );
                      if (!ok) return;
                      deleteAllContentMutation.mutate();
                    }}
                    disabled={deleteAllContentMutation.isPending}
                  >
                    {deleteAllContentMutation.isPending
                      ? "Deleting..."
                      : "Delete All Content"}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-rezics-color-danger text-white"
                    onClick={() => {
                      const ok = window.confirm(
                        "Delete all feedbacks from Meili? This cannot be undone!",
                      );
                      if (!ok) return;
                      deleteAllFeedbacksMutation.mutate();
                    }}
                    disabled={deleteAllFeedbacksMutation.isPending}
                  >
                    {deleteAllFeedbacksMutation.isPending
                      ? "Deleting..."
                      : "Delete All Feedbacks"}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-rezics-color-danger text-white"
                    onClick={() => {
                      const ok = window.confirm(
                        "Delete all users from Meili? This cannot be undone!",
                      );
                      if (!ok) return;
                      deleteAllUsersMutation.mutate();
                    }}
                    disabled={deleteAllUsersMutation.isPending}
                  >
                    {deleteAllUsersMutation.isPending
                      ? "Deleting..."
                      : "Delete All Users"}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-rezics-color-danger text-white"
                    onClick={() => {
                      const ok = window.confirm(
                        "Delete all posts from Meili? This cannot be undone!",
                      );
                      if (!ok) return;
                      deleteAllPostsMutation.mutate();
                    }}
                    disabled={deleteAllPostsMutation.isPending}
                  >
                    {deleteAllPostsMutation.isPending
                      ? "Deleting..."
                      : "Delete All Posts"}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-rezics-color-danger text-white"
                    onClick={() => {
                      const ok = window.confirm(
                        "Delete all realms from Meili? This cannot be undone!",
                      );
                      if (!ok) return;
                      deleteAllRealmsMutation.mutate();
                    }}
                    disabled={deleteAllRealmsMutation.isPending}
                  >
                    {deleteAllRealmsMutation.isPending
                      ? "Deleting..."
                      : "Delete All Realms"}
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-semibold mb-1 text-rezics-color-danger">
                  Reset Everything
                </p>
                <p className="text-xs text-rezics-color-fg-muted block mb-2">
                  Deletes all indexes entirely (content, feedbacks, users,
                  posts, realms). All settings and documents are lost. You must
                  re-run Init to recreate indexes.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-rezics-color-danger"
                  onClick={() => setResetDialogOpen(true)}
                  disabled={resetAllIndexesMutation.isPending}
                >
                  {resetAllIndexesMutation.isPending
                    ? "Resetting..."
                    : "Reset Everything"}
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
                <DialogTitle>Reset Everything?</DialogTitle>
                <DialogDescription>
                  This will permanently delete all Meilisearch indexes (content,
                  feedbacks, users, posts, realms) including their settings and
                  documents. You will need to re-run Init to recreate them.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2">
                <p className="text-sm mb-2">
                  Type <strong>RESET</strong> to confirm.
                </p>
                <Input
                  autoFocus
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET"
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
                  Cancel
                </Button>
                <Button
                  className="bg-rezics-color-danger text-white"
                  disabled={resetConfirmText !== "RESET"}
                  onClick={() => {
                    resetAllIndexesMutation.mutate();
                    setResetDialogOpen(false);
                    setResetConfirmText("");
                  }}
                >
                  Delete All Indexes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Key management */}
        <Card>
          <CardHeader>
            <CardTitle>Meili API Key Management</CardTitle>
            <CardDescription>
              Create admin keys and manage existing keys.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-rezics-color-warning"
                onClick={() => createAdminKeyMutation.mutate()}
                disabled={createAdminKeyMutation.isPending}
              >
                {createAdminKeyMutation.isPending
                  ? "Creating..."
                  : "Create Admin Key"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchKeys()}
                disabled={isKeysLoading}
              >
                Refresh Key List
              </Button>
            </div>

            {lastAdminKey && (
              <div className="text-xs break-all space-y-1">
                <div className="font-semibold text-rezics-color-warning">
                  Latest Admin Key (store securely):
                </div>
                <code className="px-2 py-1 rounded bg-rezics-color-bg-elevated">
                  {lastAdminKey}
                </code>
              </div>
            )}

            <div className="border-t border-rezics-color-border pt-3">
              <p className="text-sm font-semibold mb-2">Existing Keys</p>
              {isKeysLoading ? (
                <div className="flex items-center gap-2 text-sm text-rezics-color-fg-muted">
                  <Spinner size="sm" />
                  <span>Loading keys...</span>
                </div>
              ) : !keyList || keyList.results.length === 0 ? (
                <p className="text-sm text-rezics-color-fg-muted">
                  No Meili API keys found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-rezics-color-border text-rezics-color-fg-muted">
                      <tr>
                        <th className="py-1 pr-3">UID</th>
                        <th className="py-1 pr-3">Name</th>
                        <th className="py-1 pr-3">Actions</th>
                        <th className="py-1 pr-3">Indexes</th>
                        <th className="py-1 pr-3">Expires</th>
                        <th className="py-1 pr-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keyList.results.map((key) => (
                        <tr
                          key={key.uid}
                          className="border-b border-rezics-color-border"
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
                            {key.expiresAt || "Never"}
                          </td>
                          <td className="py-1 pr-3 align-top">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rezics-color-danger"
                              onClick={() => handleDeleteKey(key)}
                              disabled={deleteKeyMutation.isPending}
                            >
                              Delete
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
