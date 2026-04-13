import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { shelfDetailQuery } from "@rezics/api/shelf";
import { useUpdateShelfMutation } from "@rezics/api/shelf/shelf.mutations";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getTranslation } from "@/shared/util/translation-helpers";

interface ShelfEditPageProps {
  shelfId: string;
}

export function ShelfEditPage({ shelfId }: ShelfEditPageProps) {
  const navigate = useNavigate();
  const { data: shelf, isLoading } = useQuery(shelfDetailQuery(shelfId));
  const updateMutation = useUpdateShelfMutation();

  const translation = shelf ? getTranslation(shelf.translations) : null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (translation) {
      setTitle(translation.title ?? "");
      setDescription(translation.description ?? "");
    }
  }, [translation]);

  const handleSave = () => {
    updateMutation.mutate(
      {
        unitId: shelfId,
        input: {
          translations: [
            {
              language: translation?.language ?? "zh-CN",
              title,
              description,
            },
          ],
        },
      },
      {
        onSuccess: () => navigate({ to: "/shelf/$shelfId", params: { shelfId } }),
      },
    );
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth="md" mx="auto" px={2} py={3}>
      <Typography variant="h5" fontWeight={600} mb={3}>
        Edit Shelf
      </Typography>

      <Stack spacing={3}>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          variant="standard"
        />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={4}
          variant="standard"
        />
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="text"
            onClick={() =>
              navigate({ to: "/shelf/$shelfId", params: { shelfId } })
            }
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            Save
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default ShelfEditPage;
