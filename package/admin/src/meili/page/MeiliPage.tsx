import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  TextField,
  Typography,
} from "@mui/material";
import {
  type MeiliKey,
  meiliAdminMutations,
  meiliAdminQueries,
} from "@rezics/api/meili/meili.admin.queries";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type MessageState = {
  type: "success" | "error" | "info";
  text: string;
} | null;

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

  const deleteAllFeedbacksMutation =
    meiliAdminMutations.useDeleteAllFeedbacks({
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

  const resetAllIndexesMutation = meiliAdminMutations.useResetAllIndexes({
    onSuccess: (res) => {
      setMessage({
        type: "success",
        text:
          res.message ||
          "All indexes deleted. Run Init to recreate.",
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
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-2">
          <Typography variant="h4" component="h1">
            Meili Admin
          </Typography>
          <Typography
            variant="body2"
            className="text-slate-600 dark:text-slate-300"
          >
            Root-only panel for index initialization, full sync, and Meilisearch
            API key management.
          </Typography>
          {isHealthLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <CircularProgress size={18} />
              <span>Checking Meili status...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span>Meili status:</span>
              <Chip
                label={health?.status ?? "unknown"}
                color={health?.status === "available" ? "success" : "warning"}
                size="small"
              />
            </div>
          )}
        </div>

        {message && (
          <Alert
            severity={message.type}
            onClose={() => setMessage(null)}
            className="shadow-sm"
          >
            {message.text}
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          {/* Index initialization */}
          <Card>
            <CardHeader
              title="Index Initialization"
              subheader="Run once when creating indexes or updating index settings."
            />
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => initContentMutation.mutate()}
                  disabled={initContentMutation.isPending}
                >
                  {initContentMutation.isPending
                    ? "Initializing..."
                    : "Init Content Index"}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => initFeedbacksMutation.mutate()}
                  disabled={initFeedbacksMutation.isPending}
                >
                  {initFeedbacksMutation.isPending
                    ? "Initializing..."
                    : "Init Feedbacks Index"}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => initUsersMutation.mutate()}
                  disabled={initUsersMutation.isPending}
                >
                  {initUsersMutation.isPending
                    ? "Initializing..."
                    : "Init Users Index"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Full sync */}
          <Card>
            <CardHeader
              title="Full Sync"
              subheader="Re-sync all data from database to Meilisearch. Use after bulk imports or schema changes."
            />
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => syncContentMutation.mutate()}
                  disabled={syncContentMutation.isPending}
                >
                  {syncContentMutation.isPending
                    ? "Syncing..."
                    : "Sync All Content"}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => syncFeedbacksMutation.mutate()}
                  disabled={syncFeedbacksMutation.isPending}
                >
                  {syncFeedbacksMutation.isPending
                    ? "Syncing..."
                    : "Sync All Feedbacks"}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => syncUsersMutation.mutate()}
                  disabled={syncUsersMutation.isPending}
                >
                  {syncUsersMutation.isPending
                    ? "Syncing..."
                    : "Sync All Users"}
                </Button>
              </div>
              <Typography variant="caption" color="text.secondary">
                Sync operations are async tasks. Check the backend or Meili
                dashboard for progress.
              </Typography>
            </CardContent>
          </Card>

          {/* Dangerous operations */}
          <Card>
            <CardHeader
              title="Dangerous Operations"
              subheader="These operations directly affect search index data. Use with caution."
            />
            <CardContent className="space-y-4">
              <div>
                <Typography variant="subtitle2" className="mb-1">
                  Delete All Documents
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  className="block mb-2"
                >
                  Removes all documents from an index but keeps index settings
                  intact. You can re-sync afterward.
                </Typography>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
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
                    variant="contained"
                    color="error"
                    size="small"
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
                    variant="contained"
                    color="error"
                    size="small"
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
                </div>
              </div>

              <Divider />

              <div>
                <Typography variant="subtitle2" color="error" className="mb-1">
                  Reset Everything
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  className="block mb-2"
                >
                  Deletes all three indexes entirely (content, feedbacks,
                  users). All settings and documents are lost. You must re-run
                  Init to recreate indexes.
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
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
            onClose={() => {
              setResetDialogOpen(false);
              setResetConfirmText("");
            }}
          >
            <DialogTitle>Reset Everything?</DialogTitle>
            <DialogContent>
              <DialogContentText>
                This will permanently delete all three Meilisearch indexes
                (content, feedbacks, users) including their settings and
                documents. You will need to re-run Init to recreate them.
              </DialogContentText>
              <DialogContentText sx={{ mt: 2 }}>
                Type <strong>RESET</strong> to confirm.
              </DialogContentText>
              <TextField
                autoFocus
                fullWidth
                margin="dense"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESET"
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setResetDialogOpen(false);
                  setResetConfirmText("");
                }}
              >
                Cancel
              </Button>
              <Button
                color="error"
                variant="contained"
                disabled={resetConfirmText !== "RESET"}
                onClick={() => {
                  resetAllIndexesMutation.mutate();
                  setResetDialogOpen(false);
                  setResetConfirmText("");
                }}
              >
                Delete All Indexes
              </Button>
            </DialogActions>
          </Dialog>
        </div>

        {/* Key management */}
        <Card>
          <CardHeader
            title="Meili API Key Management"
            subheader="Create admin keys and manage existing keys."
          />
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outlined"
                size="small"
                color="warning"
                onClick={() => createAdminKeyMutation.mutate()}
                disabled={createAdminKeyMutation.isPending}
              >
                {createAdminKeyMutation.isPending
                  ? "Creating..."
                  : "Create Admin Key"}
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => refetchKeys()}
                disabled={isKeysLoading}
              >
                Refresh Key List
              </Button>
            </div>

            {lastAdminKey && (
              <div className="text-xs break-all space-y-1">
                <div className="font-semibold text-amber-700">
                  Latest Admin Key (store securely):
                </div>
                <code className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                  {lastAdminKey}
                </code>
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              <Typography variant="subtitle2" className="mb-2">
                Existing Keys
              </Typography>
              {isKeysLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CircularProgress size={18} />
                  <span>Loading keys...</span>
                </div>
              ) : !keyList || keyList.results.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No Meili API keys found.
                </Typography>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
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
                          className="border-b border-slate-100 dark:border-slate-800"
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
                              variant="text"
                              color="error"
                              size="small"
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
