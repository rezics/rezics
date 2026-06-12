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
import { EditChapterDialog } from "@/book-edit/components/EditChapterDialog";
import { MoveToParentDialog } from "@/book-edit/components/MoveToParentDialog";
import {
  contentUnitIdForNode,
  withBookContentStructureOccurrences,
} from "@/book-library";
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
      setTitle((data as any).title || "");
      setContent(mainMarkdownSource((data as any).content) ?? "");
    }
  }, [data]);

  const updateMutation = useUpdateChapterMutation();
  const queryClient = useQueryClient();
  const updateContentStructureMutation =
    bookMutations.useUpdateContentStructure();

  const isDirty = useMemo(() => {
    if (!data) return false;
    const initialTitle = (data as any).title || "";
    const initialContent = mainMarkdownSource((data as any).content) ?? "";
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
    await updateMutation.mutateAsync({
      unitId: contentUnitId,
      input: {
        title,
        content: markdownContentDoc(content),
      } as any,
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
  }, [
    isInvalid,
    updateMutation,
    contentUnitId,
    title,
    content,
    queryClient,
    updateContentStructureMutation,
    bookId,
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
      <div className="w-full max-w-xl mx-auto p-8 text-destructive">
        {(error as Error)?.message || "Failed to load chapter"}
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
        onSave={({ title: newTitle, status: _status }) => {
          setTitle(newTitle);
          // TODO: persist status change via API
          // TODO: 通过 API 持久化状态变更
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
        onConfirm={(_targetParentId) => {
          // TODO: move chapter to new parent via API
          // TODO: 通过 API 将章节移动到新的父节点
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
