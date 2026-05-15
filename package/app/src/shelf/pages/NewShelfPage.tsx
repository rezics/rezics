import { useCreateShelfMutation } from "@rezics/api/shelf/shelf.mutations";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SeedTagChipGroup } from "../components/SeedTagChipGroup";

export function NewShelfPage() {
  const navigate = useNavigate();
  const createMutation = useCreateShelfMutation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [pinnedTagIds, setPinnedTagIds] = useState<string[]>([]);

  const handleCreate = () => {
    createMutation.mutate(
      {
        coverUrl: coverUrl || undefined,
        tagIds: pinnedTagIds.length ? pinnedTagIds : undefined,
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
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">New Shelf</h1>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-shelf-title">Title</Label>
          <Input
            id="new-shelf-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-shelf-description">Description</Label>
          <textarea
            id="new-shelf-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-shelf-cover">Cover Image URL</Label>
          <Input
            id="new-shelf-cover"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Content type</Label>
          <SeedTagChipGroup
            value={pinnedTagIds}
            onChange={setPinnedTagIds}
            disabled={createMutation.isPending}
          />
        </div>
        <div className="flex flex-row justify-end">
          <Button
            onClick={handleCreate}
            disabled={!title || createMutation.isPending}
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NewShelfPage;
