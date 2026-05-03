import type React from "react";
import { Button } from "@/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/dialog";

export const ConfirmDeleteDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
}> = ({ open, onClose, onSubmit }) => {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="min-w-[20rem]">
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-rezics-fg-muted">删除后将无法恢复</p>
        <Button className="w-full mt-4" onClick={onSubmit}>
          删除
        </Button>
      </DialogContent>
    </Dialog>
  );
};
