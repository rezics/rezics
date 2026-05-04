import { shelfDetailQuery } from "@rezics/api/shelf";
import { useUpdateShelfMutation } from "@rezics/api/shelf/shelf.mutations";
import { Spinner } from "@rezics/ui";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getTranslation } from "@/shared/utils/translation-helpers";

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
  const [coverUrl, setCoverUrl] = useState("");

  useEffect(() => {
    if (translation) {
      setTitle(translation.title ?? "");
      setDescription(translation.description ?? "");
      setCoverUrl(shelf?.coverUrl ?? "");
    }
  }, [translation]);

  const handleSave = () => {
    updateMutation.mutate(
      {
        unitId: shelfId,
        input: {
          title,
          coverUrl: coverUrl || null,
        },
      },
      {
        onSuccess: () =>
          navigate({ to: "/shelf/$shelfId", params: { shelfId } }),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">Edit Shelf</h1>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-shelf-title">Title</Label>
          <Input
            id="edit-shelf-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-shelf-description">Description</Label>
          <textarea
            id="edit-shelf-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-shelf-cover">Cover Image URL</Label>
          <Input
            id="edit-shelf-cover"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
          />
        </div>
        <div className="flex flex-row justify-end gap-4">
          <Button
            variant="ghost"
            onClick={() =>
              navigate({ to: "/shelf/$shelfId", params: { shelfId } })
            }
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ShelfEditPage;
