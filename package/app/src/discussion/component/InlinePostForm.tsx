import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useCreatePostMutation } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import type React from "react";
import { useState } from "react";

interface InlinePostFormProps {
  targetUnitId: string;
  parentPostUnitId?: string;
  placeholder?: string;
  onSuccess?: () => void;
}

export const InlinePostForm: React.FC<InlinePostFormProps> = ({
  targetUnitId,
  parentPostUnitId,
  onSuccess,
}) => {
  const [text, setText] = useState("");
  const mutation = useCreatePostMutation();

  const handleSubmit = () => {
    if (!text.trim()) return;
    mutation.mutate(
      {
        targetUnitId,
        parentPostUnitId,
        kind: PostKind.POST,
        body: text.trim(),
      },
      {
        onSuccess: () => {
          setText("");
          onSuccess?.();
        },
      },
    );
  };

  return (
    <Box>
      <RezicsMarkdownEditor
        value={text}
        onChange={setText}
        preview={false}
        resize={{ height: 150, minHeight: 100, maxHeight: 400 }}
      />
      <Box display="flex" justifyContent="flex-end" mt={1}>
        <Button
          variant="contained"
          disableElevation
          size="small"
          onClick={handleSubmit}
          disabled={mutation.isPending || !text.trim()}
        >
          {mutation.isPending ? "Posting..." : "Post"}
        </Button>
      </Box>
    </Box>
  );
};
