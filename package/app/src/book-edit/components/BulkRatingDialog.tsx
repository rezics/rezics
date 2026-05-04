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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>
            {t("book.chapter.bulk_rating.title", "Set rating for selected")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-4">
          <p className="text-sm text-text-secondary">
            {t("book.chapter.bulk_rating.description", {
              defaultValue:
                "This will override the rating on {{count}} selected chapters.",
              count,
            })}
          </p>
          <RatingSelector value={value} onChange={onChange} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={count === 0}>
            {t("common.apply", "Apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
