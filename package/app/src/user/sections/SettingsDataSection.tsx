import { useSignOutMutation } from "@rezics/api/auth/auth.mutations";
import {
  useDeleteAccountMutation,
  useExportDataMutation,
} from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { type FC, useState } from "react";
import { DangerZone } from "@/user/components/DangerZone";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

export const SettingsDataSection: FC = () => {
  const { t } = useTranslation(["common", "settings"]);
  useRequireAuth();

  const { data: user } = useQuery(userQueries.me());
  const exportData = useExportDataMutation();
  const deleteAccount = useDeleteAccountMutation();
  const signOut = useSignOutMutation();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  const handleExport = () => {
    exportData.mutate(undefined, {
      onSuccess: (payload) => {
        // Download the assembled payload as a JSON file in the browser.
        // 在浏览器中将组装好的 payload 作为 JSON 文件下载。
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "rezics-data-export.json";
        anchor.click();
        URL.revokeObjectURL(url);
      },
    });
  };

  const handleDelete = () => {
    deleteAccount.mutate(
      { confirmation: confirm.trim() },
      {
        onSuccess: () => {
          signOut.mutate();
          window.location.href = "/";
        },
      },
    );
  };

  const handle = user?.slug ?? "";
  const confirmMatches = confirm.trim() === handle && handle.length > 0;

  return (
    <div>
      <SettingsSection
        title={t("settings:data_export_title")}
        description={t("settings:data_export_description")}
      >
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleExport}
          disabled={exportData.isPending}
        >
          {exportData.isPending ? (
            <Spinner size="sm" />
          ) : (
            <DownloadIcon className="w-4 h-4" />
          )}
          {exportData.isPending
            ? t("settings:data_exporting")
            : t("settings:data_export_button")}
        </Button>
        {exportData.isSuccess && (
          <Alert className="mt-3 text-success-text" aria-live="polite">
            <AlertDescription>
              {t("settings:data_export_ready")}
            </AlertDescription>
          </Alert>
        )}
        {exportData.error && (
          <Alert variant="destructive" className="mt-3" aria-live="assertive">
            <AlertDescription>{exportData.error.message}</AlertDescription>
          </Alert>
        )}
      </SettingsSection>

      <DangerZone
        title={t("settings:data_delete_title")}
        description={t("settings:data_delete_description")}
      >
        <p className="text-sm text-text-secondary mb-4">
          {t("settings:data_delete_data_handling")}
        </p>
        <Button
          variant="outline"
          className="text-error-text"
          onClick={() => setDeleteOpen(true)}
        >
          {t("settings:data_delete_button")}
        </Button>

        <Dialog
          open={deleteOpen}
          onOpenChange={(o) => !o && setDeleteOpen(false)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("settings:data_delete_title")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm mb-2">{t("settings:data_delete_warning")}</p>
            <p className="text-sm mb-4">
              {t("settings:data_delete_confirm_prefix")}{" "}
              <strong>{handle}</strong>{" "}
              {t("settings:data_delete_confirm_suffix")}
            </p>
            <Input
              placeholder={handle}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoFocus
            />
            {deleteAccount.error && (
              <Alert
                variant="destructive"
                className="mt-2"
                aria-live="assertive"
              >
                <AlertDescription>
                  {deleteAccount.error.message}
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
                {t("common:cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={!confirmMatches || deleteAccount.isPending}
                onClick={handleDelete}
              >
                {deleteAccount.isPending
                  ? t("settings:data_deleting")
                  : t("settings:data_delete_button")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DangerZone>
    </div>
  );
};
