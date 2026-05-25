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
import { Spinner } from "@rezics/ui";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Network as AccountTree,
  Ellipsis as MoreHoriz,
  Settings,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EditChapterDialog } from "@/book-edit/components/EditChapterDialog";
import { MoveToParentDialog } from "@/book-edit/components/MoveToParentDialog";
import { withBookContentStructureOccurrences } from "@/book-library/models/bookContentStructurePath";
import { Route as bookEditChapterRoute } from "@/routes/book_/$bookId/edit/$chapterId";
import { Route as bookEditLayoutRoute } from "@/routes/book_/$bookId/edit/route";
import {
  RezicsMarkdownEditor,
  type ViewMode,
} from "@/shared/ui/RezicsMarkdownEditor";
import { useMessage } from "@rezics/i18n/react";
import {
  chapter_metadata,
  chapter_move_volume,
  placeholders_chapter_title,
} from "@rezics/i18n/messages";
const m = {
  chapter_metadata,
  chapter_move_volume,
  placeholders_chapter_title,
};

const i18nMessages = {
  chapter_metadata,
  chapter_move_volume,
  placeholders_chapter_title,
};

function updateContentStructureNodeTitle(
  nodes: BookContentStructureItem[],
  chapterUnitId: string,
  title: string,
): BookContentStructureItem[] {
  return nodes.map((node) => ({
    ...node,
    ...(node.chapterUnitId === chapterUnitId ? { title } : {}),
    ...(node.children
      ? {
          children: updateContentStructureNodeTitle(
            node.children,
            chapterUnitId,
            title,
          ),
        }
      : {}),
  }));
}

/**
 * TODO Chapter List 换成 Tree 模式之后，编辑还没有校验
 */
export const BookEditChapterPage: React.FC = () => {
  const m = useMessage(i18nMessages);
  const { bookId } = bookEditLayoutRoute.useParams();
  const { chapterId } = bookEditChapterRoute.useParams();
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  // Initialize form state from fetched data
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

  const handleSubmit = useCallback(async () => {
    if (isInvalid) return;
    await updateMutation.mutateAsync({
      unitId: chapterId,
      input: {
        title,
        content: markdownContentDoc(content),
      } as any,
    });
    const contentStructure = await queryClient.fetchQuery(
      bookContentStructureQuery(bookId),
    );
    if (contentStructure) {
      updateContentStructureMutation.mutateAsync({
        bookUnitId: bookId,
        nodes: updateContentStructureNodeTitle(
          contentStructure.nodes,
          chapterId,
          title,
        ),
      });
    }
  }, [
    isInvalid,
    updateMutation,
    chapterId,
    title,
    content,
    queryClient,
    updateContentStructureMutation,
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
          placeholder={m.placeholders_chapter_title()}
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
              <Button type="button" size="icon" variant="ghost" {...props}>
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
              {m.chapter_move_volume()}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditDialogOpen(true);
              }}
            >
              <Settings className="w-4 h-4 mr-2" />
              {m.chapter_metadata()}
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
        treeData={bookTocTree}
        movingNode={
          data
            ? {
                id: chapterId,
                chapterUnitId: chapterId,
                occurrenceId: chapterId,
                path: [],
                title,
                children: [],
              }
            : null
        }
        onConfirm={(targetParentId) => {
          // TODO: move chapter to new parent via API
          console.log("Move chapter to:", targetParentId);
        }}
      />
    </div>
  );
};
