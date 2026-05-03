import { useAlertStore } from "@app/states/windowAlertStore";
import { useCreateChapterMutation } from "@rezics/api/chapter/chapter.mutations";
import type { ContentRating } from "@rezics/contract";
import { RatingSelector } from "@rezics/ui";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { useEffect, useMemo, useState } from "react";
import { useUserProfileStore } from "@/user/states";
import type { Chapter } from "./ChapterTreeEditor";

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
  const { user } = useUserProfileStore();
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

    const userId = (user as any)?.unitId as string | undefined;
    if (!userId) {
      show("请先登录");
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        userId,
        title,
        content,
        targetUnitId: bookUnitId,
        rating,
      });

      const newNode: Chapter = {
        id: result.unitId,
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
          <DialogTitle>Create Chapter</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4 border-t border-rezics-color-border-whisper">
          <div className="flex flex-col gap-1">
            <Label htmlFor="create-chapter-title">章节标题</Label>
            <Input
              id="create-chapter-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={!title.trim() ? "border-rezics-color-error-text" : ""}
            />
            {!title.trim() && (
              <p className="text-xs text-rezics-color-error-text">必填</p>
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
              submitLabel={createMutation.isPending ? "创建中..." : "创建"}
            />
            {!content.trim() && (
              <div className="text-sm text-destructive mt-2">内容为必填</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
