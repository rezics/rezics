import { TextField } from "@mui/material";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import { RatingWithInput } from "@rezics/ui/primitive/control/rating/Rating.tsx";
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
        <TextField
          id="standard-basic"
          label={t("review.form.title")}
          variant="standard"
          value={data._editTitle || ""}
          onChange={(e) => setData({ ...data, _editTitle: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{t("review.form.rating")}</span>
        <RatingWithInput
          value={data._editRating || 0}
          onChange={(value) => setData({ ...data, _editRating: value ?? 0 })}
          max={10}
          precision={0.5}
          size="large"
          name="score-rating-10"
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
