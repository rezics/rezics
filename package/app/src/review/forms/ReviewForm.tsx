import { type PostDTO, SCORE_MAX } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { RatingInput } from "@rezics/ui";
import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { PostEditorSurface } from "@/post";

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
  setData: Dispatch<SetStateAction<ReviewEditState>>;
  mode?: ReviewFormMode;
  primaryAction?: ReviewFormPrimaryAction;
  secondaryActions?: React.ReactNode;
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  extraActions?: React.ReactNode;
  post?: PostDTO;
  defaultLanguage?: string | null;
}

export function ReviewForm({
  data,
  setData,
  primaryAction,
  secondaryActions,
  onSubmit,
  onCancel,
  submitLabel,
  extraActions,
  post,
  defaultLanguage,
}: ReviewFormProps) {
  const { t } = useTranslation(["community"]);
  const language = data.language ?? defaultLanguage ?? "en";
  const actionLabel =
    (data.contentSource?.length ?? 0) < 200
      ? t("community:review_chars_remaining", {
          count: 200 - (data.contentSource?.length ?? 0),
        })
      : (primaryAction?.label ?? submitLabel);
  const actionSubmit = primaryAction?.onClick ?? onSubmit;
  const actionDisabled = primaryAction?.disabled;
  const actionExtras = secondaryActions ?? extraActions;

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {t("community:review_form_rating")}
        </span>
        <RatingInput
          value={data._editRating > 0 ? data._editRating : null}
          onChange={(value) =>
            setData((current) => ({
              ...current,
              _editRating: value ?? 0,
            }))
          }
          max={SCORE_MAX}
          size="lg"
          aria-label={t("community:review_form_rating")}
        />
      </div>
      <div className="flex-1 min-h-[300px]">
        <PostEditorSurface
          post={post}
          language={language}
          defaultLanguage={defaultLanguage}
          title={data._editTitle || ""}
          body={data.contentSource || ""}
          onLanguageChange={(nextLanguage) =>
            setData((current) => ({ ...current, language: nextLanguage }))
          }
          onTitleChange={(value) =>
            setData((current) => ({ ...current, _editTitle: value }))
          }
          onBodyChange={(value) =>
            setData((current) => ({ ...current, contentSource: value }))
          }
          titlePlaceholder={t("community:post_title_placeholder")}
          onSubmit={actionSubmit}
          onCancel={onCancel}
          submitLabel={actionLabel}
          submitDisabled={actionDisabled}
          extraRight={actionExtras}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {t("community:review_char_count", {
              current: data.contentSource?.length ?? 0,
              min: 200,
            })}
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
