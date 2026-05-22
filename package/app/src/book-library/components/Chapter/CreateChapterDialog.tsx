import { useAlertStore } from "@app/states/windowAlertStore";
import { useCreateChapterMutation } from "@rezics/api/chapter/chapter.mutations";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
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
import type { Chapter } from "./ChapterArborist";

interface CreateChapterDialogProps {
  open: boolean;
  onClose: () => void;
  bookUnitId: string;
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
  currentEditParentId,
}: CreateChapterDialogProps) {
  const { user } = useUserProfileStore();
  const { show } = useAlertStore();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // Reset form when dialog is opened
  useEffect(() => {
    if (open) {
      setTitle("");
      setContent("");
    }
  }, [open]);

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
      });

      const newNode: Chapter = {
        id: result.unitId,
        title,
      };

      handleCreate({
        parentId: (currentEditParentId ?? "") as string | number,
        newNode,
      });

      onClose();
    } catch (e) {
      // Error already surfaced via onError
      console.error("Create chapter failed", e);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create Chapter</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="chapter-title">章节标题</Label>
            <Input
              id="chapter-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={!title.trim() ? "border-border-error" : ""}
            />
            <p
              className={
                !title.trim()
                  ? "text-sm text-error-text"
                  : "text-sm text-text-secondary"
              }
            >
              {!title.trim() ? "必填" : " "}
            </p>
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
              <div className="text-sm text-error-text mt-2">内容为必填</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
