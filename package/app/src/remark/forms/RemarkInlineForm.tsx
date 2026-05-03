import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import { useCreatePostMutation } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface RemarkInlineFormProps {
  bookUnitId: string;
  onSuccess?: () => void;
}

export const RemarkInlineForm: React.FC<RemarkInlineFormProps> = ({
  bookUnitId,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const postMutation = useCreatePostMutation();

  const resize = useMemo(
    () => ({ height: 220, minHeight: 150, maxHeight: 600 }),
    [],
  );

  const reset = useCallback(() => {
    setBody("");
    setExpanded(false);
  }, []);

  const handleSubmit = () => {
    const trimmed = body.trim();
    if (!trimmed || postMutation.isPending) return;
    postMutation.mutate(
      {
        targetUnitId: bookUnitId,
        kind: PostKind.REMARK,
        body: trimmed,
      },
      {
        onSuccess: () => {
          reset();
          onSuccess?.();
        },
      },
    );
  };

  const handleCancel = () => {
    if (body.trim().length > 0) return;
    reset();
  };

  const handleExpand = () => {
    setExpanded(true);
    queueMicrotask(() => {
      const el = wrapperRef.current?.querySelector<HTMLElement>(
        "textarea, [contenteditable='true']",
      );
      el?.focus();
    });
  };

  if (!expanded) {
    return (
      <Box ref={wrapperRef}>
        <TextField
          fullWidth
          size="small"
          placeholder={t("remark.compose_placeholder", "寫下你的短評…")}
          onFocus={handleExpand}
          onClick={handleExpand}
          variant="outlined"
        />
      </Box>
    );
  }

  return (
    <Box ref={wrapperRef} sx={{ display: "flex", flexDirection: "column" }}>
      <RezicsMarkdownEditor
        value={body}
        onChange={setBody}
        resize={resize}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        submitLabel={
          postMutation.isPending
            ? t("common.submitting", "Submitting…")
            : t("remark.submit", "Submit Remark")
        }
      />
    </Box>
  );
};
