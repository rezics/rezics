import { useCreateShelfMutation } from "@rezics/api/shelf/shelf.mutations";
import { DEFAULT_LANGUAGE, markdownContentDoc } from "@rezics/contract";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SeedTagChipGroup } from "../components/SeedTagChipGroup";
import { useMessage } from "@rezics/i18n/react";
import {
  common_create,
  shelf_content_type_label,
  shelf_cover_url_label,
  shelf_description_label,
  shelf_new_title,
  shelf_title_label,
} from "@rezics/i18n/messages";
const i18nMessages = {
  common_create,
  shelf_content_type_label,
  shelf_cover_url_label,
  shelf_description_label,
  shelf_new_title,
  shelf_title_label,
};

export function NewShelfPage() {
  const m = useMessage(i18nMessages);
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
            description: description.trim()
              ? markdownContentDoc(description)
              : null,
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
      <h1 className="mb-6 text-2xl font-semibold">{m.shelf_new_title()}</h1>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-shelf-title">{m.shelf_title_label()}</Label>
          <Input
            id="new-shelf-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-shelf-description">
            {m.shelf_description_label()}
          </Label>
          <textarea
            id="new-shelf-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-shelf-cover">{m.shelf_cover_url_label()}</Label>
          <Input
            id="new-shelf-cover"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{m.shelf_content_type_label()}</Label>
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
            {m.common_create()}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NewShelfPage;
