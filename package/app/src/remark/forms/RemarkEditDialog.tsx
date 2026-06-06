import { useUpdatePostMutation } from "@rezics/api/post/post";
import {
  mainMarkdownSource,
  markdownContentDoc,
  normalizeLanguage,
  type PostDTO,
  SCORE_MAX,
} from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { RatingInput } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";
import { RootPostTranslationEditor } from "@/post";

interface RemarkEditDialogProps {
  remark: PostDTO;
  open: boolean;
  onClose: () => void;
}

export const RemarkEditDialog: React.FC<RemarkEditDialogProps> = ({
  remark,
  open,
  onClose,
}) => {
  const { t } = useTranslation(["common", "community", "page"]);
  const locale = useLocale();
  const initialRating = (remark.extra as { rating?: number } | null)?.rating;
  const [score, setScore] = useState<number | null>(
    typeof initialRating === "number" ? initialRating : null,
  );
  const [language, setLanguage] = useState(locale);
  const [title, setTitle] = useState(remark.title ?? "");
  const [text, setText] = useState(mainMarkdownSource(remark.content) ?? "");

  const updateMutation = useUpdatePostMutation({
    onSuccess: () => {
      onClose();
    },
  });

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !text.trim()) return;
    const nextExtra = {
      ...(remark.extra ?? {}),
      ...(score !== null ? { rating: score } : {}),
    };
    updateMutation.mutate({
      unitId: remark.unitId,
      input: {
        patch: {
          post: {
            title: trimmedTitle,
            content: markdownContentDoc(text.trim()),
            language,
            extra: nextExtra,
          },
        },
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("common:edit")}</DialogTitle>
        </DialogHeader>
        <div className="pt-2">
          <div className="flex flex-col gap-4">
            <RatingInput
              value={score}
              onChange={setScore}
              max={SCORE_MAX}
              aria-label={t("page:remark_form_rating")}
            />
            <RootPostTranslationEditor
              post={remark}
              language={language}
              defaultLanguage={locale}
              title={title}
              body={text}
              onLanguageChange={(nextLanguage) =>
                setLanguage(normalizeLanguage(nextLanguage) ?? locale)
              }
              onTitleChange={setTitle}
              onBodyChange={setText}
              titlePlaceholder={t("community:post_title_placeholder")}
              disabled={updateMutation.isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common:cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending || !title.trim() || !text.trim()}
          >
            {updateMutation.isPending ? t("common:saving") : t("common:save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
