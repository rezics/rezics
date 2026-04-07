import { useAlertStore } from "@app/state/windowAlertStore.ts";
import { bookMutations } from "@rezics/api/book/book.mutations";
import { Button } from "@rezics/ui/shadcn/button.tsx";
import { Download, Save } from "lucide-react";
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
import { v4 as uuidv4 } from "uuid";
import {
  findAndAddChild,
  findAndDelete,
  findAndEdit,
  findAndInsert,
  findAndRemove,
} from "@/shared/util/arborist-tree";
import { ChapterTreeContextMenu } from "./ChapterTreeContextMenu";
import {
  LEAF_ROW_HEIGHT,
  createChapterTreeEditorNode,
  mockWordCount,
} from "./ChapterTreeEditorNode";
import { ChapterTreeEditorToolbar } from "./ChapterTreeEditorToolbar";
import { CreateChapterDialog } from "./CreateChapterDialog";

/** Chapter tree node structure. */
export type Chapter = {
  id: string | number;
  title: string;
  children?: Chapter[];
};

/** Context menu state. */
export type ChapterContextMenuState = {
  x: number;
  y: number;
  node: NodeApi<Chapter>;
} | null;

/** Imperative handle for parent components. */
export interface ChapterTreeEditorHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

interface ChapterTreeEditorProps {
  chapterTree: Chapter[];
  bookUnitId: string;
  height: number;
  width?: number;
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
  // Also check deeper levels if top-level has no non-leaf
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

export const ChapterTreeEditor = forwardRef<
  ChapterTreeEditorHandle,
  ChapterTreeEditorProps
>(({ chapterTree, bookUnitId, height, width, onDownloadJSON }, ref) => {
  const treeRef = useRef<TreeApi<Chapter> | null>(null);
  const [treeData, setTreeData] = useState<Chapter[]>([]);
  const [contextMenu, setContextMenu] = useState<ChapterContextMenuState>(null);
  const [createChapterDialog, setCreateChapterDialog] = useState(false);
  const [currentEditParentId, setCurrentEditParentId] = useState<
    string | number | null
  >(null);
  const [searchTerm, setSearchTerm] = useState("");

  const updateChapterIndexMutation = bookMutations.useUpdateChapterIndex();
  const { show: showAlert } = useAlertStore();

  useImperativeHandle(ref, () => ({
    expandAll: () => treeRef.current?.openAll(),
    collapseAll: () => treeRef.current?.closeAll(),
  }));

  useEffect(() => {
    setTreeData(chapterTree);
  }, [chapterTree]);

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

  function saveTree(data: Chapter[]) {
    try {
      updateChapterIndexMutation.mutateAsync({
        bookUnitId,
        chaptersIndex: data,
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
    saveTree(updated);
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
      // No non-leaf exists, create at root
      handlePreCreate(null);
    }
  }

  const Node = useMemo(
    () => createChapterTreeEditorNode(setContextMenu, treeRef),
    [],
  );

  const chapterCount = useMemo(() => countChapters(treeData), [treeData]);
  const wordCount = useMemo(() => totalWordCount(treeData), [treeData]);

  return (
    <div className="flex flex-col">
      <ChapterTreeEditorToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onExpandAll={() => treeRef.current?.openAll()}
        onCollapseAll={() => treeRef.current?.closeAll()}
        onNewChapter={handleQuickCreate}
      />

      {/* Tree area */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: tree container */}
      <div
        role="presentation"
        onClick={() => setContextMenu(null)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Escape") setContextMenu(null);
        }}
      >
        {treeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">No chapters yet</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => handlePreCreate(null)}
            >
              Create First Chapter
            </Button>
          </div>
        ) : (
          <Tree<Chapter>
            ref={treeRef}
            data={treeData}
            onMove={onMove}
            onRename={onRename}
            onDelete={onDelete}
            width={width}
            height={height}
            indent={20}
            rowHeight={LEAF_ROW_HEIGHT}
            disableDrag={false}
            disableDrop={false}
            idAccessor="id"
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
          <ChapterTreeContextMenu
            contextMenu={contextMenu}
            setContextMenu={setContextMenu}
            setTreeData={setTreeData}
            handleCreate={handlePreCreate}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 text-sm text-muted-foreground">
        <span>
          {chapterCount} chapters · {formatTotal(wordCount)} words
        </span>
        <div className="flex items-center gap-2">
          {onDownloadJSON && (
            <Button variant="outline" size="sm" onClick={onDownloadJSON}>
              <Download className="size-4" />
              <span className="hidden sm:inline">JSON</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => saveTree(treeData)}
            disabled={updateChapterIndexMutation.isPending}
          >
            <Save className="size-4" />
            <span className="hidden sm:inline">
              {updateChapterIndexMutation.isPending ? "Saving..." : "Save"}
            </span>
          </Button>
        </div>
      </div>

      <CreateChapterDialog
        open={createChapterDialog}
        onClose={() => setCreateChapterDialog(false)}
        handleCreate={handleCreate}
        bookUnitId={bookUnitId}
        currentEditParentId={currentEditParentId}
      />
    </div>
  );
});

ChapterTreeEditor.displayName = "ChapterTreeEditor";
