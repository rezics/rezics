import { useCreatePostMutation } from "@rezics/api/post/post";
import { markdownContentDoc, PostKind, SCORE_MAX } from "@rezics/contract";
import { RatingInput } from "@rezics/ui";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import { Input } from "@rezics/ui/shadcn";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import * as m from "@rezics/i18n/messages";

interface RemarkInlineFormProps {
  bookUnitId: string;
  onSuccess?: () => void;
}

export const RemarkInlineForm: React.FC<RemarkInlineFormProps> = ({
  bookUnitId,
  onSuccess,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const postMutation = useCreatePostMutation();

  const resize = useMemo(
    () => ({ height: 220, minHeight: 150, maxHeight: 600 }),
    [],
  );

  const reset = useCallback(() => {
    setBody("");
    setScore(null);
    setExpanded(false);
  }, []);

  const handleSubmit = () => {
    const trimmed = body.trim();
    if (!trimmed || postMutation.isPending) return;
    const extra = score !== null ? { rating: score } : undefined;
    postMutation.mutate(
      {
        targetUnitId: bookUnitId,
        kind: PostKind.REMARK,
        content: markdownContentDoc(trimmed),
        ...(extra ? { extra } : {}),
      },
      {
        onSuccess: () => {
          reset();
          onSuccess?.();
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
          placeholder={m.remark_compose_placeholder()}
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
          aria-label={m.remark_form_rating()}
        />
      </div>
      <RezicsMarkdownEditor
        value={body}
        onChange={setBody}
        resize={resize}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        submitLabel={
          postMutation.isPending ? m.common_submitting() : m.remark_submit()
        }
      />
    </div>
  );
};
