import { useAlertStore } from "@app/states/windowAlertStore";
import { useCreateChapterMutation } from "@rezics/api/chapter/chapter.mutations";
import { useCurrentUserId } from "@rezics/api/hooks";
import { markdownContentDoc } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
  const { t } = useTranslation(["auth", "book", "common"]);
  const userId = useCurrentUserId();
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
    if (isInvalid) {
      show(t("book:chapter_title_content_required"));
      return;
    }

    if (!userId) {
      show(t("auth:flow_onboarding_sign_in_first"));
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        userId,
        title,
        content: markdownContentDoc(content),
        targetUnitId: bookUnitId,
      });

      const newNode: Chapter = {
        id: result.unitId,
        contentUnitId: result.unitId,
        occurrenceId: result.unitId,
        path: [],
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
          <DialogTitle>{t("book:edit_create_chapter")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="chapter-title">
              {t("book:edit_chapter_title")}
            </Label>
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
              {!title.trim() ? t("common:required") : " "}
            </p>
          </div>
          <div className="min-h-[300px]">
            <RezicsMarkdownEditor
              value={content}
              onChange={setContent}
              onSubmit={handleSubmit}
              onCancel={onClose}
              submitLabel={
                createMutation.isPending
                  ? t("common:submitting")
                  : t("common:create")
              }
            />
            {!content.trim() && (
              <div className="text-sm text-error-text mt-2">
                {t("book:chapter_content_required")}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
