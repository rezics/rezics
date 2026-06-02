import { type PostDTO, SCORE_MAX } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { RatingInput } from "@rezics/ui";
import { Input, Label } from "@rezics/ui/shadcn";
import type React from "react";
import { RootPostTranslationEditor } from "@/post/forms/RootPostTranslationEditor";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";

export type ReviewEditState = {
  unitId: string;
  contentSource: string;
  _editTitle: string;
  _editRating: number;
  language?: string;
  extra: Record<string, any>;
  targetUnitId?: string | null;
};

export type ReviewFormMode = "create" | "update";

export type ReviewFormPrimaryAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

interface ReviewFormProps {
  data: ReviewEditState;
  setData: (data: ReviewEditState) => void;
  mode?: ReviewFormMode;
  primaryAction?: ReviewFormPrimaryAction;
  secondaryActions?: React.ReactNode;
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  extraActions?: React.ReactNode;
  post?: PostDTO;
}

export function ReviewForm({
  data,
  setData,
  mode = "create",
  primaryAction,
  secondaryActions,
  onSubmit,
  onCancel,
  submitLabel,
  extraActions,
  post,
}: ReviewFormProps) {
  const { t } = useTranslation(["community"]);
  const language = data.language ?? "en";
  const actionLabel =
    (data.contentSource?.length ?? 0) < 200
      ? `${200 - (data.contentSource?.length ?? 0)} chars remaining`
      : (primaryAction?.label ?? submitLabel);
  const actionSubmit = primaryAction?.onClick ?? onSubmit;
  const actionDisabled = primaryAction?.disabled;
  const actionExtras = secondaryActions ?? extraActions;

  return (
    <div className="flex flex-col gap-4 mt-2">
      {mode === "update" ? null : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="review-title">
            {t("community:review_form_title")}
          </Label>
          <Input
            id="review-title"
            value={data._editTitle || ""}
            onChange={(e) => setData({ ...data, _editTitle: e.target.value })}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {t("community:review_form_rating")}
        </span>
        <RatingInput
          value={data._editRating > 0 ? data._editRating : null}
          onChange={(value) => setData({ ...data, _editRating: value ?? 0 })}
          max={SCORE_MAX}
          size="lg"
          aria-label={t("community:review_form_rating")}
        />
      </div>
      <div className="flex-1 min-h-[300px]">
        {post ? (
          <RootPostTranslationEditor
            post={post}
            language={language}
            defaultLanguage={data.language ?? "en"}
            title={data._editTitle || ""}
            body={data.contentSource || ""}
            onLanguageChange={(nextLanguage) =>
              setData({ ...data, language: nextLanguage })
            }
            onTitleChange={(value) => setData({ ...data, _editTitle: value })}
            onBodyChange={(value) => setData({ ...data, contentSource: value })}
            titlePlaceholder={t("community:post_title_placeholder")}
            onSubmit={actionSubmit}
            onCancel={onCancel}
            submitLabel={actionLabel}
            submitDisabled={actionDisabled}
            extraRight={actionExtras}
          />
        ) : (
          <RezicsMarkdownEditor
            value={data.contentSource || ""}
            onChange={(value) => setData({ ...data, contentSource: value })}
            onSubmit={actionSubmit}
            onCancel={onCancel}
            submitLabel={actionLabel}
            submitDisabled={actionDisabled}
            extraRight={actionExtras}
          />
        )}
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {data.contentSource?.length ?? 0} / 200 min characters
          </span>
          {(data.contentSource?.length ?? 0) < 200 && (
            <span className="text-xs text-red-500">
              {t("community:review_validation_min_chars")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
