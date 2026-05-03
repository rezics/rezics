import { SCORE_MAX } from "@rezics/contract";
import { RatingInput } from "@rezics/ui";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import { Input, Label } from "@rezics/ui/shadcn";
import type React from "react";
import { useTranslation } from "react-i18next";

export type ReviewEditState = {
  unitId: string;
  body: string;
  _editTitle: string;
  _editRating: number;
  extra: Record<string, any>;
  targetUnitId?: string | null;
};

interface ReviewFormProps {
  data: ReviewEditState;
  setData: (data: ReviewEditState) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  extraActions?: React.ReactNode;
}

export function ReviewForm({
  data,
  setData,
  onSubmit,
  onCancel,
  submitLabel,
  extraActions,
}: ReviewFormProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="review-title">{t("review.form.title")}</Label>
        <Input
          id="review-title"
          value={data._editTitle || ""}
          onChange={(e) => setData({ ...data, _editTitle: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{t("review.form.rating")}</span>
        <RatingInput
          value={data._editRating > 0 ? data._editRating : null}
          onChange={(value) =>
            setData({ ...data, _editRating: value ?? 0 })
          }
          max={SCORE_MAX}
          size="lg"
          aria-label={t("review.form.rating")}
        />
      </div>
      <div className="flex-1 min-h-[300px]">
        <RezicsMarkdownEditor
          value={data.body || ""}
          onChange={(value) => setData({ ...data, body: value })}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitLabel={
            (data.body?.length ?? 0) < 200
              ? `${200 - (data.body?.length ?? 0)} chars remaining`
              : submitLabel
          }
          extraRight={extraActions}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {data.body?.length ?? 0} / 200 min characters
          </span>
          {(data.body?.length ?? 0) < 200 && (
            <span className="text-xs text-red-500">
              {t("review.validation.min_chars", {
                defaultValue: "Reviews must be at least 200 characters",
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
