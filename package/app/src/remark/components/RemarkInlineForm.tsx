import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import { useCreatePostMutation } from "@rezics/api/post/post";
import { useUpsertScoreMutation } from "@rezics/api/score/score";
import { PostKind } from "@rezics/contract";
import type React from "react";
import { useState } from "react";
import { ScoreInput } from "@/engagement/components/ScoreInput";

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
        <ScoreInput value={score} onChange={setScore} />
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
