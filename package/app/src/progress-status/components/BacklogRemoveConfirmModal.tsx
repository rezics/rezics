import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  const handleConfirm = async () => {
    await onConfirm();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("progress_status.remove_backlog_modal.title", "移除想讀？")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "progress_status.remove_backlog_modal.description",
              "確認後會隱藏這筆閱讀狀態，並從想讀書架移除這本書。之後重新標記狀態時，原本的進度資料會被保留並恢復。",
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isPending}
          >
            {t("common.cancel", "取消")}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            {t("progress_status.remove_backlog_modal.confirm", "移除想讀")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
