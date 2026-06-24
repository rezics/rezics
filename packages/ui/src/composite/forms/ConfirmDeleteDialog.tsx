import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { Button } from "#/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/shadcn/dialog";

export const ConfirmDeleteDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
}> = ({ open, onClose, onSubmit }) => {
  const { t } = useTranslation("common");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="min-w-[20rem]">
        <DialogHeader>
          <DialogTitle>{t("confirm_delete")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-rezics-fg-muted">
          {t("delete_irreversible")}
        </p>
        <Button className="w-full mt-4" onClick={onSubmit}>
          {t("delete")}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
