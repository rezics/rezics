/**
 * TODO The current strategy has an issue. In list mode, a review actually does not need to be tied to the prime ordering. It should be able to be sorted into any position independently, while the bound prime information should be shown in the review card.
 * TODO 当前策略存在问题。在 list 模式下，review 其实不需要绑定到 prime 排序。它应当能够独立排序到任意位置，同时绑定的 prime 信息应展示在 review card 中。
 */
import type { ShelfView } from "@rezics/api/shelf";

/**
 * Shelf edit page with metadata form and item editor. Supports editing title,
 * description, cover URL, pinned tags, and default view mode (nested/flat).
 * 书架编辑页面，包含元数据表单和条目编辑器。支持编辑标题、描述、封面 URL、固定标签和默认视图模式。
 *
 * Mobile <640px:
 * +--[Back][Title]--+
 * |  Input         |
 * |  Label         |
 * |  Textarea      |
 * |  TagChips      |
 * |  Select        |
 * |  [Cancel][Save]|
 * |  ItemsSection  |
 * +----------------+
 *
 * Tablet 640-1023px:
 * +--------[Back][Title]--------+
 * |  Input      Input          |
 * |  Label      Label          |
 * |  Textarea   TagChips       |
 * |  Select         Select     |
 * |  [Cancel]     [Save]       |
 * |  ItemsSection              |
 * +----------------------------+
 *
 * Desktop 1024-1535px:
 * +----------[Back][Title]----------+
 * |  Input         Input           |
 * |  Label         Label           |
 * |  Textarea      TagChips        |
 * |  Select            Select      |
 * |                [Cancel][Save]  |
 * |  ItemsSection (full width)     |
 * +--------------------------------+
 *
 * Ultra-wide >=1536px:
 * +-------[Back][Title (max-w-3xl)]-------+
 * |  Input              Input            |
 * |  Label              Label            |
 * |  Textarea           TagChips         |
 * |  Select                 Select       |
 * |                   [Cancel][Save]     |
 * |  ItemsSection (centered max-w-3xl)   |
 * +--------------------------------------+
 */
import { shelfDetailQuery } from "@rezics/api/shelf";
import {
  useSetShelfPinnedTagsMutation,
  useUpdateShelfMutation,
} from "@rezics/api/shelf/shelf.mutations";
import { useUpsertTranslationMutation } from "@rezics/api/unit/unit.mutations";
import {
  contentDocMarkdownFallback,
  markdownContentDoc,
} from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { ConfirmDialog, Spinner } from "@rezics/ui";
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
import { useEffect, useMemo, useRef, useState } from "react";
import { QueryErrorDisplay } from "@/core";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { SeedTagChipGroup } from "../components/SeedTagChipGroup";
import { useShelfItemsEditor } from "../hooks/useShelfItemsEditor";
import { ShelfEditorItemsSection } from "../sections/ShelfEditorItemsSection";

interface ShelfEditPageProps {
  shelfId: string;
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
  const {
    data: shelf,
    isLoading,
    isError,
    error,
  } = useQuery(shelfDetailQuery(shelfId));
  const updateMutation = useUpdateShelfMutation();
  const setPinnedTagsMutation = useSetShelfPinnedTagsMutation();
  const upsertTranslationMutation = useUpsertTranslationMutation();
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

  /**
   * Persisted default shelf view — edited via metadata form.
   * 持久化的默认 shelf 视图 —— 通过元数据表单编辑。
   */
  const [defaultViewMode, setDefaultViewMode] = useState<ShelfView>("nested");

  // Editor preview view is local state and must not dirty metadata or trigger
  // Save; the persisted default view lives in shelf.extra.viewMode, edited via
  // the metadata form.
  // 编辑器预览视图是本地 state，不应弄脏元数据或触发 Save；持久化的默认视图存放在
  // shelf.extra.viewMode 中，通过元数据表单编辑。
  const [editorPreviewView, setEditorPreviewView] =
    useState<ShelfView>("nested");

  // Only initialize form state on first data load; skip subsequent refetches
  // so that mutation-triggered query invalidations don't wipe in-progress edits.
  // 仅在首次数据加载时初始化表单状态；跳过后续 refetch，
  // 避免 mutation 触发的查询失效覆盖正在编辑的内容。
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (translation) {
      initializedRef.current = true;
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

  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
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

    // Persist description via upsertTranslation — the shelf update endpoint
    // does not carry a description field.
    // 通过 upsertTranslation 持久化描述 —— shelf 更新端点不包含 description 字段。
    const lang = translation?.language;
    if (lang) {
      upsertTranslationMutation.mutate({
        unitId: shelfId,
        language: lang,
        input: {
          title,
          description: markdownContentDoc(description),
        },
      });
    }
  };

  // Shelf detail query failed — show error before content
  // 书架详情查询失败 —— 在内容之前显示错误
  if (isError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

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
            disabled={
              updateMutation.isPending ||
              upsertTranslationMutation.isPending ||
              !metadataDirty
            }
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

      <ConfirmDialog
        open={blocker.status === "blocked"}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
        title={getI18nRuntime().i18n.t("entity:shelf_unsaved_changes_confirm")}
        confirmLabel={getI18nRuntime().i18n.t("common:confirm")}
        cancelLabel={getI18nRuntime().i18n.t("common:cancel")}
        variant="destructive"
      />
    </div>
  );
}

function normalizeViewMode(raw: unknown): ShelfView {
  if (raw === "flat" || raw === "nested" || raw === "masonry") return raw;
  return "nested";
}
