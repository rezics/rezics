import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { useCreatePostMutation } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
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
  placeholder = "Start a discussion...",
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
      <TextField
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        multiline
        minRows={2}
        maxRows={6}
        variant="standard"
        fullWidth
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
