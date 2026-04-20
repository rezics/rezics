import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Rating from "@mui/material/Rating";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import { useCreatePostMutation } from "@rezics/api/post/post";
import { useUpsertScoreMutation } from "@rezics/api/score/score";
import { PostKind, SCORE_MAX } from "@rezics/contract";
import type React from "react";
import { useState } from "react";

interface RemarkInlineFormProps {
  bookUnitId: string;
  realmId?: string;
  onSuccess?: () => void;
}

export const RemarkInlineForm: React.FC<RemarkInlineFormProps> = ({
  bookUnitId,
  realmId = getDefaultRealmId() ?? "default",
  onSuccess,
}) => {
  const [score, setScore] = useState<number | null>(null);
  const [text, setText] = useState("");

  const scoreMutation = useUpsertScoreMutation();
  const postMutation = useCreatePostMutation();

  const isPending = scoreMutation.isPending || postMutation.isPending;

  const handleSubmit = async () => {
    if (!text.trim()) return;

    let scoreEntryId: string | undefined;

    if (score !== null) {
      const scoreEntry = await scoreMutation.mutateAsync({
        unitId: bookUnitId,
        realm: realmId,
        value: score,
      });
      scoreEntryId = scoreEntry.id;
    }

    await postMutation.mutateAsync({
      targetUnitId: bookUnitId,
      kind: PostKind.REMARK,
      body: text.trim(),
      scoreEntryId,
    });

    setText("");
    setScore(null);
    onSuccess?.();
  };

  return (
    <Box>
      <Stack spacing={2}>
        <Rating
          max={SCORE_MAX}
          precision={1}
          value={score}
          onChange={(_, v) => setScore(v)}
        />
        <TextField
          placeholder="Write a short remark..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          multiline
          minRows={2}
          maxRows={6}
          variant="standard"
          fullWidth
        />
        <Box display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            disableElevation
            size="small"
            onClick={handleSubmit}
            disabled={isPending || !text.trim()}
          >
            {isPending ? "Submitting..." : "Submit Remark"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
};
