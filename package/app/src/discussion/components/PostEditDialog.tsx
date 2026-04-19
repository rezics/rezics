import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useUpdatePostMutation } from "@rezics/api/post/post";
import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface PostEditDialogProps {
  post: PostDTO;
  open: boolean;
  onClose: () => void;
}

export const PostEditDialog: React.FC<PostEditDialogProps> = ({
  post,
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState(post.body ?? "");

  const updateMutation = useUpdatePostMutation({
    onSuccess: () => {
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!text.trim()) return;
    updateMutation.mutate({
      unitId: post.unitId,
      input: { body: text.trim() },
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("common.edit")}</DialogTitle>
      <DialogContent>
        <Box pt={1}>
          <TextField
            value={text}
            onChange={(e) => setText(e.target.value)}
            multiline
            minRows={4}
            maxRows={16}
            variant="outlined"
            fullWidth
          />
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
