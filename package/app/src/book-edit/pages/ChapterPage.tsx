import {
  bookContentStructureQuery,
  bookMutations,
} from "@rezics/api/book/book";
import { bookQueries } from "@rezics/api/book/book.queries";
import {
  chapterDetailQuery,
  useUpdateChapterMutation,
} from "@rezics/api/chapter/chapter";
import {
  type BookContentStructureItem,
  mainMarkdownSource,
  markdownContentDoc,
  type UpdateChapterInput,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { ConfirmDialog, Spinner } from "@rezics/ui";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import {
  Network as AccountTree,
  Ellipsis as MoreHoriz,
  Settings,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EditChapterDialog } from "@/book-edit/components/EditChapterDialog";
import { MoveToParentDialog } from "@/book-edit/components/MoveToParentDialog";
import {
  contentUnitIdForNode,
  withBookContentStructureOccurrences,
} from "@/book-library";
import {
  isApiNotFoundError,
  QueryErrorDisplay,
  ResourceNotFoundState,
} from "@/core";
import { Route as bookEditChapterRoute } from "@/routes/_editor/book/$bookId/edit/$chapterId";
import { Route as bookEditLayoutRoute } from "@/routes/_editor/book/$bookId/edit/route";
import {
  RezicsMarkdownEditor,
  type ViewMode,
} from "@/shared/ui/RezicsMarkdownEditor";

/**
 * BookEditChapterPage — markdown editor for individual chapter content.
 * BookEditChapterPage — 单个章节内容的 markdown 编辑器。
 *
 * Displays title input and full-featured markdown editor with dual-mode
 * preview. Responsive layout: single column on mobile, wider container
 * on desktop. Dual-mode expands max-width to 7xl.
 * 显示标题输入和全功能 markdown 编辑器，带有双模式预览。
 * 响应式布局：移动设备上单列，桌面上更宽。
 * 双模式将 max-width 扩展到 7xl。
 *
 * Mobile <640px (write mode):
 * +-----------------------+
 * | Title input (full)    |
 * | border-b border-error |
 * +-----------------------+
 * | Markdown Editor       |
 * | - flex-1 min-h-0      |
 * | - write mode only     |
 * +-----------------------+
 * | Dialogs (modals)      |
 * +- - - - - - - - - - - -+
 *
 * Tablet 640-1023px:
 * +--------------------+
 * | Title + Menu       |
 * | flex items-center  |
 * +--------------------+
 * | Editor (min-h-0)   |
 * | - RezicsMarkdown   |
 * +--------------------+
 * (px-8, pt-4, pb-8)
 *
 * Desktop 1024-1535px (write):
 * +-----------------------+
 * | max-w-4xl centered    |
 * | Title + DropdownMenu  |
 * | flex gap-2 mb-4       |
 * +-----------------------+
 * | flex-1 min-h-0        |
 * | RezicsMarkdownEditor  |
 * +-----------------------+
 * | h-[calc(100vh-5rem)]  |
 * (px-8 centered)
 *
 * Ultra-wide >=1536px (dual):
 * +---------------------------+
 * | max-w-7xl centered        |
 * | Title + DropdownMenu      |
 * | flex gap-2 mb-4           |
 * +---------------------------+
 * | Dual-split editor         |
 * | - write | preview (50/50) |
 * +---------------------------+
 *
 * TODO After switching the Chapter List to Tree mode, editing still lacks validation.
 * TODO Chapter List 换成 Tree 模式之后，编辑还没有校验
 */
export const BookEditChapterPage: React.FC = () => {
  const { t } = useTranslation(["book", "common", "editor"]);
  const { bookId } = bookEditLayoutRoute.useParams();
  const { chapterId } = bookEditChapterRoute.useParams();
  // `$chapterId` is the existing route param name; current logic treats it as
  // the materialized content Unit id for this content-structure node.
  // `$chapterId` 是现有的路由参数名；当前逻辑将其视为该内容结构节点
  // 物化后的 content Unit id。
  const contentUnitId = chapterId;
  const {
    data,
    isPending: isLoading,
    isError,
    error,
  } = useQuery(chapterDetailQuery(contentUnitId));

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("write");

  // Load chapter tree for the move dialog
  // 为移动对话框加载章节树
  const { data: contentStructureData } = useQuery(
    bookQueries.contentStructure(bookId),
  );
  const bookTocTree = useMemo(
    () =>
      contentStructureData?.nodes
        ? withBookContentStructureOccurrences(contentStructureData.nodes)
        : [],
    [contentStructureData],
  );

  // ---- Chapter actions menu ----
  // ---- 章节操作菜单 ----
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  // Initialize form state from fetched data
  // 从获取的数据初始化表单状态
  useEffect(() => {
    if (data) {
      setTitle(data.title || "");
      setContent(mainMarkdownSource(data.content) ?? "");
    }
  }, [data]);

  const updateMutation = useUpdateChapterMutation();
  const queryClient = useQueryClient();
  const updateContentStructureMutation =
    bookMutations.useUpdateContentStructure();

  const isDirty = useMemo(() => {
    if (!data) return false;
    const initialTitle = data.title || "";
    const initialContent = mainMarkdownSource(data.content) ?? "";
    return initialTitle !== title || initialContent !== content;
  }, [data, title, content]);

  const isInvalid = useMemo(() => {
    return !title.trim() || !content.trim();
  }, [title, content]);

  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
    enableBeforeUnload: () => isDirty,
  });

  const handleSubmit = useCallback(async () => {
    if (isInvalid) return;
    // Guard against double-submit from the editor button path
    // 防止从编辑器按钮路径重复提交
    if (updateMutation.isPending || updateContentStructureMutation.isPending)
      return;
    try {
      await updateMutation.mutateAsync({
        unitId: contentUnitId,
        input: {
          title,
          content: markdownContentDoc(content) as UpdateChapterInput["content"],
        },
      });
      const contentStructure = await queryClient.fetchQuery(
        bookContentStructureQuery(bookId),
      );
      if (contentStructure) {
        await updateContentStructureMutation.mutateAsync({
          bookUnitId: bookId,
          nodes: updateContentStructureNodeTitle(
            contentStructure.nodes,
            contentUnitId,
            title,
          ),
        });
      }
    } catch (err) {
      toast.error(
        t("book:chapter_save_failed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }, [
    isInvalid,
    updateMutation,
    contentUnitId,
    title,
    content,
    queryClient,
    updateContentStructureMutation,
    bookId,
    t,
  ]);

  // Ctrl/Cmd+S to save
  // Ctrl/Cmd+S 保存
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSaveHotkey =
        (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (isSaveHotkey) {
        e.preventDefault();
        if (
          !isInvalid &&
          isDirty &&
          !updateMutation.isPending &&
          !updateContentStructureMutation.isPending
        ) {
          handleSubmit();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isInvalid,
    isDirty,
    updateMutation.isPending,
    updateContentStructureMutation.isPending,
    handleSubmit,
  ]);

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center p-16">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full max-w-xl mx-auto p-8">
        {isApiNotFoundError(error) ? (
          <ResourceNotFoundState variant="section" />
        ) : (
          <QueryErrorDisplay
            error={error instanceof Error ? error : new Error(String(error))}
          />
        )}
      </div>
    );
  }

  const isDual = viewMode === "dual";

  return (
    <div
      className={`w-full mx-auto px-8 pt-4 pb-8 flex flex-col h-[calc(100vh-5rem)] transition-all duration-300 ${isDual ? "max-w-7xl" : "max-w-4xl"}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Input
          id="chapter-title"
          placeholder={t("editor:placeholders_chapter_title")}
          className={`flex-1 text-xl font-semibold border-0 border-b shadow-none rounded-none ${
            !title.trim() ? "border-border-error" : "border-border-defined"
          }`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton
            render={(props) => (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("common:more_actions")}
                {...props}
              >
                <MoreHoriz className="w-4 h-4" />
              </Button>
            )}
          />
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                setMoveDialogOpen(true);
              }}
            >
              <AccountTree className="w-4 h-4 mr-2" />
              {t("book:chapter_move_volume")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditDialogOpen(true);
              }}
            >
              <Settings className="w-4 h-4 mr-2" />
              {t("book:chapter_metadata")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 min-h-0">
        <RezicsMarkdownEditor
          value={content}
          onChange={setContent}
          onSubmit={handleSubmit}
          submitDisabled={
            updateMutation.isPending || updateContentStructureMutation.isPending
          }
          onViewModeChange={setViewMode}
          fillHeight
        />
      </div>

      <EditChapterDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        chapter={data ? { id: contentUnitId, title, children: [] } : null}
        onSave={async ({ title: newTitle, status, rating }) => {
          setTitle(newTitle);
          try {
            await updateMutation.mutateAsync({
              unitId: contentUnitId,
              input: { title: newTitle, status, rating },
            });
            toast.success(t("book:chapter_metadata_saved"));
          } catch (err) {
            toast.error(
              t("book:chapter_save_failed", {
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          }
        }}
      />
      <MoveToParentDialog
        open={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        treeData={bookTocTree}
        movingNode={
          data
            ? {
                id: contentUnitId,
                contentUnitId,
                occurrenceId: contentUnitId,
                path: [],
                title,
                children: [],
              }
            : null
        }
        onConfirm={async (targetOccurrenceId) => {
          try {
            // Resolve the selected occurrence id to a contentUnitId
            // 将选中的 occurrence id 解析为 contentUnitId
            const targetCuid =
              targetOccurrenceId != null
                ? findContentUnitIdByOccurrenceId(
                    bookTocTree,
                    String(targetOccurrenceId),
                  )
                : null;
            const structure = await queryClient.fetchQuery(
              bookContentStructureQuery(bookId),
            );
            if (!structure) return;
            const updated = moveNodeInTree(
              structure.nodes,
              contentUnitId,
              targetCuid ?? null,
            );
            await updateContentStructureMutation.mutateAsync({
              bookUnitId: bookId,
              nodes: updated,
            });
            toast.success(t("book:chapter_moved"));
          } catch (err) {
            toast.error(
              t("book:chapter_save_failed", {
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          }
        }}
      />
      <ConfirmDialog
        open={blocker.status === "blocked"}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
        title={t("editor:chapter_unsaved_changes_confirm")}
        confirmLabel={t("common:confirm")}
        cancelLabel={t("common:cancel")}
        variant="destructive"
      />
    </div>
  );
};

/** Resolve a tree occurrence id (e.g. `path:0.1`) to its `contentUnitId`. 将树 occurrence id（如 `path:0.1`）解析为其 `contentUnitId`。 */
interface OccurrenceNode {
  id: string | number;
  contentUnitId?: string;
  children?: OccurrenceNode[];
}
function findContentUnitIdByOccurrenceId(
  nodes: OccurrenceNode[],
  targetId: string,
): string | undefined {
  for (const node of nodes) {
    if (String(node.id) === targetId) return node.contentUnitId;
    if (node.children) {
      const found = findContentUnitIdByOccurrenceId(node.children, targetId);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Move a node (identified by contentUnitId) to a new parent in the content
 * structure tree. Returns a new tree with the node removed from its original
 * position and appended as the last child of the target parent. When
 * targetParentId is null the node is moved to the root level.
 * 在内容结构树中将节点（按 contentUnitId 标识）移到新的父节点下。返回新树，
 * 节点从原位置移除并附加为目标父节点的最后一个子节点。当 targetParentId 为
 * null 时，节点被移到根层级。
 */
function moveNodeInTree(
  nodes: BookContentStructureItem[],
  movingContentUnitId: string,
  targetParentId: string | null,
): BookContentStructureItem[] {
  // Extract the moving node from the tree
  // 从树中提取要移动的节点
  let movingNode: BookContentStructureItem | null = null;
  function extractNode(
    items: BookContentStructureItem[],
  ): BookContentStructureItem[] {
    return items.reduce<BookContentStructureItem[]>((acc, item) => {
      if (contentUnitIdForNode(item) === movingContentUnitId) {
        movingNode = item;
        return acc;
      }
      const filtered = item.children ? extractNode(item.children) : undefined;
      acc.push({ ...item, ...(filtered ? { children: filtered } : {}) });
      return acc;
    }, []);
  }
  const treeWithout = extractNode(nodes);
  if (!movingNode) return nodes;

  // Insert the node under the target parent (or root)
  // 将节点插入目标父节点下（或根层级）
  if (targetParentId == null) {
    return [...treeWithout, movingNode];
  }
  function insertUnder(
    items: BookContentStructureItem[],
  ): BookContentStructureItem[] {
    return items.map((item) => {
      if (contentUnitIdForNode(item) === targetParentId) {
        return {
          ...item,
          children: [...(item.children ?? []), movingNode!],
        };
      }
      if (item.children) {
        return { ...item, children: insertUnder(item.children) };
      }
      return item;
    });
  }
  return insertUnder(treeWithout);
}

function updateContentStructureNodeTitle(
  nodes: BookContentStructureItem[],
  contentUnitId: string,
  title: string,
): BookContentStructureItem[] {
  return nodes.map((node) => ({
    ...node,
    ...(contentUnitIdForNode(node) === contentUnitId ? { title } : {}),
    ...(node.children
      ? {
          children: updateContentStructureNodeTitle(
            node.children,
            contentUnitId,
            title,
          ),
        }
      : {}),
  }));
}
