/**
 * TODO The current strategy has an issue. In list mode, a review actually does not need to be tied to the prime ordering. It should be able to be sorted into any position independently, while the bound prime information should be shown in the review card.
 */
import type { ShelfView } from "@rezics/api/shelf";
import { shelfDetailQuery } from "@rezics/api/shelf";
import {
  useSetShelfPinnedTagsMutation,
  useUpdateShelfMutation,
} from "@rezics/api/shelf/shelf.mutations";
import { contentDocMarkdownFallback } from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { SeedTagChipGroup } from "../components/SeedTagChipGroup";
import { useShelfItemsEditor } from "../hooks/useShelfItemsEditor";
import { ShelfEditorItemsSection } from "../sections/ShelfEditorItemsSection";

interface ShelfEditPageProps {
  shelfId: string;
}

function normalizeViewMode(raw: unknown): ShelfView {
  if (raw === "flat" || raw === "nested" || raw === "masonry") return raw;
  return "nested";
}

const VIEW_MODE_OPTIONS: { value: ShelfView; label: string }[] = [
  {
    value: "nested",
    label: getI18nRuntime().i18n.t("entity:shelf_view_nested"),
  },
  { value: "flat", label: getI18nRuntime().i18n.t("entity:shelf_view_flat") },
  // { value: "masonry", label: "Masonry" },
];

export function ShelfEditPage({ shelfId }: ShelfEditPageProps) {
  const navigate = useNavigate();
  const { data: shelf, isLoading } = useQuery(shelfDetailQuery(shelfId));
  const updateMutation = useUpdateShelfMutation();
  const setPinnedTagsMutation = useSetShelfPinnedTagsMutation();
  const editor = useShelfItemsEditor(shelfId);

  const pinnedTagIds = useMemo(
    () => shelf?.tags?.map((t) => t.tagUnitId) ?? [],
    [shelf?.tags],
  );

  const handlePinnedTagsChange = (next: string[]) => {
    setPinnedTagsMutation.mutate({
      shelfId,
      input: { pinnedTagIds: next },
    });
  };

  const translation = shelf ? getTranslation(shelf.translations) : null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  /** Persisted default shelf view — edited via metadata form. */
  const [defaultViewMode, setDefaultViewMode] = useState<ShelfView>("nested");

  // Editor preview view is local state and must not dirty metadata or trigger
  // Save; the persisted default view lives in shelf.extra.viewMode, edited via
  // the metadata form.
  const [editorPreviewView, setEditorPreviewView] =
    useState<ShelfView>("nested");

  useEffect(() => {
    if (translation) {
      setTitle(translation.title ?? "");
      setDescription(contentDocMarkdownFallback(translation.description));
      setCoverUrl(shelf?.coverUrl ?? "");
    }
  }, [translation, shelf?.coverUrl]);

  useEffect(() => {
    const saved = normalizeViewMode(
      (shelf?.extra as { viewMode?: unknown } | null | undefined)?.viewMode,
    );
    setDefaultViewMode(saved);
    setEditorPreviewView(saved);
  }, [shelf?.extra]);

  const metadataDirty = useMemo(() => {
    if (!shelf) return false;
    const savedViewMode = normalizeViewMode(
      (shelf.extra as { viewMode?: unknown } | null | undefined)?.viewMode,
    );
    return (
      title !== (translation?.title ?? "") ||
      description !== contentDocMarkdownFallback(translation?.description) ||
      coverUrl !== (shelf.coverUrl ?? "") ||
      defaultViewMode !== savedViewMode
    );
  }, [shelf, translation, title, description, coverUrl, defaultViewMode]);

  const isDirty = metadataDirty || editor.dirty;

  useBlocker({
    shouldBlockFn: () => {
      if (!isDirty) return false;
      return !window.confirm(
        getI18nRuntime().i18n.t("entity:shelf_unsaved_changes_confirm"),
      );
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
          viewMode: defaultViewMode,
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
          aria-label={getI18nRuntime().i18n.t("entity:shelf_back_to_shelf")}
          onClick={() =>
            navigate({ to: "/shelf/$shelfId", params: { shelfId } })
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">
          {getI18nRuntime().i18n.t("entity:shelf_edit_title")}
        </h1>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-shelf-title">
            {getI18nRuntime().i18n.t("entity:shelf_title_label")}
          </Label>
          <Input
            id="edit-shelf-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-shelf-description">
            {getI18nRuntime().i18n.t("entity:shelf_description_label")}
          </Label>
          <textarea
            id="edit-shelf-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-shelf-cover">
            {getI18nRuntime().i18n.t("entity:shelf_cover_url_label")}
          </Label>
          <Input
            id="edit-shelf-cover"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>
            {getI18nRuntime().i18n.t("entity:shelf_content_type_label")}
          </Label>
          <SeedTagChipGroup
            value={pinnedTagIds}
            onChange={handlePinnedTagsChange}
            disabled={setPinnedTagsMutation.isPending}
          />
          {setPinnedTagsMutation.isError && (
            <span className="text-xs text-error-text">
              {setPinnedTagsMutation.error?.message ??
                getI18nRuntime().i18n.t(
                  "entity:shelf_content_type_update_failed",
                )}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-shelf-default-view">
            {getI18nRuntime().i18n.t("entity:shelf_default_view_label")}
          </Label>
          <Select
            value={defaultViewMode}
            onValueChange={(value) =>
              value && setDefaultViewMode(value as ShelfView)
            }
          >
            <SelectTrigger id="edit-shelf-default-view" className="w-full">
              <SelectValue>
                {VIEW_MODE_OPTIONS.find((o) => o.value === defaultViewMode)
                  ?.label ??
                  getI18nRuntime().i18n.t("entity:shelf_view_nested")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VIEW_MODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-text-secondary">
            {getI18nRuntime().i18n.t("entity:shelf_default_view_help")}
          </span>
        </div>
        <div className="flex flex-row justify-end gap-4">
          <Button
            variant="ghost"
            onClick={() =>
              navigate({ to: "/shelf/$shelfId", params: { shelfId } })
            }
          >
            {getI18nRuntime().i18n.t("common:cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || !metadataDirty}
          >
            {getI18nRuntime().i18n.t("common:save")}
          </Button>
        </div>

        <ShelfEditorItemsSection
          shelf={shelf}
          viewMode={editorPreviewView}
          onViewModeChange={setEditorPreviewView}
          editor={editor}
        />
      </div>
    </div>
  );
}

export default ShelfEditPage;
