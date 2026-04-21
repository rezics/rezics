import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import type { ContentRating } from "@rezics/contract";
import { RatingSelector } from "@rezics/ui";
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {t("book.chapter.bulk_rating.title", "Set rating for selected")}
      </DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}
      >
        <DialogContentText>
          {t("book.chapter.bulk_rating.description", {
            defaultValue: "This will override the rating on {{count}} selected chapters.",
            count,
          })}
        </DialogContentText>
        <RatingSelector value={value} onChange={onChange} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t("common.cancel", "Cancel")}</Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={count === 0}
        >
          {t("common.apply", "Apply")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
