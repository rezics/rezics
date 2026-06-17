import { getI18nRuntime } from "@rezics/i18n/runtime";

const i18nMessages = {
  shelf_sort_manual: () => getI18nRuntime().i18n.t("entity:shelf_sort_manual"),
  shelf_sort_manual_reversed: () =>
    getI18nRuntime().i18n.t("entity:shelf_sort_manual_reversed"),
  shelf_sort_newest: () => getI18nRuntime().i18n.t("entity:shelf_sort_newest"),
  shelf_sort_oldest: () => getI18nRuntime().i18n.t("entity:shelf_sort_oldest"),
  shelf_sort_title_az: () =>
    getI18nRuntime().i18n.t("entity:shelf_sort_title_az"),
  shelf_sort_title_za: () =>
    getI18nRuntime().i18n.t("entity:shelf_sort_title_za"),
  shelf_view_nested: () => getI18nRuntime().i18n.t("entity:shelf_view_nested"),
  shelf_view_list: () => getI18nRuntime().i18n.t("entity:shelf_view_list"),
  shelf_view_bookshelf: () =>
    getI18nRuntime().i18n.t("entity:shelf_view_bookshelf"),
} as const;

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { ShelfSortState, ShelfView } from "@rezics/api/shelf";
import { useHydratedShelfItems } from "@rezics/api/shelf";
import {
  type ShelfDTO,
  type ShelfItemKind,
  shelfItemIdentity,
  shelfItemReference,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Checkbox,
  Label,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { Eye, ListChecks, Pencil } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import {
  type Candidate,
  shelfItemToUnitCardSummary,
  UnitAddPicker,
  UnitCard,
} from "@/unit";
import { CrossPageMoveModal } from "../components/CrossPageMoveModal";
import { ShelfEditorItemRow } from "../components/ShelfEditorItemRow";
import { ShelfItemRenderer } from "../components/ShelfItemRenderer";
import {
  type ShelfSortChoice,
  ShelfSortViewPicker,
  type ShelfViewChoice,
} from "../components/ShelfSortViewPicker";
import type { useShelfItemsEditor } from "../hooks/useShelfItemsEditor";
import { visualReorderBounds } from "../models/positionMath";
import {
  canReorderShelfStreamEntry,
  canUseShelfReorder,
} from "../models/reorderAvailability";
import {
  deriveShelfStream,
  type ShelfStreamEntry,
} from "../models/shelfStream";

const PAGE_SIZE = 20;

type EditorMode = "edit" | "multi-select" | "preview";

interface ShelfEditorItemsSectionProps {
  shelf: ShelfDTO;
  viewMode: ShelfView;
  onViewModeChange: (viewMode: ShelfView) => void;
  editor: ReturnType<typeof useShelfItemsEditor>;
}

/**
 * Shelf editor items section.
 *
 * Comprehensive shelf content editor supporting three modes: edit (add/reorder/delete),
 * multi-select (bulk delete), and preview. Handles nested/flat views, multiple sort
 * strategies, drag-and-drop reordering, and cross-page item moves with pagination.
 *
 * 书架编辑项目区域。完整的书架内容编辑器，支持三种模式：编辑（添加/重排/删除）、
 * 多选（批量删除）和预览。支持嵌套/平铺视图、多种排序策略、拖放重排和分页跨页
 * 移动项目的操作。
 *
 * Desktop Edit Mode (1200px):
 * +---------------------------------------------------+
 * | Items                    |Edit|Multiselect|Prev| |
 * | Add Item [+]             | Sort: [Manual ▼]      |
 * | [Item 1 - Book]    [≡]                           |
 * |   Content preview...                             |
 * | [Item 2 - Review]  [≡]                           |
 * |   Content preview...                             |
 * | Pagination: [Prev] 1/5 [Next]                    |
 * | Pending: 2 changes [Discard] [Save 2 changes]    |
 * +---------------------------------------------------+
 *
 * Desktop Multi-Select Mode (1200px):
 * +---------------------------------------------------+
 * | Items                    |Edit|Multiselect|Prev| |
 * | [☑] Item 1  [☑] Item 2  [☑] Item 3             |
 * | [☑] Item 4  [☑] Item 5                          |
 * | Delete Selected (2)                              |
 * | Pagination: [Prev] 1/5 [Next]                    |
 * +---------------------------------------------------+
 *
 * Tablet Edit Mode (768px):
 * +---------------------------+
 * | Items  |Edit|Multi|Prev|   |
 * | [+] Add | Sort: [Manual▼]  |
 * | [Item 1]    [≡]            |
 * | Content...                 |
 * | [Item 2]    [≡]            |
 * | [1/3]                      |
 * | [Save 2 ops]               |
 * +---------------------------+
 *
 * Mobile Edit Mode (360px):
 * +---------+
 * | [≡][+]  |
 * +---------+
 * | Items   |
 * | [Item 1]|
 * | [≡]     |
 * |         |
 * | [Item 2]|
 * | [≡]     |
 * | [1/3]   |
 * | [Save]  |
 * +---------+
 *
 * Preview Mode (1200px):
 * +---------------------------------------------+
 * | Items                          |Prev|       |
 * | Item 1 - Book                  |    |       |
 * | Full content view...           |    |       |
 * | Item 2 - Review                |    |       |
 * | Full content view...           |    |       |
 * +---------------------------------------------+
 */

const SORT_OPTIONS: ShelfSortChoice[] = [
  { field: "manual", order: "desc", label: i18nMessages.shelf_sort_manual },
  {
    field: "manual",
    order: "asc",
    label: i18nMessages.shelf_sort_manual_reversed,
  },
  { field: "addedAt", order: "desc", label: i18nMessages.shelf_sort_newest },
  { field: "addedAt", order: "asc", label: i18nMessages.shelf_sort_oldest },
  { field: "title", order: "asc", label: i18nMessages.shelf_sort_title_az },
  { field: "title", order: "desc", label: i18nMessages.shelf_sort_title_za },
];

const VIEW_OPTIONS: ShelfViewChoice[] = [
  { value: "nested", label: i18nMessages.shelf_view_nested },
  { value: "flat", label: i18nMessages.shelf_view_list },
  { value: "bookshelf", label: i18nMessages.shelf_view_bookshelf },
];

function candidateKindToShelfItemKind(kind: string): ShelfItemKind {
  switch (kind) {
    case "book":
      return "book";
    case "post":
      return "post";
    case "review":
      return "review";
    case "shelf":
      return "shelf";
    case "tag":
      return "tag";
    default:
      return "post";
  }
}

function entryUnitId(entry: ShelfStreamEntry): string {
  return shelfItemReference(entry.unit.unit);
}

function streamEntryRowId(entry: ShelfStreamEntry): string {
  if (entry.kind === "child") {
    return `${entry.parentUnitId}:${shelfItemIdentity(entry.unit.unit)}`;
  }
  return shelfItemIdentity(entry.unit.unit);
}

function isEditorMode(value: string | undefined): value is EditorMode {
  return value === "edit" || value === "multi-select" || value === "preview";
}

export function ShelfEditorItemsSection({
  viewMode,
  onViewModeChange,
  editor,
}: ShelfEditorItemsSectionProps) {
  const { t } = useTranslation(["common", "entity"]);
  const hydration = useHydratedShelfItems(editor.units);
  const [sortState, setSortState] = useState<ShelfSortState>({
    field: "manual",
    order: "desc",
  });
  const [page, setPage] = useState(1);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>("edit");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [sortPrimeOnly, setSortPrimeOnly] = useState(true);
  const sortPrimeOnlyId = useId();

  useEffect(() => {
    if (mode !== "multi-select" && selectedIds.size > 0) {
      setSelectedIds(new Set());
    }
  }, [mode, selectedIds.size]);

  const stream = useMemo(
    () =>
      deriveShelfStream(
        hydration.enriched,
        editor.relations,
        viewMode,
        sortState,
        sortPrimeOnly,
      ),
    [hydration.enriched, editor.relations, viewMode, sortState, sortPrimeOnly],
  );

  const loadedPages = Math.max(1, Math.ceil(stream.length / PAGE_SIZE));
  const finalPageCount = editor.hasMoreUnits ? null : loadedPages;
  const pageStart = (page - 1) * PAGE_SIZE;
  const visibleStream = stream.slice(pageStart, pageStart + PAGE_SIZE);
  const waitingForPageData =
    editor.hasMoreUnits && pageStart >= stream.length && stream.length > 0;
  const canPageBackward = page > 1;
  const canPageForward = page < loadedPages || editor.hasMoreUnits;

  useEffect(() => {
    if (finalPageCount) {
      setPage((current) => Math.min(current, finalPageCount));
    }
  }, [finalPageCount]);

  useEffect(() => {
    if (waitingForPageData && !editor.isLoadingMoreUnits) {
      void editor.loadMoreUnits();
    }
  }, [editor.isLoadingMoreUnits, editor.loadMoreUnits, waitingForPageData]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const canReorder = canUseShelfReorder(mode === "edit", sortState);
  const showSortPrimeOnlyToggle =
    viewMode === "flat" && sortState.field !== "manual";

  function handleAddCandidate(candidate: Candidate) {
    editor.enqueueAdd({
      unitId: candidate.identifier,
      kind: candidateKindToShelfItemKind(String(candidate.kind)),
    });
  }

  function handleDelete(unitId: string) {
    editor.enqueueDelete(unitId);
  }

  function handleToggleSelected(unitId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  function handleBulkDelete() {
    for (const id of selectedIds) {
      editor.enqueueDelete(id);
    }
    setSelectedIds(new Set());
  }

  function handleMoveOpen(unitId: string) {
    setMoveTargetId(unitId);
  }

  function handleMovePick(toPage: number) {
    if (moveTargetId) {
      editor.enqueueCrossPageMove(
        moveTargetId,
        toPage,
        PAGE_SIZE,
        sortState.order,
      );
    }
    setMoveTargetId(null);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    if (!canReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sortableRows = visibleStream
      .filter((entry) =>
        canReorderShelfStreamEntry(true, sortState, viewMode, entry),
      )
      .map((entry) => ({
        id: streamEntryRowId(entry),
        unitId: entryUnitId(entry),
        position: entry.unit.unit.position,
      }));
    const oldIndex = sortableRows.findIndex((entry) => entry.id === active.id);
    const newIndex = sortableRows.findIndex((entry) => entry.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = [...sortableRows];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved!);

    const { before, after } = visualReorderBounds(
      reordered,
      newIndex,
      sortState.order,
    );

    editor.enqueueReorder(moved!.unitId, { before, after });
  }

  const sortableIds = canReorder
    ? visibleStream
        .filter((entry) =>
          canReorderShelfStreamEntry(true, sortState, viewMode, entry),
        )
        .map((entry) => streamEntryRowId(entry))
    : [];
  const activeDragEntry = activeDragId
    ? visibleStream.find((entry) => streamEntryRowId(entry) === activeDragId)
    : undefined;
  const editModeLabel = t("entity:shelf_edit_mode_edit");
  const multiSelectModeLabel = t("entity:shelf_edit_mode_multi_select");
  const previewModeLabel = t("entity:shelf_edit_mode_preview");
  const isPreview = mode === "preview";
  const isMultiSelect = mode === "multi-select";
  const listItems = (
    <ul className="flex flex-col">
      {visibleStream.map((entry) => {
        const id = entryUnitId(entry);
        const rowId = streamEntryRowId(entry);
        const canEditEntryOrder = canReorderShelfStreamEntry(
          mode === "edit",
          sortState,
          viewMode,
          entry,
        );
        if (isPreview) {
          return (
            <li key={rowId} className="list-none py-1">
              <ShelfItemRenderer entry={entry} viewMode={viewMode} />
            </li>
          );
        }
        return (
          <li key={rowId} className="list-none">
            <ShelfEditorItemRow
              entry={entry}
              rowId={rowId}
              unitId={id}
              viewMode={viewMode}
              sortable={canEditEntryOrder}
              canMoveCrossPage={
                !isMultiSelect &&
                canEditEntryOrder &&
                loadedPages > 1 &&
                mode === "edit"
              }
              canDelete={!isMultiSelect && canEditEntryOrder}
              onDelete={handleDelete}
              onMoveCrossPage={handleMoveOpen}
              multiSelect={isMultiSelect}
              selected={selectedIds.has(id)}
              onToggleSelected={handleToggleSelected}
            />
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex flex-col gap-4">
      <hr className="border-border-whisper" />
      <h2 className="text-lg font-semibold">
        {t("entity:shelf_edit_items_heading")}
      </h2>

      {mode === "edit" && (
        <UnitAddPicker
          actionLabel={t("entity:shelf_edit_add")}
          onSelectCandidate={handleAddCandidate}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ShelfSortViewPicker
            sort={sortState}
            sortOptions={SORT_OPTIONS}
            view={viewMode}
            viewOptions={VIEW_OPTIONS}
            onSortChange={setSortState}
            onViewChange={onViewModeChange}
            sortHeading={t("entity:shelf_controls_sort_by")}
            viewHeading={t("entity:shelf_controls_view")}
          />
          {showSortPrimeOnlyToggle && (
            <Label
              htmlFor={sortPrimeOnlyId}
              className="flex items-center gap-2 text-sm text-text-secondary"
            >
              <Checkbox
                id={sortPrimeOnlyId}
                checked={sortPrimeOnly}
                onCheckedChange={(next) => setSortPrimeOnly(Boolean(next))}
              />
              {t("entity:shelf_edit_sort_prime_only")}
            </Label>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {isMultiSelect && selectedIds.size > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              {t("entity:shelf_edit_delete_selected", { n: selectedIds.size })}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-text-secondary">
              {t("entity:shelf_mode_label")}
            </Label>
            <TooltipProvider>
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(value) => {
                  if (!isEditorMode(value)) return;
                  setMode(value);
                }}
                size="sm"
              >
                <Tooltip>
                  <TooltipTrigger
                    render={(props) => (
                      <ToggleGroupItem
                        value="edit"
                        aria-label={editModeLabel}
                        {...props}
                      >
                        <Pencil className="h-4 w-4" />
                      </ToggleGroupItem>
                    )}
                  />
                  <TooltipContent side="top">{editModeLabel}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={(props) => (
                      <ToggleGroupItem
                        value="multi-select"
                        aria-label={multiSelectModeLabel}
                        {...props}
                      >
                        <ListChecks className="h-4 w-4" />
                      </ToggleGroupItem>
                    )}
                  />
                  <TooltipContent side="top">
                    {multiSelectModeLabel}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={(props) => (
                      <ToggleGroupItem
                        value="preview"
                        aria-label={previewModeLabel}
                        {...props}
                      >
                        <Eye className="h-4 w-4" />
                      </ToggleGroupItem>
                    )}
                  />
                  <TooltipContent side="top">{previewModeLabel}</TooltipContent>
                </Tooltip>
              </ToggleGroup>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {editor.isLoading ? (
        <div className="py-4 text-sm text-text-secondary">
          {t("common:loading")}
        </div>
      ) : waitingForPageData || editor.isLoadingMoreUnits ? (
        <div className="py-4 text-sm text-text-secondary">
          {t("common:loading")}
        </div>
      ) : visibleStream.length === 0 ? (
        <div className="py-4 text-sm text-text-secondary">
          {t("entity:shelf_edit_empty")}
        </div>
      ) : (
        <DndContext
          sensors={canReorder ? sensors : []}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDragId(null)}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            {listItems}
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeDragEntry ? (
              <UnitCard
                summary={shelfItemToUnitCardSummary(
                  activeDragEntry.unit.unit,
                  activeDragEntry.unit.data,
                )}
                className="bg-surface-elevated"
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {(canPageBackward || canPageForward) && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={!canPageBackward}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("common:prev")}
          </Button>
          <span className="text-sm text-text-secondary">
            {finalPageCount
              ? `${page} / ${finalPageCount}`
              : `${page} / ${loadedPages}+`}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canPageForward}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common:next")}
          </Button>
        </div>
      )}

      <ShelfEditorItemsFooter editor={editor} />

      {editor.lastResult && editor.lastResult.failedCount > 0 && (
        <div className="rounded border border-border-error bg-error-fill/10 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span>
              {t("entity:shelf_ops_failed", {
                count: editor.lastResult.failedCount,
              })}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void editor.retryFailed()}
            >
              {t("common:retry")}
            </Button>
          </div>
        </div>
      )}

      <CrossPageMoveModal
        open={moveTargetId !== null}
        onOpenChange={(open) => !open && setMoveTargetId(null)}
        pageCount={loadedPages}
        currentPage={page}
        onPick={handleMovePick}
      />
    </div>
  );
}

interface FooterProps {
  editor: ReturnType<typeof useShelfItemsEditor>;
}

function ShelfEditorItemsFooter({ editor }: FooterProps) {
  const { t } = useTranslation(["common", "entity"]);
  if (!editor.dirty) return null;
  return (
    <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-surface-elevated border-t border-border-whisper flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="ghost"
        onClick={editor.discard}
        disabled={editor.saving}
      >
        {t("entity:shelf_edit_discard_ops")}
      </Button>
      <Button
        type="button"
        onClick={() => void editor.save()}
        disabled={editor.saving || editor.pendingCount === 0}
      >
        {t("entity:shelf_edit_save_n_ops", { n: editor.pendingCount })}
      </Button>
    </div>
  );
}
