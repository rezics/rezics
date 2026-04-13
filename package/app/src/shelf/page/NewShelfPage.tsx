import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCreateShelfMutation } from "@rezics/api/shelf/shelf.mutations";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function NewShelfPage() {
  const navigate = useNavigate();
  const createMutation = useCreateShelfMutation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    createMutation.mutate(
      {
        translations: [
          {
            language: DEFAULT_LANGUAGE,
            title,
            description,
          },
        ],
      },
      {
        onSuccess: (data) => {
          navigate({
            to: "/shelf/$shelfId",
            params: { shelfId: data.unitId },
          });
        },
      },
    );
  };

  return (
    <Box maxWidth="md" mx="auto" px={2} py={3}>
      <Typography variant="h5" fontWeight={600} mb={3}>
        New Shelf
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
        <Stack direction="row" justifyContent="flex-end">
          <Button
            variant="contained"
            disableElevation
            onClick={handleCreate}
            disabled={!title || createMutation.isPending}
          >
            Create
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default NewShelfPage;
