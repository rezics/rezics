import type { ContentRating } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { RatingSelector } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";

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
  const { t } = useTranslation(["book", "common"]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{t("book:chapter_bulk_rating_title")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-4">
          <p className="text-sm text-text-secondary">
            {t("book:chapter_bulk_rating_description", { count })}
          </p>
          <RatingSelector value={value} onChange={onChange} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common:cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={count === 0}>
            {t("common:apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
