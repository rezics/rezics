import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";

type BacklogRemoveConfirmModalProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  isPending?: boolean;
};

export function BacklogRemoveConfirmModal({
  open,
  onCancel,
  onConfirm,
  isPending,
}: BacklogRemoveConfirmModalProps) {
  const { t } = useTranslation(["common", "community"]);
  const handleConfirm = async () => {
    await onConfirm();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("community:progress_status_remove_backlog_modal_title")}
          </DialogTitle>
          <DialogDescription>
            {t("community:progress_status_remove_backlog_modal_description")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isPending}
          >
            {t("common:cancel")}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            {t("community:progress_status_remove_backlog_modal_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
