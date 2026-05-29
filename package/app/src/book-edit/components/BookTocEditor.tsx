import { useAlertStore } from "@app/states/windowAlertStore.ts";
import { bookMutations } from "@rezics/api/book/book.mutations";
import { chapterMutations } from "@rezics/api/chapter/chapter.mutations";
import { chapterDetailQuery } from "@rezics/api/chapter/chapter.queries";
import type { ContentRating } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Download as DownloadIcon, Save as SaveIcon } from "lucide-react";
import type React from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  DeleteHandler,
  MoveHandler,
  NodeApi,
  RenameHandler,
} from "react-arborist";
import { Tree, type TreeApi } from "react-arborist";
import { useEnsureChapterUnit } from "@/book-library/hooks/useEnsureChapterUnit";
import {
  type BookContentStructureOccurrence,
  contentUnitIdForNode,
} from "@/book-library/models/bookContentStructurePath";
import {
  findAndAddChild,
  findAndDelete,
  findAndEdit,
  findAndInsert,
  findAndRemove,
} from "@/shared/utils/arborist-tree";
import { serializeBookToc } from "../models/bookTocSerializer";
import { BookTocContextMenu } from "./BookTocContextMenu";
import {
  createBookTocEditorNode,
  LEAF_ROW_HEIGHT,
  mockWordCount,
} from "./BookTocEditorNode";
import { BookTocEditorToolbar } from "./BookTocEditorToolbar";
import { BulkRatingDialog } from "./BulkRatingDialog";
import { CreateChapterDialog } from "./CreateChapterDialog";
import { EditChapterDialog } from "./EditChapterDialog";
import { MoveToParentDialog } from "./MoveToParentDialog";

/** Chapter tree node structure. */
export type Chapter = {
  id: string | number;
  title: string;
  contentUnitId?: string;
  path?: number[];
  occurrenceId?: string;
  nodeId?: string;
  rating?: ContentRating;
  children?: Chapter[];
} & Partial<
  Omit<
    BookContentStructureOccurrence,
    "children" | "id" | "nodeId" | "occurrenceId" | "path"
  >
>;

/** Context menu state. */
export type ChapterContextMenuState = {
  x: number;
  y: number;
  node: NodeApi<Chapter>;
} | null;

/** Imperative handle for parent components. */
export interface BookTocEditorHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

interface BookTocEditorProps {
  bookTocTree: Chapter[];
  bookUnitId: string;
  bookRating?: ContentRating;
  onDownloadJSON?: () => void;
}

/** Find the last non-leaf node (last volume/section with children). */
function findLastNonLeafId(tree: Chapter[]): string | number | null {
  let lastId: string | number | null = null;
  for (const node of tree) {
    if (node.children !== undefined) {
      lastId = node.id;
    }
  }
  if (lastId === null) {
    for (const node of tree) {
      if (node.children) {
        const deepId = findLastNonLeafId(node.children);
        if (deepId !== null) lastId = deepId;
      }
    }
  }
  return lastId;
}

/** Count all leaf nodes in tree. */
function countChapters(tree: Chapter[]): number {
  let count = 0;
  for (const node of tree) {
    if (node.children?.length) {
      count += countChapters(node.children);
    } else {
      count++;
    }
  }
  return count;
}

/** Sum word count across all nodes. */
function totalWordCount(tree: Chapter[]): number {
  return tree.reduce((sum, node) => sum + mockWordCount(node), 0);
}

