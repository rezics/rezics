import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import type { ContentRating } from "@rezics/contract";
import { RatingSelector } from "@rezics/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Chapter } from "./ChapterTreeEditor";

// MOCK: publish statuses — replace with contract enum when backend is ready
const PUBLISH_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type PublishStatus = (typeof PUBLISH_STATUSES)[number];

interface EditChapterDialogProps {
  open: boolean;
  onClose: () => void;
  chapter: Chapter | null;
  onSave: (update: {
    title: string;
    status: PublishStatus;
    rating: ContentRating;
  }) => void;
}

export function EditChapterDialog({
  open,
  onClose,
  chapter,
  onSave,
}: EditChapterDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [rating, setRating] = useState<ContentRating>("GENERAL");

  useEffect(() => {
    if (open && chapter) {
      setTitle(chapter.title);
      // Mock: read status from chapter metadata if available, default DRAFT
      setStatus((chapter as any).status ?? "DRAFT");
      setRating(chapter.rating ?? "GENERAL");
    }
  }, [open, chapter]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), status, rating });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {t("book.chapter.edit_dialog.title", "Edit Chapter")}
      </DialogTitle>
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
          pt: "16px !important",
        }}
      >
        <TextField
          label={t("book.fields.title", "Title")}
          fullWidth
          variant="filled"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={!title.trim()}
          autoFocus
        />
        <FormControl fullWidth variant="filled">
          <InputLabel>
            {t("book.chapter.edit_dialog.status", "Publish Status")}
          </InputLabel>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as PublishStatus)}
          >
            {PUBLISH_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`book.chapter.status.${s.toLowerCase()}`, s)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <RatingSelector value={rating} onChange={setRating} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t("common.cancel", "Cancel")}</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!title.trim()}
        >
          {t("common.save", "Save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
