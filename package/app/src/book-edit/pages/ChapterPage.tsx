import { bookChapterIndexQuery, bookMutations } from "@rezics/api/book/book";
import { bookQueries } from "@rezics/api/book/book.queries";
import {
  chapterDetailQuery,
  useUpdateChapterMutation,
} from "@rezics/api/chapter/chapter";
import { Spinner } from "@rezics/ui";
import { RezicsMarkdownEditor, type ViewMode } from "@rezics/ui/editor";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { EditChapterDialog } from "@/book-edit/components/EditChapterDialog";
import { MoveToParentDialog } from "@/book-edit/components/MoveToParentDialog";
import { bookEditChapterRoute, bookEditLayoutRoute } from "@/router";
import { Network as AccountTree, Ellipsis as MoreHoriz, Settings } from "lucide-react";

/**
 * TODO Chapter List 换成 Tree 模式之后，编辑还没有校验
 */
export const BookEditChapterPage: React.FC = () => {
  const { bookId } = bookEditLayoutRoute.useParams();
  const { chapterId } = bookEditChapterRoute.useParams();
  const { t } = useTranslation();

  // Load chapter detail
  const {
    data,
    isPending: isLoading,
    isError,
    error,
  } = useQuery(chapterDetailQuery(chapterId));

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("write");

  // Load chapter tree for the move dialog
  const { data: chapterIndexData } = useQuery(bookQueries.chapterIndex(bookId));
  const chapterTree = useMemo(
    () => chapterIndexData?.index ?? [],
    [chapterIndexData],
  );

  // ---- Chapter actions menu ----
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  // Initialize form state from fetched data
  useEffect(() => {
    if (data) {
      setTitle((data as any).title || "");
      setContent((data as any).content || "");
    }
  }, [data]);

  const updateMutation = useUpdateChapterMutation();
  const queryClient = useQueryClient();
  const updateChapterIndexMutation = bookMutations.useUpdateChapterIndex();

  const isDirty = useMemo(() => {
    if (!data) return false;
    const initialTitle = (data as any).title || "";
    const initialContent = (data as any).content || "";
    return initialTitle !== title || initialContent !== content;
  }, [data, title, content]);

  const isInvalid = useMemo(() => {
    return !title.trim() || !content.trim();
  }, [title, content]);

  const handleSubmit = useCallback(async () => {
    if (isInvalid) return;
    await updateMutation.mutateAsync({
      unitId: chapterId,
      input: {
        title,
        content,
      } as any,
    });
    const chapterIndex = await queryClient.fetchQuery(
      bookChapterIndexQuery(bookId),
    );
    if (chapterIndex) {
      console.log(chapterIndex);
      const newChapterIndex = { ...chapterIndex };
      newChapterIndex.index = {
        ...newChapterIndex.index,
        [chapterId]: {
          id: chapterId,
          title,
          content,
        },
      };
      updateChapterIndexMutation.mutateAsync({
        bookUnitId: bookId,
        chaptersIndex: newChapterIndex,
      });
    }
  }, [
    isInvalid,
    updateMutation,
    chapterId,
    title,
    content,
    queryClient,
    updateChapterIndexMutation,
    bookId,
  ]);

  // Ctrl/Cmd+S to save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSaveHotkey =
        (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (isSaveHotkey) {
        e.preventDefault();
        if (!isInvalid && isDirty && !updateMutation.isPending) {
          handleSubmit();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isInvalid, isDirty, updateMutation.isPending, handleSubmit]);

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center p-16">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-xl mx-auto p-8 text-destructive">
        {(error as Error)?.message || "Failed to load chapter"}
      </div>
    );
  }

  const isDual = viewMode === "dual";

  return (
    <div
      className={`mx-auto px-8 pt-4 pb-8 flex flex-col h-[calc(100vh-5rem)] transition-all duration-300 ${isDual ? "max-w-7xl" : "max-w-4xl"}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Input
          id="chapter-title"
          placeholder={t("placeholders.chapter_title", "章节标题")}
          className={`flex-1 text-xl font-semibold border-0 border-b shadow-none rounded-none ${
            !title.trim()
              ? "border-border-error"
              : "border-border-defined"
          }`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon" variant="ghost">
              <MoreHoriz className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                setMoveDialogOpen(true);
              }}
            >
              <AccountTree className="w-4 h-4 mr-2" />
              {t("chapter.move_volume", "移动至分卷")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditDialogOpen(true);
              }}
            >
              <Settings className="w-4 h-4 mr-2" />
              {t("chapter.metadata", "章节设置")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 min-h-0">
        <RezicsMarkdownEditor
          value={content}
          onChange={setContent}
          onSubmit={handleSubmit}
          onViewModeChange={setViewMode}
          fillHeight
        />
      </div>

      <EditChapterDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        chapter={data ? { id: chapterId, title, children: [] } : null}
        onSave={({ title: newTitle, status }) => {
          setTitle(newTitle);
          // TODO: persist status change via API
          console.log("Chapter status update:", status);
        }}
      />
      <MoveToParentDialog
        open={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        treeData={chapterTree}
        movingNode={data ? { id: chapterId, title, children: [] } : null}
        onConfirm={(targetParentId) => {
          // TODO: move chapter to new parent via API
          console.log("Move chapter to:", targetParentId);
        }}
      />
    </div>
  );
};
