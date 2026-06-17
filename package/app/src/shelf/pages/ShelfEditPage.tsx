/**
 * TODO The current strategy has an issue. In list mode, a review actually does not need to be tied to the prime ordering. It should be able to be sorted into any position independently, while the bound prime information should be shown in the review card.
 * TODO 当前策略存在问题。在 list 模式下，review 其实不需要绑定到 prime 排序。它应当能够独立排序到任意位置，同时绑定的 prime 信息应展示在 review card 中。
 */
import type { ShelfView } from "@rezics/api/shelf";

/**
 * Shelf edit page with translation-row metadata and item editor. Title,
 * description, and cover URL belong to the selected UnitTranslation; default
 * view mode and pinned tags are shelf-level metadata.
 * 书架编辑页面，包含按语言行编辑的展示信息和条目编辑器。标题、描述、封面 URL
 * 属于当前选中的 UnitTranslation；默认视图和固定标签属于书架级元数据。
 *
 * Mobile <640px:
 * +----------------------+
 * | [Back] Edit shelf    |
 * | Lang select + Add    |
 * | Title input          |
 * | Markdown editor      |
 * | Cover URL input      |
 * | Pinned tag chips     |
 * | View select          |
 * |        Cancel Save   |
 * | Items editor         |
 * +----------------------+
 *
 * Tablet 640-1023px:
 * +----------------------------+
 * | [Back] Edit shelf          |
 * | Lang row wraps if needed   |
 * | Title / Markdown / Cover   |
 * | Tags / View                |
 * |              Cancel Save   |
 * | Items editor full width    |
 * +----------------------------+
 *
 * Desktop 1024-1535px:
 * +------------------------------+
 * | max-w-3xl centered           |
 * | Header row                   |
 * | Language bar                 |
 * | Translation fields stacked   |
 * | Shelf metadata stacked       |
 * |                 Cancel Save  |
 * | Items editor                 |
 * +------------------------------+
 *
 * Ultra-wide >=1536px:
 * +------------------------------+
 * | max-w-3xl centered           |
 * | Same geometry as desktop     |
 * | Outer whitespace expands     |
 * +------------------------------+
 */
