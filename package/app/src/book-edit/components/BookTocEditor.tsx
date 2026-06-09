import { useAlertStore } from "@app/states/windowAlertStore.ts";
import { bookMutations } from "@rezics/api/book/book.mutations";
import { chapterMutations } from "@rezics/api/chapter/chapter.mutations";
import { chapterDetailQuery } from "@rezics/api/chapter/chapter.queries";
import type { ContentRating } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Download as DownloadIcon } from "lucide-react";
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
import {
  type BookContentStructureOccurrence,
  contentUnitIdForNode,
  useEnsureChapterUnit,
} from "@/book-library";
import {
  findAndAddChild,
  findAndDelete,
  findAndEdit,
  findAndInsert,
  findAndRemove,
  insertSiblingAfter,
  moveSiblingFirst,
  moveSiblingLast,
} from "@/shared/utils/arborist-tree";
import {
  clearTreeEditOpLog,
  emptyTreeEditOpLog,
  enqueueTreeEditOp,
  ensureTreeChildren,
  moveTreeNodes,
  TreeEditorFooter,
  TreeMoveToDialog,
  type TreeEditOpLog,
} from "@/tree-edit";
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

/**
 * Chapter tree node structure.
 * 章节树节点结构。
 */
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

/**
 * Context menu state.
 * 右键菜单状态。
 */
export type ChapterContextMenuState = {
  x: number;
  y: number;
  node: NodeApi<Chapter>;
} | null;

/**
 * Imperative handle for parent components.
 * 供父组件使用的命令式句柄。
 */
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

/**
 * Find the last non-leaf node (last volume/section with children).
 * 查找最后一个非叶子节点（最后一个带子节点的卷/分卷）。
 */
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

/**
 * Count all leaf nodes in tree.
 * 统计树中所有叶子节点。
 */
function countChapters(tree: Chapter[]): number {
  let count = 0;
  for (const node of tree) {
    if (node.noContent !== true) count++;
    if (node.children?.length) {
      count += countChapters(node.children);
    }
  }
  return count;
}

/**
 * Sum word count across all nodes.
 * 累加所有节点的字数。
 */
function totalWordCount(tree: Chapter[]): number {
  let total = 0;
  for (const node of tree) {
    if (node.noContent !== true) {
      total += mockWordCount(node);
    }
    if (node.children?.length) {
      total += totalWordCount(node.children);
    }
  }
  return total;
}

/**
 * Format word count for display.
 * 格式化字数用于展示。
 */
