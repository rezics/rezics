import { SCORE_MAX } from "@rezics/contract";
import { RatingInput } from "@rezics/ui";
import { Input, Label } from "@rezics/ui/shadcn";
import type React from "react";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import { useMessage } from "@rezics/i18n/react";
import {
  review_form_rating,
  review_form_title,
  review_validation_min_chars,
} from "@rezics/i18n/messages";
const m = {
  review_form_rating,
  review_form_title,
  review_validation_min_chars,
};

const i18nMessages = {
  review_form_rating,
  review_form_title,
  review_validation_min_chars,
};

export type ReviewEditState = {
  unitId: string;
  contentSource: string;
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
  const m = useMessage(i18nMessages);
  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="review-title">{m.review_form_title()}</Label>
        <Input
          id="review-title"
          value={data._editTitle || ""}
          onChange={(e) => setData({ ...data, _editTitle: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{m.review_form_rating()}</span>
        <RatingInput
          value={data._editRating > 0 ? data._editRating : null}
          onChange={(value) => setData({ ...data, _editRating: value ?? 0 })}
          max={SCORE_MAX}
          size="lg"
          aria-label={m.review_form_rating()}
        />
      </div>
      <div className="flex-1 min-h-[300px]">
        <RezicsMarkdownEditor
          value={data.contentSource || ""}
          onChange={(value) => setData({ ...data, contentSource: value })}
          onSubmit={onSubmit}
          onCancel={onCancel}
          submitLabel={
            (data.contentSource?.length ?? 0) < 200
              ? `${200 - (data.contentSource?.length ?? 0)} chars remaining`
              : submitLabel
          }
          extraRight={extraActions}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            {data.contentSource?.length ?? 0} / 200 min characters
          </span>
          {(data.contentSource?.length ?? 0) < 200 && (
            <span className="text-xs text-red-500">
              {m.review_validation_min_chars()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
