import { Box, Button, Stack, TextField } from "@mui/material";
import { useCreatePostMutation } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import type React from "react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

export type ReplyComposerMode = "progressive" | "expanded";

export type ReplyComposerHandle = {
  focus: () => void;
};

export interface ReplyComposerProps {
  mode: ReplyComposerMode;
  targetUnitId: string;
  parentPostUnitId?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitted?: () => void;
  onCancelled?: () => void;
}

/**
 * Blur-retain rule: if the body is empty, the composer should collapse on
 * blur; otherwise it retains the draft and stays expanded. Returning a
 * boolean here keeps the caller in charge of the actual open/closed state.
 */
export function useBlurRetain(body: string) {
  return useCallback(() => body.trim().length > 0, [body]);
}

export const ReplyComposer = forwardRef<ReplyComposerHandle, ReplyComposerProps>(
  function ReplyComposer(
    {
      mode,
      targetUnitId,
      parentPostUnitId,
      placeholder = "Add a reply…",
      autoFocus = false,
      onSubmitted,
      onCancelled,
    },
    ref,
  ) {
    const startsExpanded = mode === "expanded" || autoFocus;
    const [expanded, setExpanded] = useState<boolean>(startsExpanded);
    const [body, setBody] = useState("");
    const triggerRef = useRef<HTMLDivElement>(null);
    const shouldRetainOnBlur = useBlurRetain(body);
    const mutation = useCreatePostMutation();

    const resize = useMemo(
      () => ({ height: 150, minHeight: 100, maxHeight: 400 }),
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          setExpanded(true);
          // defer focus until editor mounts
          queueMicrotask(() => {
            const el =
              triggerRef.current?.querySelector<HTMLTextAreaElement>(
                "textarea, [contenteditable='true']",
              );
            el?.focus();
          });
        },
      }),
      [],
    );

    const reset = () => {
      setBody("");
      if (mode === "progressive") setExpanded(false);
    };

    const handleSubmit = () => {
      const trimmed = body.trim();
      if (!trimmed) return;
      mutation.mutate(
        {
          targetUnitId,
          parentPostUnitId,
          kind: PostKind.POST,
          body: trimmed,
        },
        {
          onSuccess: () => {
            reset();
            onSubmitted?.();
          },
        },
      );
    };

    const handleCancel = () => {
      if (shouldRetainOnBlur()) return;
      reset();
      onCancelled?.();
    };

    const handleProgressiveFocus = () => {
      setExpanded(true);
    };

    if (mode === "progressive" && !expanded) {
      return (
        <Box ref={triggerRef} onClick={(e) => e.stopPropagation()}>
          <TextField
            fullWidth
            size="small"
            placeholder={placeholder}
            onFocus={handleProgressiveFocus}
            onClick={handleProgressiveFocus}
            variant="outlined"
          />
        </Box>
      );
    }

    return (
      <Box
        ref={triggerRef}
        onClick={(e) => e.stopPropagation()}
        sx={{ display: "flex", flexDirection: "column", gap: 1 }}
      >
        <RezicsMarkdownEditor
          value={body}
          onChange={setBody}
          resize={resize}
        />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button
            size="small"
            onClick={handleCancel}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            disableElevation
            onClick={handleSubmit}
            disabled={mutation.isPending || !body.trim()}
          >
            {mutation.isPending ? "Posting…" : "Reply"}
          </Button>
        </Stack>
      </Box>
    );
  },
);
