import { useAlertStore } from "@app/states/windowAlertStore";
import { useCreateChapterMutation } from "@rezics/api/chapter/chapter.mutations";
import { useCurrentUserId } from "@rezics/api/hooks";
import { type ContentRating, markdownContentDoc } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
  const { t } = useTranslation(["book", "common"]);
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
        t("book:chapter_create_failed", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    },
  });

  const isInvalid = useMemo(
    () => !title.trim() || !content.trim(),
    [title, content],
  );

  async function handleSubmit() {
    if (!open) return;
    if (createMutation.isPending) return;
    if (isInvalid) {
      show(t("book:chapter_title_content_required"));
      return;
    }

    if (!userId) {
      show(t("common:route_unauthenticated_title"));
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
        contentUnitId: result.unitId,
        title,
        rating,
      };

      handleCreate({
        parentId: (currentEditParentId ?? "") as string | number,
        newNode,
      });

      onClose();
    } catch {
      // Error already surfaced via the mutation's onError callback.
      // 错误已通过 mutation 的 onError 回调呈现。
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("book:edit_create_chapter")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4 border-t border-border-whisper">
          <div className="flex flex-col gap-1">
            <Label htmlFor="create-chapter-title">
              {t("book:edit_chapter_title")}
            </Label>
            <Input
              id="create-chapter-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={!title.trim() ? "border-border-error" : ""}
            />
            {!title.trim() && (
              <p className="text-xs text-error-text">{t("common:required")}</p>
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
              submitDisabled={createMutation.isPending}
              submitLabel={
                createMutation.isPending
                  ? t("common:creating")
                  : t("common:create")
              }
            />
            {!content.trim() && (
              <div className="text-sm text-destructive mt-2">
                {t("book:chapter_content_required")}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
