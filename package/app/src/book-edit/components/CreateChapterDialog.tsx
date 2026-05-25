import { useAlertStore } from "@app/states/windowAlertStore";
import { useCreateChapterMutation } from "@rezics/api/chapter/chapter.mutations";
import { useCurrentUserId } from "@rezics/api/hooks";
import { type ContentRating, markdownContentDoc } from "@rezics/contract";
import {
  book_chapter_content_required,
  book_edit_chapter_title,
  book_edit_create_chapter,
  common_create,
  common_creating,
  common_required,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { RatingSelector } from "@rezics/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { useEffect, useMemo, useState } from "react";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import type { Chapter } from "./BookTocEditor";

const i18nMessages = {
  book_chapter_content_required,
  book_edit_chapter_title,
  book_edit_create_chapter,
  common_create,
  common_creating,
  common_required,
};

interface CreateChapterDialogProps {
  open: boolean;
  onClose: () => void;
  bookUnitId: string;
  bookRating?: ContentRating;
  currentEditParentId: string | number | null;
  handleCreate: ({
    parentId,
    newNode,
  }: {
    parentId: string | number;
    newNode: Chapter;
  }) => void;
}

export function CreateChapterDialog({
  open,
  onClose,
  handleCreate,
  bookUnitId,
  bookRating,
  currentEditParentId,
}: CreateChapterDialogProps) {
  const m = useMessage(i18nMessages);
  const userId = useCurrentUserId();
  const { show } = useAlertStore();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<ContentRating>(bookRating ?? "GENERAL");

  useEffect(() => {
    if (open) {
      setTitle("");
      setContent("");
      setRating(bookRating ?? "GENERAL");
    }
  }, [open, bookRating]);

  const createMutation = useCreateChapterMutation({
    onError: (error) => {
      show(
        `创建章节失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    },
  });

  const isInvalid = useMemo(
    () => !title.trim() || !content.trim(),
    [title, content],
  );

  async function handleSubmit() {
    if (!open) return;
    if (isInvalid) {
      show("标题和内容不能为空");
      return;
    }

    if (!userId) {
      show("请先登录");
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        userId,
        title,
        content: markdownContentDoc(content),
        targetUnitId: bookUnitId,
        rating,
      });

      const newNode: Chapter = {
        id: result.unitId,
        chapterUnitId: result.unitId,
        title,
        rating,
      };

      handleCreate({
        parentId: (currentEditParentId ?? "") as string | number,
        newNode,
      });

      onClose();
    } catch (e) {
      console.error("Create chapter failed", e);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{m.book_edit_create_chapter()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4 border-t border-border-whisper">
          <div className="flex flex-col gap-1">
            <Label htmlFor="create-chapter-title">
              {m.book_edit_chapter_title()}
            </Label>
            <Input
              id="create-chapter-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={!title.trim() ? "border-border-error" : ""}
            />
            {!title.trim() && (
              <p className="text-xs text-error-text">{m.common_required()}</p>
            )}
          </div>
          <div className="max-w-xs">
            <RatingSelector value={rating} onChange={setRating} />
          </div>
          <div className="min-h-[300px]">
            <RezicsMarkdownEditor
              value={content}
              onChange={setContent}
              onSubmit={handleSubmit}
              onCancel={onClose}
              submitLabel={
                createMutation.isPending
                  ? m.common_creating()
                  : m.common_create()
              }
            />
            {!content.trim() && (
              <div className="text-sm text-destructive mt-2">
                {m.book_chapter_content_required()}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
