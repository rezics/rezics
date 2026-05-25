import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import { useMessage } from "@rezics/i18n/react";
import { common_cancel, shelf_move_to_page_title } from "@rezics/i18n/messages";
const i18nMessages = {
  common_cancel,
  shelf_move_to_page_title,
};

interface CrossPageMoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageCount: number;
  currentPage?: number;
  onPick: (toPage: number) => void;
}

export function CrossPageMoveModal({
  open,
  onOpenChange,
  pageCount,
  currentPage,
  onPick,
}: CrossPageMoveModalProps) {
  const m = useMessage(i18nMessages);
  const pages = Array.from({ length: Math.max(pageCount, 1) }, (_, i) => i + 1);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.shelf_move_to_page_title()}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-5 gap-2 py-2">
          {pages.map((p) => (
            <Button
              key={p}
              variant={p === currentPage ? "secondary" : "outline"}
              size="sm"
              onClick={() => onPick(p)}
              disabled={p === currentPage}
            >
              {p}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {m.common_cancel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