/** Format word count for display. */
function formatTotal(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}w`;
  }
  return n.toLocaleString();
}

const MIN_TREE_HEIGHT = 300;

export const BookTocEditor = forwardRef<
  BookTocEditorHandle,
  BookTocEditorProps
>(({ bookTocTree, bookUnitId, bookRating, onDownloadJSON }, ref) => {
  const { t } = useTranslation(["book", "common"]);
  const treeRef = useRef<TreeApi<Chapter> | null>(null);
  const [treeData, setTreeData] = useState<Chapter[]>([]);
  const [treeSize, setTreeSize] = useState({
    width: 0,
    height: MIN_TREE_HEIGHT,
  });
  const treeAreaRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const treeAreaCallbackRef = useCallback((el: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    treeAreaRef.current = el;
    if (!el) return;

    const measure = () => {
      const nextSize = {
        width: el.clientWidth,
        height: Math.max(MIN_TREE_HEIGHT, el.clientHeight),
      };
      setTreeSize((current) => {
        if (
          current.width === nextSize.width &&
          current.height === nextSize.height
        ) {
          return current;
        }
        return nextSize;
      });
    };
    measure();

    resizeObserverRef.current = new ResizeObserver(measure);
    resizeObserverRef.current.observe(el);
  }, []);
  const [contextMenu, setContextMenu] = useState<ChapterContextMenuState>(null);
  const [createChapterDialog, setCreateChapterDialog] = useState(false);
  const [currentEditParentId, setCurrentEditParentId] = useState<
    string | number | null
  >(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSortingMode, setIsSortingMode] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRatingOpen, setBulkRatingOpen] = useState(false);
  const [bulkRating, setBulkRating] = useState<ContentRating>("GENERAL");

  // Edit chapter dialog state
  const [editDialogChapter, setEditDialogChapter] = useState<Chapter | null>(
    null,
  );

  // Move-to-parent dialog state
  const [moveDialogChapter, setMoveDialogChapter] = useState<Chapter | null>(
    null,
  );

  const updateContentStructureMutation =
    bookMutations.useUpdateContentStructure();
  const updateChapterMutation = chapterMutations.useUpdate();
  const ensureChapterUnit = useEnsureChapterUnit(bookUnitId);
  const queryClient = useQueryClient();
  const { show: showAlert } = useAlertStore();
  const navigate = useNavigate();

  useImperativeHandle(ref, () => ({
    expandAll: () => treeRef.current?.openAll(),
    collapseAll: () => treeRef.current?.closeAll(),
  }));

  useEffect(() => {
    setTreeData(bookTocTree);
  }, [bookTocTree]);

  const onMove: MoveHandler<Chapter> = useCallback(
    ({ dragIds, parentId, index }) => {
      setTreeData((current) => {
        const removed: Chapter[] = [];
        const withoutDragged = findAndRemove(
          current,
          dragIds,
          removed,
        ) as Chapter[];
        return findAndInsert(
          withoutDragged,
          parentId,
          index,
          removed,
        ) as Chapter[];
      });
    },
    [],
  );

  const onRename: RenameHandler<Chapter> = useCallback(({ id, name }) => {
    setTreeData(
      (current) => findAndEdit(current, String(id), name) as Chapter[],
    );
  }, []);

  const onDelete: DeleteHandler<Chapter> = useCallback(({ ids }) => {
    setTreeData((current) => findAndDelete(current, ids) as Chapter[]);
  }, []);

  async function saveTree(data: Chapter[]) {
    try {
      await updateContentStructureMutation.mutateAsync({
        bookUnitId,
        nodes: serializeBookToc(data, bookRating),
      });
    } catch (error) {
      showAlert(`Failed to save: ${error}`);
    }
  }

  function handleCreate({
    parentId,
    newNode,
  }: {
    parentId: string | number;
    newNode: Chapter;
  }) {
    let updated: Chapter[];
    if (parentId) {
      updated = findAndAddChild(treeData, parentId, newNode) as Chapter[];
    } else {
      updated = [...treeData, newNode];
    }
    setTreeData(updated);
    void saveTree(updated);
  }

  function handlePreCreate(parentId: string | number | null) {
    setCreateChapterDialog(true);
    setCurrentEditParentId(parentId);
  }

  /** One-click new chapter: insert at last non-leaf, enter rename mode. */
  function handleQuickCreate() {
    const parentId = findLastNonLeafId(treeData);
    if (parentId !== null) {
      handlePreCreate(parentId);
    } else {
      handlePreCreate(null);
    }
  }

  /** Open the edit dialog for a chapter. */
  const handleEditChapter = useCallback((chapter: Chapter) => {
    setEditDialogChapter(chapter);
  }, []);

  /** Navigate to the chapter content editor page. */
  const handleNavigateToChapter = useCallback(
    async (chapter: Chapter) => {
      const contentUnitId = contentUnitIdForNode(chapter);
      if (!contentUnitId && !chapter.nodeId) {
        showAlert(
          "Cannot open a chapter before the table of contents is saved.",
        );
        return;
      }
      const chapterUnitId = await ensureChapterUnit({
        title: chapter.title,
        contentUnitId,
        nodeId: chapter.nodeId,
      });
      navigate({
        to: "/book/$bookId/edit/$chapterId",
        params: { bookId: bookUnitId, chapterId: chapterUnitId },
      });
    },
    [ensureChapterUnit, navigate, bookUnitId, showAlert],
  );

  /** Save edits from the edit dialog (title rename + mock status). */
  const handleEditSave = useCallback(
    (update: { title: string; status: string; rating: ContentRating }) => {
      setTreeData(
        (current) =>
          findAndEdit(
            current,
            String(editDialogChapter!.id),
            update.title,
          ) as Chapter[],
      );
      // MOCK: rating update persists via chapter update API here (handled by caller in production)
      void update.rating;
    },
    [editDialogChapter],
  );

  /** Open the move-to-parent dialog. */
  const handleMoveToParent = useCallback((chapter: Chapter) => {
    setMoveDialogChapter(chapter);
  }, []);

  /** Confirm moving a node to a new parent. */
  const handleMoveConfirm = useCallback(
    (targetParentId: string | number | null) => {
      if (!moveDialogChapter || targetParentId === null) return;
      setTreeData((current) => {
        const removed: Chapter[] = [];
        const withoutNode = findAndRemove(
          current,
          [String(moveDialogChapter.id)],
          removed,
        ) as Chapter[];
        if (removed.length === 0) return current;
        return findAndAddChild(
          withoutNode,
          targetParentId,
          removed[0],
        ) as Chapter[];
      });
    },
    [moveDialogChapter],
  );

  const onToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const Node = useMemo(
    () =>
      createBookTocEditorNode({
        setContextMenu,
        treeRef,
        onEditChapter: handleEditChapter,
        onNavigateToChapter: handleNavigateToChapter,
        isSortingMode,
        bookRating,
        isSelectionMode,
        selectedIds,
        onToggleSelect,
      }),
    [
      handleEditChapter,
      handleNavigateToChapter,
      isSortingMode,
      bookRating,
      isSelectionMode,
      selectedIds,
      onToggleSelect,
    ],
  );

  /** Bulk-edit: set rating for only the selected leaf chapters, then save. */
  async function applyBulkRating(rating: ContentRating) {
    const ids = selectedIds;
    const materializedChapterIds: string[] = [];
    function walk(nodes: Chapter[]): Chapter[] {
      return nodes.map((node) => {
        const next: Chapter = { ...node };
        if (node.children) {
          next.children = walk(node.children);
          return next;
        }
        if (ids.has(String(node.id))) {
          const contentUnitId = contentUnitIdForNode(node);
          if (contentUnitId) {
            materializedChapterIds.push(contentUnitId);
          }
          next.rating = rating;
        }
        return next;
      });
    }
    const updated = walk(treeData);
    await Promise.all(
      [...new Set(materializedChapterIds)].map((unitId) =>
        updateChapterMutation.mutateAsync({
          unitId,
          input: { rating },
        }),
      ),
    );
    setTreeData(updated);
    await saveTree(updated);
    setBulkRatingOpen(false);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }

  /** Resync: recompute index overrides from current materialized chapter ratings. */
  async function handleResyncOverrides() {
    const ratingByChapterId = new Map<string, ContentRating | undefined>();

    async function collect(nodes: Chapter[]) {
      for (const node of nodes) {
        const contentUnitId = contentUnitIdForNode(node);
        if (contentUnitId && !ratingByChapterId.has(contentUnitId)) {
          const chapter = await queryClient.ensureQueryData(
            chapterDetailQuery(contentUnitId),
          );
          ratingByChapterId.set(
            contentUnitId,
            chapter.rating as ContentRating | undefined,
          );
        }
        if (node.children) await collect(node.children);
      }
    }

    function rewrite(nodes: Chapter[]): Chapter[] {
      return nodes.map((node) => {
        const next: Chapter = { ...node };
        if (node.children) {
          next.children = rewrite(node.children);
        }
        const contentUnitId = contentUnitIdForNode(node);
        if (contentUnitId) {
          const chapterRating = ratingByChapterId.get(contentUnitId);
          if (chapterRating === undefined || chapterRating === bookRating) {
            delete next.rating;
          } else {
            next.rating = chapterRating;
          }
        } else if (next.rating === bookRating) {
          delete next.rating;
        }
        return next;
      });
    }

    await collect(treeData);
    const updated = rewrite(treeData);
    setTreeData(updated);
    await saveTree(updated);
  }

  const chapterCount = useMemo(() => countChapters(treeData), [treeData]);
  const wordCount = useMemo(() => totalWordCount(treeData), [treeData]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <BookTocEditorToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onExpandAll={() => treeRef.current?.openAll()}
        onCollapseAll={() => treeRef.current?.closeAll()}
        onNewChapter={handleQuickCreate}
        isSortingMode={isSortingMode}
        onToggleSortingMode={() => setIsSortingMode((v) => !v)}
        isSelectionMode={isSelectionMode}
        onToggleSelectionMode={() => {
          setIsSelectionMode((v) => {
            if (v) setSelectedIds(new Set());
            return !v;
          });
        }}
        selectedCount={selectedIds.size}
        onBulkSetRating={() => setBulkRatingOpen(true)}
        onResyncOverrides={() => void handleResyncOverrides()}
      />

      {/* Tree area — flex-1 fills remaining space; min-h provides scroll fallback */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: tree container */}
      <div
        ref={treeAreaCallbackRef}
        role="presentation"
        className="flex-1 min-h-0 overflow-hidden"
        style={{ minHeight: MIN_TREE_HEIGHT }}
        onClick={() => setContextMenu(null)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Escape") setContextMenu(null);
        }}
      >
        {treeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <p className="text-sm">{t("book:edit_no_chapters_yet")}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => handlePreCreate(null)}
            >
              {t("book:edit_create_first_chapter")}
            </Button>
          </div>
        ) : (
          <Tree<Chapter>
            ref={treeRef}
            data={treeData}
            onMove={onMove}
            onRename={onRename}
            onDelete={onDelete}
            width={treeSize.width}
            height={treeSize.height}
            indent={0}
            rowHeight={LEAF_ROW_HEIGHT}
            disableDrag={!isSortingMode}
            disableDrop={!isSortingMode}
            idAccessor={(node) => node.occurrenceId ?? String(node.id)}
            searchTerm={searchTerm}
            searchMatch={(node, t) =>
              node.data.title.toLowerCase().includes(t.toLowerCase())
            }
            childrenAccessor="children"
            className="overflow-auto"
          >
            {Node}
          </Tree>
        )}

        {contextMenu && (
          <BookTocContextMenu
            contextMenu={contextMenu}
            setContextMenu={setContextMenu}
            setTreeData={setTreeData}
            handleCreate={handlePreCreate}
            onEditChapter={handleEditChapter}
            onMoveToParent={handleMoveToParent}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between py-3 pb-8 text-sm text-muted-foreground">
        <span>
          {t("book:edit_toc_footer_summary", {
            chapters: chapterCount,
            words: formatTotal(wordCount),
          })}
        </span>
        <div className="flex items-center gap-2">
          {onDownloadJSON && (
            <Button variant="outline" size="sm" onClick={onDownloadJSON}>
              <DownloadIcon className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">JSON</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => saveTree(treeData)}
            disabled={updateContentStructureMutation.isPending}
          >
            <SaveIcon className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">
              {updateContentStructureMutation.isPending
                ? t("common:saving")
                : t("common:save")}
            </span>
          </Button>
        </div>
      </div>

      <CreateChapterDialog
        open={createChapterDialog}
        onClose={() => setCreateChapterDialog(false)}
        handleCreate={handleCreate}
        bookUnitId={bookUnitId}
        bookRating={bookRating}
        currentEditParentId={currentEditParentId}
      />

      <EditChapterDialog
        open={editDialogChapter !== null}
        onClose={() => setEditDialogChapter(null)}
        chapter={editDialogChapter}
        onSave={handleEditSave}
      />

      <MoveToParentDialog
        open={moveDialogChapter !== null}
        onClose={() => setMoveDialogChapter(null)}
        treeData={treeData}
        movingNode={moveDialogChapter}
        onConfirm={handleMoveConfirm}
      />

      <BulkRatingDialog
        open={bulkRatingOpen}
        onClose={() => setBulkRatingOpen(false)}
        count={selectedIds.size}
        value={bulkRating}
        onChange={setBulkRating}
        onConfirm={() => void applyBulkRating(bulkRating)}
      />
    </div>
  );
});

BookTocEditor.displayName = "BookTocEditor";