function formatTotal(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}w`;
  }
  return n.toLocaleString();
}

const MIN_TREE_HEIGHT = 300;
const TREE_DROP_INDENT = 32;

function collectTreeIds(node: Chapter): string[] {
  return [
    String(node.id),
    ...(node.children?.flatMap((child) => collectTreeIds(child)) ?? []),
  ];
}

function flattenTreeIds(nodes: Chapter[]): string[] {
  return nodes.flatMap((node) => collectTreeIds(node));
}

function findTreeNode(nodes: Chapter[], id: string): Chapter | null {
  for (const node of nodes) {
    if (String(node.id) === id) return node;
    const found = node.children?.length
      ? findTreeNode(node.children, id)
      : null;
    if (found) return found;
  }
  return null;
}

export const BookTocEditor = forwardRef<
  BookTocEditorHandle,
  BookTocEditorProps
>(({ bookTocTree, bookUnitId, bookRating, onDownloadJSON }, ref) => {
  const { t } = useTranslation(["book", "common"]);
  const treeRef = useRef<TreeApi<Chapter> | null>(null);
  const [treeData, setTreeData] = useState<Chapter[]>([]);
  const [savedTreeData, setSavedTreeData] = useState<Chapter[]>([]);
  const [opLog, setOpLog] = useState<TreeEditOpLog>(emptyTreeEditOpLog);
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
  const [lastSelectionAnchorId, setLastSelectionAnchorId] = useState<
    string | null
  >(null);
  const [bulkRatingOpen, setBulkRatingOpen] = useState(false);
  const [bulkRating, setBulkRating] = useState<ContentRating>("GENERAL");
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);

  // Edit chapter dialog state
  // 编辑章节对话框状态
  const [editDialogChapter, setEditDialogChapter] = useState<Chapter | null>(
    null,
  );

  // Move-to-parent dialog state
  // 移动到父节点对话框状态
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
    setSavedTreeData(bookTocTree);
    setOpLog(emptyTreeEditOpLog);
    setSelectedIds(new Set());
    setLastSelectionAnchorId(null);
  }, [bookTocTree]);

  const enqueueOp = useCallback(
    (type: string, targetId?: string, options?: Record<string, unknown>) => {
      setOpLog((current) =>
        enqueueTreeEditOp(current, { type, targetId, options }),
      );
    },
    [],
  );

  const onMove: MoveHandler<Chapter> = ({ dragIds, parentId, index }) => {
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
    enqueueOp("move", dragIds[0], { parentId, index, count: dragIds.length });
  };

  const onRename: RenameHandler<Chapter> = ({ id, name }) => {
    setTreeData(
      (current) => findAndEdit(current, String(id), name) as Chapter[],
    );
    enqueueOp("rename", String(id));
  };

  const onDelete: DeleteHandler<Chapter> = ({ ids }) => {
    setTreeData((current) => findAndDelete(current, ids) as Chapter[]);
    enqueueOp("delete", ids[0], { count: ids.length });
  };

  async function saveTree(data: Chapter[]) {
    try {
      await updateContentStructureMutation.mutateAsync({
        bookUnitId,
        nodes: serializeBookToc(data, bookRating),
      });
      setSavedTreeData(data);
      setOpLog((current) => clearTreeEditOpLog(current));
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
    enqueueOp("addChild", String(parentId || "root"));
  }

  function handlePreCreate(parentId: string | number | null) {
    setCreateChapterDialog(true);
    setCurrentEditParentId(parentId);
  }

  /**
   * One-click new chapter: insert at last non-leaf, enter rename mode.
   * 一键新建章节：插入到最后一个非叶子节点下，并进入重命名模式。
   */
  function handleQuickCreate() {
    const parentId = findLastNonLeafId(treeData);
    if (parentId !== null) {
      handlePreCreate(parentId);
    } else {
      handlePreCreate(null);
    }
  }

  /**
   * Open the edit dialog for a chapter.
   * 打开某章节的编辑对话框。
   */
  const handleEditChapter = useCallback((chapter: Chapter) => {
    setEditDialogChapter(chapter);
  }, []);

  /**
   * Navigate to the chapter content editor page.
   * 跳转到章节内容编辑页面。
   */
  const handleNavigateToChapter = useCallback(
    async (chapter: Chapter) => {
      const contentUnitId = contentUnitIdForNode(chapter);
      if (!contentUnitId && !chapter.nodeId) {
        showAlert(
          "Cannot open a chapter before the table of contents is saved.",
        );
        return;
      }
      const targetContentUnitId = await ensureChapterUnit({
        title: chapter.title,
        contentUnitId,
        nodeId: chapter.nodeId,
      });
      navigate({
        to: "/book/$bookId/edit/$chapterId",
        params: { bookId: bookUnitId, chapterId: targetContentUnitId },
      });
    },
    [ensureChapterUnit, navigate, bookUnitId, showAlert],
  );

  /**
   * Save edits from the edit dialog (title rename + mock status).
   * 保存编辑对话框的改动（标题重命名 + 模拟状态）。
   */
  const handleEditSave = (update: {
    title: string;
    status: string;
    rating: ContentRating;
  }) => {
    setTreeData(
      (current) =>
        findAndEdit(
          current,
          String(editDialogChapter!.id),
          update.title,
        ) as Chapter[],
    );
    // MOCK: rating update persists via chapter update API here (handled by caller in production)
    // MOCK：此处通过章节更新 API 持久化分级改动（生产环境由调用方处理）
    void update.rating;
    enqueueOp("edit", String(editDialogChapter!.id));
  };

  /**
   * Open the move-to-parent dialog.
   * 打开移动到父节点对话框。
   */
  const handleMoveToParent = useCallback((chapter: Chapter) => {
    setMoveDialogChapter(chapter);
  }, []);

  /**
   * Confirm moving a node to a new parent.
   * 确认将节点移动到新的父节点。
   */
  const handleMoveConfirm = (targetParentId: string | number | null) => {
    if (!moveDialogChapter) return;
    setTreeData((current) => {
      const removed: Chapter[] = [];
      const withoutNode = findAndRemove(
        current,
        [String(moveDialogChapter.id)],
        removed,
      ) as Chapter[];
      if (removed.length === 0) return current;
      if (targetParentId === null) {
        return [...withoutNode, removed[0]];
      }
      return findAndAddChild(
        withoutNode,
        targetParentId,
        removed[0],
      ) as Chapter[];
    });
    enqueueOp("moveTo", String(moveDialogChapter.id), {
      parentId: targetParentId,
    });
  };

  const handleCreateChild = useCallback((chapter: Chapter) => {
    handlePreCreate(chapter.id);
  }, []);

  const handleCreateSiblingAfter = useCallback(
    (chapter: Chapter) => {
      const newNode: Chapter = {
        id: `draft-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
        title: "New Chapter",
      };
      setTreeData(
        (current) =>
          insertSiblingAfter(current, chapter.id, newNode) as Chapter[],
      );
      enqueueOp("addSiblingAfter", String(chapter.id));
    },
    [enqueueOp],
  );

  const handleDeleteChapter = useCallback(
    (chapter: Chapter) => {
      setTreeData(
        (current) => findAndDelete(current, [chapter.id]) as Chapter[],
      );
      enqueueOp("delete", String(chapter.id));
    },
    [enqueueOp],
  );

  const handleMoveToFirst = useCallback(
    (chapter: Chapter) => {
      setTreeData(
        (current) => moveSiblingFirst(current, chapter.id) as Chapter[],
      );
      enqueueOp("moveToFirst", String(chapter.id));
    },
    [enqueueOp],
  );

  const handleMoveToLast = useCallback(
    (chapter: Chapter) => {
      setTreeData(
        (current) => moveSiblingLast(current, chapter.id) as Chapter[],
      );
      enqueueOp("moveToLast", String(chapter.id));
    },
    [enqueueOp],
  );

  const cancelPendingOps = () => {
    setTreeData(savedTreeData);
    setOpLog((current) => clearTreeEditOpLog(current));
    setSelectedIds(new Set());
    setLastSelectionAnchorId(null);
    setBulkMoveDialogOpen(false);
  };

  const onToggleSelect = useCallback(
    (id: string, event?: React.MouseEvent | React.KeyboardEvent) => {
      const flatIds = flattenTreeIds(treeData);
      const currentNode = findTreeNode(treeData, id);
      const idsForCurrentNode = currentNode
        ? collectTreeIds(currentNode)
        : [id];

      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (event?.shiftKey && lastSelectionAnchorId) {
          const anchorIndex = flatIds.indexOf(lastSelectionAnchorId);
          const currentIndex = flatIds.indexOf(id);
          if (anchorIndex >= 0 && currentIndex >= 0) {
            const start = Math.min(anchorIndex, currentIndex);
            const end = Math.max(anchorIndex, currentIndex);
            for (const rangeId of flatIds.slice(start, end + 1)) {
              next.add(rangeId);
            }
            return next;
          }
        }

        const fullySelected = idsForCurrentNode.every((nodeId) =>
          next.has(nodeId),
        );
        for (const nodeId of idsForCurrentNode) {
          if (fullySelected) {
            next.delete(nodeId);
          } else {
            next.add(nodeId);
          }
        }
        return next;
      });
      setLastSelectionAnchorId(id);
    },
    [lastSelectionAnchorId, treeData],
  );

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
        onCreateChild: handleCreateChild,
        onCreateSiblingAfter: handleCreateSiblingAfter,
        onDeleteChapter: handleDeleteChapter,
        onMoveToParent: handleMoveToParent,
        onMoveToFirst: handleMoveToFirst,
        onMoveToLast: handleMoveToLast,
      }),
    [
      handleEditChapter,
      handleNavigateToChapter,
      isSortingMode,
      bookRating,
      isSelectionMode,
      selectedIds,
      onToggleSelect,
      handleCreateChild,
      handleCreateSiblingAfter,
      handleDeleteChapter,
      handleMoveToParent,
      handleMoveToFirst,
      handleMoveToLast,
    ],
  );

  const selectedChapters = useMemo(() => {
    const result: Chapter[] = [];
    const visit = (nodes: Chapter[]) => {
      for (const node of nodes) {
        if (selectedIds.has(String(node.id))) {
          result.push(node);
        }
        if (node.children?.length) visit(node.children);
      }
    };
    visit(treeData);
    return result;
  }, [selectedIds, treeData]);

  const handleBulkMoveConfirm = (targetParentId: string | number | null) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setTreeData(
      (current) =>
        moveTreeNodes(
          current,
          ids,
          targetParentId,
          Number.MAX_SAFE_INTEGER,
        ) as Chapter[],
    );
    enqueueOp("bulkMoveTo", undefined, {
      count: ids.length,
      parentId: targetParentId,
    });
    setBulkMoveDialogOpen(false);
  };

  const handleBulkMoveToEdge = (edge: "first" | "last") => {
    const ids = new Set(selectedIds);
    if (ids.size === 0) return;

    const visit = (nodes: Chapter[]): Chapter[] => {
      const selected: Chapter[] = [];
      const rest: Chapter[] = [];
      for (const node of nodes) {
        const next = node.children?.length
          ? { ...node, children: visit(node.children) }
          : node;
        if (ids.has(String(node.id))) {
          selected.push(next);
        } else {
          rest.push(next);
        }
      }
      return edge === "first" ? [...selected, ...rest] : [...rest, ...selected];
    };

    setTreeData((current) => visit(current));
    enqueueOp(
      edge === "first" ? "bulkMoveToFirst" : "bulkMoveToLast",
      undefined,
      {
        count: ids.size,
      },
    );
  };

  /**
   * Bulk-edit: set rating for selected chapter nodes, including chapters that
   * also own children. Section-only nodes (`noContent`) are structure, not
   * chapter content.
   */
  async function applyBulkRating(rating: ContentRating) {
    const ids = selectedIds;
    const materializedChapterIds: string[] = [];
    function walk(nodes: Chapter[]): Chapter[] {
      return nodes.map((node) => {
        const next: Chapter = { ...node };
        if (ids.has(String(node.id)) && node.noContent !== true) {
          const contentUnitId = contentUnitIdForNode(node);
          if (contentUnitId) {
            materializedChapterIds.push(contentUnitId);
          }
          next.rating = rating;
        }
        if (node.children) {
          next.children = walk(node.children);
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
    enqueueOp("bulkRating", undefined, { count: selectedIds.size });
    await saveTree(updated);
    setBulkRatingOpen(false);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }

  /**
   * Resync: recompute index overrides from current materialized chapter ratings.
   * 重新同步：根据当前已落地章节的分级重新计算索引覆盖项。
   */
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
            if (v) {
              setSelectedIds(new Set());
              setLastSelectionAnchorId(null);
              setBulkMoveDialogOpen(false);
            }
            return !v;
          });
        }}
        selectedCount={selectedIds.size}
        onBulkSetRating={() => setBulkRatingOpen(true)}
        onBulkMoveTo={() => setBulkMoveDialogOpen(true)}
        onBulkMoveToFirst={() => handleBulkMoveToEdge("first")}
        onBulkMoveToLast={() => handleBulkMoveToEdge("last")}
        onResyncOverrides={() => void handleResyncOverrides()}
      />

      {/* Tree area — flex-1 fills remaining space; min-h provides scroll fallback */}
      {/* 树区域 — flex-1 占满剩余空间；min-h 提供滚动兜底 */}
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
            data={ensureTreeChildren(treeData) as Chapter[]}
            onMove={onMove}
            onRename={onRename}
            onDelete={onDelete}
            width={treeSize.width}
            height={treeSize.height}
            indent={TREE_DROP_INDENT}
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
            handleCreate={handlePreCreate}
            onEditChapter={handleEditChapter}
            onMoveToParent={handleMoveToParent}
            onCreateSiblingAfter={handleCreateSiblingAfter}
            onMoveToFirst={handleMoveToFirst}
            onMoveToLast={handleMoveToLast}
            onDeleteChapter={handleDeleteChapter}
          />
        )}
      </div>

      <TreeEditorFooter
        pendingCount={opLog.entries.length}
        saving={updateContentStructureMutation.isPending}
        onCancel={cancelPendingOps}
        onSave={() => saveTree(treeData)}
        summary={t("book:edit_toc_footer_summary", {
          chapters: chapterCount,
          words: formatTotal(wordCount),
        })}
      />
      <div className="flex items-center justify-end pb-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          {onDownloadJSON && (
            <Button variant="outline" size="sm" onClick={onDownloadJSON}>
              <DownloadIcon className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">JSON</span>
            </Button>
          )}
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

      <TreeMoveToDialog
        open={moveDialogChapter !== null}
        title={t("book:chapter_move_dialog_title")}
        onClose={() => setMoveDialogChapter(null)}
        nodes={treeData}
        movingNode={moveDialogChapter}
        getLabel={(node) => node.title}
        onConfirm={handleMoveConfirm}
      />

      <TreeMoveToDialog
        open={bulkMoveDialogOpen}
        title="Move selected to..."
        onClose={() => setBulkMoveDialogOpen(false)}
        nodes={treeData}
        movingNode={null}
        movingNodes={selectedChapters}
        getLabel={(node) => node.title}
        onConfirm={handleBulkMoveConfirm}
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
