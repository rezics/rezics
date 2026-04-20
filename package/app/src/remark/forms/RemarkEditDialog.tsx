import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Rating,
  Stack,
  TextField,
} from "@mui/material";
import { useUpdatePostMutation } from "@rezics/api/post/post";
import { type PostDTO, SCORE_MAX } from "@rezics/contract";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface RemarkEditDialogProps {
  remark: PostDTO;
  open: boolean;
  onClose: () => void;
}

export const RemarkEditDialog: React.FC<RemarkEditDialogProps> = ({
  remark,
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const initialRating = (remark.extra as { rating?: number } | null)?.rating;
  const [score, setScore] = useState<number | null>(
    typeof initialRating === "number" ? initialRating : null,
  );
  const [text, setText] = useState(remark.body ?? "");

  const updateMutation = useUpdatePostMutation({
    onSuccess: () => {
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!text.trim()) return;
    const nextExtra = {
      ...(remark.extra ?? {}),
      ...(score !== null ? { rating: score } : {}),
    };
    updateMutation.mutate({
      unitId: remark.unitId,
      input: {
        body: text.trim(),
        extra: nextExtra,
      },
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("common.edit")}</DialogTitle>
      <DialogContent>
        <Box pt={1}>
          <Stack spacing={2}>
            <Rating
              max={SCORE_MAX}
              precision={1}
              value={score}
              onChange={(_, v) => setScore(v)}
            />
            <TextField
              value={text}
              onChange={(e) => setText(e.target.value)}
              multiline
              minRows={3}
              maxRows={10}
              variant="standard"
              fullWidth
            />
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel", "Cancel")}</Button>
        <Button
          variant="contained"
          disableElevation
          onClick={handleSubmit}
          disabled={updateMutation.isPending || !text.trim()}
        >
          {updateMutation.isPending
            ? t("common.saving", "Saving…")
            : t("common.save", "Save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
