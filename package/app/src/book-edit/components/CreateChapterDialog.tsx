import { useAlertStore } from "@app/states/windowAlertStore";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { useCreateChapterMutation } from "@rezics/api/chapter/chapter.mutations";
import type { ContentRating } from "@rezics/contract";
import { RatingSelector } from "@rezics/ui";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Create Chapter</DialogTitle>
      <DialogContent dividers>
        <div className="space-y-4">
          <TextField
            label="章节标题"
            fullWidth
            variant="filled"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={!title.trim()}
            helperText={!title.trim() ? "必填" : " "}
          />
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
