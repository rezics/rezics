import type { ContentRating } from "@rezics/contract";
import { RatingSelector } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import { useMessage } from "@rezics/i18n/react";
import {
  book_chapter_bulk_rating_description,
  book_chapter_bulk_rating_title,
  common_apply,
  common_cancel,
} from "@rezics/i18n/messages";
const m = {
  book_chapter_bulk_rating_description,
  book_chapter_bulk_rating_title,
  common_apply,
  common_cancel,
};

const i18nMessages = {
  book_chapter_bulk_rating_description,
  book_chapter_bulk_rating_title,
  common_apply,
  common_cancel,
};

interface BulkRatingDialogProps {
  open: boolean;
  onClose: () => void;
  count: number;
  value: ContentRating;
  onChange: (rating: ContentRating) => void;
  onConfirm: () => void;
}

export function BulkRatingDialog({
  open,
  onClose,
  count,
  value,
  onChange,
  onConfirm,
}: BulkRatingDialogProps) {
  const m = useMessage(i18nMessages);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{m.book_chapter_bulk_rating_title()}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-4">
          <p className="text-sm text-text-secondary">
            {m.book_chapter_bulk_rating_description({ count })}
          </p>
          <RatingSelector value={value} onChange={onChange} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button onClick={onConfirm} disabled={count === 0}>
            {m.common_apply()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
