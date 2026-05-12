import type { ShelfView } from "@rezics/api/shelf";
import { shelfDetailQuery } from "@rezics/api/shelf";
import { useUpdateShelfMutation } from "@rezics/api/shelf/shelf.mutations";
import { Spinner } from "@rezics/ui";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { useShelfItemsEditor } from "../hooks/useShelfItemsEditor";
import { ShelfEditorItemsSection } from "../sections/ShelfEditorItemsSection";

interface ShelfEditPageProps {
  shelfId: string;
}

function normalizeViewMode(raw: unknown): ShelfView {
  if (raw === "flat" || raw === "nested") return raw;
  return "nested";
}

export function ShelfEditPage({ shelfId }: ShelfEditPageProps) {
  const navigate = useNavigate();
  const { data: shelf, isLoading } = useQuery(shelfDetailQuery(shelfId));
  const updateMutation = useUpdateShelfMutation();
  const editor = useShelfItemsEditor(shelfId);

  const translation = shelf ? getTranslation(shelf.translations) : null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [viewMode, setViewMode] = useState<ShelfView>("nested");

  useEffect(() => {
    if (translation) {
      setTitle(translation.title ?? "");
      setDescription(translation.description ?? "");
      setCoverUrl(shelf?.coverUrl ?? "");
    }
  }, [translation, shelf?.coverUrl]);

  useEffect(() => {
    setViewMode(
      normalizeViewMode(
        (shelf?.extra as { viewMode?: unknown } | null | undefined)?.viewMode,
      ),
    );
  }, [shelf?.extra]);

  const metadataDirty = useMemo(() => {
    if (!shelf) return false;
    const savedViewMode = normalizeViewMode(
      (shelf.extra as { viewMode?: unknown } | null | undefined)?.viewMode,
    );
    return (
      title !== (translation?.title ?? "") ||
      description !== (translation?.description ?? "") ||
      coverUrl !== (shelf.coverUrl ?? "") ||
      viewMode !== savedViewMode
    );
  }, [shelf, translation, title, description, coverUrl, viewMode]);

  const isDirty = metadataDirty || editor.dirty;

  useBlocker({
    shouldBlockFn: () => {
      if (!isDirty) return false;
      return !window.confirm("You have unsaved changes. Leave anyway?");
    },
    enableBeforeUnload: () => isDirty,
  });

  const handleSave = () => {
    updateMutation.mutate({
      unitId: shelfId,
      input: {
        title,
        coverUrl: coverUrl || null,
        extra: {
          ...((shelf?.extra as Record<string, unknown> | null | undefined) ??
            {}),
          viewMode,
        },
      },
    });
  };

  if (isLoading || !shelf) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Back to shelf"
          onClick={() =>
            navigate({ to: "/shelf/$shelfId", params: { shelfId } })
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">Edit Shelf</h1>
      </div>

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
            disabled={updateMutation.isPending || !metadataDirty}
          >
            Save
          </Button>
        </div>

        <ShelfEditorItemsSection
          shelf={shelf}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          editor={editor}
        />
      </div>
    </div>
  );
}

export default ShelfEditPage;
