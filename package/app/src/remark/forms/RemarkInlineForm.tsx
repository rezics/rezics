import { useCreatePostMutation } from "@rezics/api/post/post";
import { markdownContentDoc, PostKind, SCORE_MAX } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { RatingInput } from "@rezics/ui";
import { Input } from "@rezics/ui/shadcn";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuthoringLanguageDefault } from "@/shared/hooks/useAuthoringLanguageDefault";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";

interface RemarkInlineFormProps {
  bookUnitId: string;
  onSuccess?: () => void;
}

export const RemarkInlineForm: React.FC<RemarkInlineFormProps> = ({
  bookUnitId,
  onSuccess,
}) => {
  const { t } = useTranslation(["common", "community", "page"]);
  const authoringLanguage = useAuthoringLanguageDefault();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const postMutation = useCreatePostMutation();

  const resize = useMemo(
    () => ({ height: 220, minHeight: 150, maxHeight: 600 }),
    [],
  );

  const reset = () => {
    setBody("");
    setTitle("");
    setScore(null);
    setExpanded(false);
  };

  const handleSubmit = () => {
    const trimmed = body.trim();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !trimmed || postMutation.isPending) return;
    const extra = score !== null ? { rating: score } : undefined;
    postMutation.mutate(
      {
        targetUnitId: bookUnitId,
        kind: PostKind.REMARK,
        language: authoringLanguage,
        title: trimmedTitle,
        content: markdownContentDoc(trimmed),
        ...(extra ? { extra } : {}),
      },
      {
        onSuccess: () => {
          toast.success("Saved.");
          reset();
          onSuccess?.();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  const handleCancel = () => {
    if (body.trim().length > 0) return;
    reset();
  };

  const handleExpand = () => {
    setExpanded(true);
    queueMicrotask(() => {
      const el = wrapperRef.current?.querySelector<HTMLElement>(
        "textarea, [contenteditable='true']",
      );
      el?.focus();
    });
  };

  if (!expanded) {
    return (
      <div ref={wrapperRef}>
        <Input
          placeholder={t("page:remark_compose_placeholder")}
          onFocus={handleExpand}
          onClick={handleExpand}
        />
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <RatingInput
          value={score}
          onChange={setScore}
          max={SCORE_MAX}
          aria-label={t("page:remark_form_rating")}
        />
      </div>
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("community:post_title_placeholder")}
        disabled={postMutation.isPending}
      />
      <RezicsMarkdownEditor
        value={body}
        onChange={setBody}
        resize={resize}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        submitLabel={
          postMutation.isPending
            ? t("common:submitting")
            : t("page:remark_submit")
        }
      />
    </div>
  );
};