import { shelfDetailQuery, shelfKeys } from "@rezics/api/shelf";
import {
  useSetShelfPinnedTagsMutation,
  useUpdateShelfMutation,
} from "@rezics/api/shelf/shelf.mutations";
import { useUpsertTranslationMutation } from "@rezics/api/unit/unit.mutations";
import {
  CONTENT_LANGUAGE_SLUGS,
  contentDocMarkdownFallback,
  markdownContentDoc,
  normalizeContentLanguage,
  readCoverUrlFromExtra,
  type UnitTranslationDTO,
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
import { useBlocker, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { QueryErrorDisplay } from "@/core";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import {
  AddUnitTranslationLanguageDialog,
  UnitTranslationLanguageBar,
} from "@/unit";
import { SeedTagChipGroup } from "../components/SeedTagChipGroup";
import { useShelfItemsEditor } from "../hooks/useShelfItemsEditor";
import { normalizeShelfViewMode } from "../models/shelfViewMode";
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
  {
    value: "bookshelf",
    label: getI18nRuntime().i18n.t("entity:shelf_view_bookshelf"),
  },
  // { value: "masonry", label: "Masonry" },
];

type ShelfTranslationDraft = {
  title: string;
  description: string;
  coverUrl: string;
};

function emptyTranslationDraft(): ShelfTranslationDraft {
  return { title: "", description: "", coverUrl: "" };
}

function shelfTranslationToDraft(
  translation: UnitTranslationDTO | undefined,
): ShelfTranslationDraft {
  return {
    title: translation?.title ?? "",
    description: contentDocMarkdownFallback(translation?.description),
    coverUrl: readCoverUrlFromExtra(translation?.extra) ?? "",
  };
}

function shelfTranslationDraftChanged(
  draft: ShelfTranslationDraft,
  base: ShelfTranslationDraft,
): boolean {
  return (
    draft.title !== base.title ||
    draft.description !== base.description ||
    draft.coverUrl !== base.coverUrl
  );
}

export function ShelfEditPage({ shelfId }: ShelfEditPageProps) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { lang?: string };
  const {
    data: shelf,
    isLoading,
    isError,
    error,
  } = useQuery(shelfDetailQuery(shelfId));
  const updateMutation = useUpdateShelfMutation({
    onSuccess: () => toast.success(getI18nRuntime().i18n.t("common:saved")),
  });
  const setPinnedTagsMutation = useSetShelfPinnedTagsMutation();
  const upsertTranslationMutation = useUpsertTranslationMutation({
    affectedDetailKeys: () => [shelfKeys.detail(shelfId)],
    onSuccess: () => toast.success(getI18nRuntime().i18n.t("common:saved")),
  });
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

  const translations = shelf?.translations ?? [];
  const translationByLang = useMemo(() => {
    const map = new Map<string, UnitTranslationDTO>();
    for (const item of translations) {
      if (item.language) map.set(item.language, item);
    }
    return map;
  }, [translations]);
  const existingLanguages = useMemo(
    () => translations.map((item) => item.language).filter(Boolean) as string[],
    [translations],
  );
  const hasAvailable = CONTENT_LANGUAGE_SLUGS.length > existingLanguages.length;
  const requestedLanguage = search.lang
    ? normalizeContentLanguage(search.lang)
    : null;
  const initialLanguage =
    requestedLanguage ??
    shelf?.resolvedLanguage ??
    shelf?.defaultLanguage ??
    existingLanguages[0] ??
    "en";
  const selectedLanguage = initialLanguage;
  const currentTranslation = translationByLang.get(selectedLanguage);
  const [drafts, setDrafts] = useState<Record<string, ShelfTranslationDraft>>(
    {},
  );
  const [addTranslationOpen, setAddTranslationOpen] = useState(false);
  const currentDraft =
    drafts[selectedLanguage] ?? shelfTranslationToDraft(currentTranslation);

  const setSelectedLanguage = (lang: string) => {
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, lang }),
      replace: true,
    });
  };

  const updateTranslationDraft = <K extends keyof ShelfTranslationDraft>(
    key: K,
    value: ShelfTranslationDraft[K],
  ) => {
    setDrafts((prev) => {
      const base =
        prev[selectedLanguage] ??
        shelfTranslationToDraft(translationByLang.get(selectedLanguage));
      return { ...prev, [selectedLanguage]: { ...base, [key]: value } };
    });
  };

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

  useEffect(() => {
    const saved = normalizeShelfViewMode(
      (shelf?.extra as { viewMode?: unknown } | null | undefined)?.viewMode,
    );
    setDefaultViewMode(saved);
    setEditorPreviewView(saved);
  }, [shelf?.extra]);

  const metadataDirty = useMemo(() => {
    if (!shelf) return false;
    const savedViewMode = normalizeShelfViewMode(
      (shelf.extra as { viewMode?: unknown } | null | undefined)?.viewMode,
    );
    return defaultViewMode !== savedViewMode;
  }, [shelf, defaultViewMode]);

  const dirtyTranslationEntries = useMemo(
    () =>
      Object.entries(drafts).filter(([language, draft]) =>
        shelfTranslationDraftChanged(
          draft,
          shelfTranslationToDraft(translationByLang.get(language)),
        ),
      ),
    [drafts, translationByLang],
  );
  const translationDirty = dirtyTranslationEntries.length > 0;

  const isDirty = metadataDirty || translationDirty || editor.dirty;

  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
    enableBeforeUnload: () => isDirty,
  });

  const handleSave = () => {
    if (metadataDirty) {
      updateMutation.mutate({
        unitId: shelfId,
        input: {
          extra: {
            ...((shelf?.extra as Record<string, unknown> | null | undefined) ??
              {}),
            viewMode: defaultViewMode,
          },
        },
      });
    }

    for (const [language, draft] of dirtyTranslationEntries) {
      upsertTranslationMutation.mutate(
        {
          unitId: shelfId,
          language,
          input: {
            title: draft.title || null,
            description: draft.description
              ? markdownContentDoc(draft.description)
              : null,
            extra: draft.coverUrl
              ? { coverUrl: draft.coverUrl }
              : { $unset: ["coverUrl"] },
          },
        },
        {
          onSuccess: () => {
            setDrafts((prev) => {
              const next = { ...prev };
              delete next[language];
              return next;
            });
          },
        },
      );
    }
  };

  const handleAddTranslation = (language: string) => {
    upsertTranslationMutation.mutate(
      {
        unitId: shelfId,
        language,
        input: {},
      },
      {
        onSuccess: () => {
          setDrafts((prev) => ({
            ...prev,
            [language]: emptyTranslationDraft(),
          }));
          setAddTranslationOpen(false);
          setSelectedLanguage(language);
        },
      },
    );
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
        <UnitTranslationLanguageBar
          existingLanguages={existingLanguages}
          selectedLanguage={selectedLanguage}
          defaultLanguage={shelf.defaultLanguage}
          onSelect={setSelectedLanguage}
          onAddClick={() => setAddTranslationOpen(true)}
          hasAvailable={hasAvailable}
          label={getI18nRuntime().i18n.t("common:language")}
          addLabel={getI18nRuntime().i18n.t("common:add_translation")}
          defaultLabel={getI18nRuntime().i18n.t(
            "page:book_edit_info_translation_default_badge",
          )}
          className="flex flex-row flex-wrap items-center gap-2"
          selectClassName="w-full sm:w-[220px]"
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-shelf-title">
            {getI18nRuntime().i18n.t("entity:shelf_title_label")}
          </Label>
          <Input
            id="edit-shelf-title"
            value={currentDraft.title}
            onChange={(e) => updateTranslationDraft("title", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>
            {getI18nRuntime().i18n.t("entity:shelf_description_label")}
          </Label>
          <RezicsMarkdownEditor
            value={currentDraft.description}
            onChange={(value) => updateTranslationDraft("description", value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-shelf-cover">
            {getI18nRuntime().i18n.t("entity:shelf_cover_url_label")}
          </Label>
          <Input
            id="edit-shelf-cover"
            value={currentDraft.coverUrl}
            onChange={(e) => updateTranslationDraft("coverUrl", e.target.value)}
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
              (!metadataDirty && !translationDirty)
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

      <AddUnitTranslationLanguageDialog
        open={addTranslationOpen}
        existingLanguages={existingLanguages}
        onClose={() => setAddTranslationOpen(false)}
        onSubmit={handleAddTranslation}
        title={getI18nRuntime().i18n.t("common:add_translation")}
        languageLabel={getI18nRuntime().i18n.t("common:language")}
        cancelLabel={getI18nRuntime().i18n.t("common:cancel")}
        submitLabel={getI18nRuntime().i18n.t("common:submit")}
      />

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
