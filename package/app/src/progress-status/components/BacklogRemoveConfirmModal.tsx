import {
  common_cancel,
  progress_status_remove_backlog_modal_confirm,
  progress_status_remove_backlog_modal_description,
  progress_status_remove_backlog_modal_title,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";

const i18nMessages = {
  common_cancel,
  progress_status_remove_backlog_modal_confirm,
  progress_status_remove_backlog_modal_description,
  progress_status_remove_backlog_modal_title,
};

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
  const m = useMessage(i18nMessages);
  const handleConfirm = async () => {
    await onConfirm();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {m.progress_status_remove_backlog_modal_title()}
          </DialogTitle>
          <DialogDescription>
            {m.progress_status_remove_backlog_modal_description()}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isPending}
          >
            {m.common_cancel()}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            {m.progress_status_remove_backlog_modal_confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
