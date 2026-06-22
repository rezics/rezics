import { useCreatePostMutation } from "@rezics/api/post/post";
import {
  CONTENT_LANGUAGE_SLUGS,
  languageLabel,
  markdownContentDoc,
  PostKind,
  SCORE_MAX,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { RatingInput } from "@rezics/ui";
import {
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useAutoDetectedAuthoringLanguageState } from "@/shared/hooks/useAuthoringLanguageDefault";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";

interface RemarkInlineFormProps {
  bookUnitId: string;
  onSuccess?: () => void;
}

export interface RemarkInlineFormHandle {
  focus: () => void;
}

/**
 * Inline remark composer：折叠时是一行输入，聚焦后展开评分、标题和正文。
 * 窄屏下所有控件纵向等宽；宽屏保持 `w-full` 由父级决定宽度。
 *
 * Mobile (<640px)
 * +----------------------+
 * | [Write remark input] |
 * | Rating               |
 * | Title input          |
 * | Markdown editor      |
 * +----------------------+
 *
 * Tablet (640px-1023px)
 * +--------------------------------+
 * | [Write remark input full row]  |
 * | Rating / title / editor stack  |
 * +--------------------------------+
 *
 * Desktop (1024px-1535px)
 * +------------------------------------------+
 * | Composer fills overview content column   |
 * +------------------------------------------+
 *
 * Ultra-wide (>=1536px)
 * +------------------------------------------------+
 * | Width remains constrained by book detail shell  |
 * +------------------------------------------------+
 */
export const RemarkInlineForm = forwardRef<
  RemarkInlineFormHandle,
  RemarkInlineFormProps
>(({ bookUnitId, onSuccess }, ref) => {
  const { t } = useTranslation(["common", "community", "page"]);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { language, setLanguage } = useAutoDetectedAuthoringLanguageState({
    text: `${title}\n${body}`,
  });
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
        language,
        title: trimmedTitle,
        content: markdownContentDoc(trimmed),
        ...(extra ? { extra } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t("common:saved"));
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

  useImperativeHandle(ref, () => ({
    focus: handleExpand,
  }));

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
      <div className="flex flex-row flex-wrap items-center gap-2">
        <RatingInput
          value={score}
          onChange={setScore}
          max={SCORE_MAX}
          aria-label={t("page:remark_form_rating")}
        />
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger
            aria-label={t("common:language")}
            className="h-9 w-[9.5rem] max-w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CONTENT_LANGUAGE_SLUGS.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {languageLabel(lang)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
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
        submitDisabled={postMutation.isPending}
        submitLabel={
          postMutation.isPending
            ? t("common:submitting")
            : t("page:remark_submit")
        }
      />
    </div>
  );
});

RemarkInlineForm.displayName = "RemarkInlineForm";

