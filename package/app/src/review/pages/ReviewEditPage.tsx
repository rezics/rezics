import { useAlertStore } from "@app/states/windowAlertStore";
import { TextField } from "@mui/material";
import {
  postQueries,
  useDeletePostMutation,
  useUpdatePostMutation,
} from "@rezics/api/post/post";
import type { PostDTO, UpdatePostInput } from "@rezics/contract";
import { DeleteButton } from "@rezics/ui/composite/form/DeleteWrapper.tsx";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import { RatingWithInput } from "@rezics/ui/primitive/control/rating/Rating.tsx";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { reviewEditRoute } from "@/router";

/**
 * ReviewEditPage - now uses PostDTO instead of ReviewResponse.
 * Post body replaces review.content; title and rating stored in post.extra.
 */

// Local editing state with extra fields
type ReviewEditState = {
  unitId: string;
  body: string;
  _editTitle: string;
  _editRating: number;
  extra: Record<string, any>;
  targetUnitId?: string | null;
};

interface ReviewEditPageProps {
  data: ReviewEditState;
  setData: (data: ReviewEditState) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  extraActions?: React.ReactNode;
}

export function ReviewEditPage({
  data,
  setData,
  onSubmit,
  onCancel,
  submitLabel,
  extraActions,
}: ReviewEditPageProps) {
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

export function ReviewEditPageContainer() {
  const { reviewId } = reviewEditRoute.useParams();
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery(postQueries.detail(reviewId));
  const navigate = useNavigate();
  const [reviewData, setReviewData] = useState<ReviewEditState>({
    unitId: "",
    body: "",
    _editTitle: "",
    _editRating: 0,
    extra: {},
  });

  useEffect(() => {
    if (data) {
      setReviewData({
        unitId: data.unitId,
        body: data.body ?? "",
        _editTitle: (data.extra as any)?.title ?? "",
        _editRating: (data.extra as any)?.rating ?? 0,
        extra: (data.extra as Record<string, any>) ?? {},
        targetUnitId: data.targetUnitId,
      });
    }
  }, [data]);

  const { show } = useAlertStore();

  const { mutate, isPending } = useUpdatePostMutation({
    onSuccess: () => {
      show(t("review.messages.update_success"));
    },
    onError: (error) => {
      show(String(error));
    },
  });

  const { mutate: deletePostMutation, isPending: _isDeleting } =
    useDeletePostMutation({
      onSuccess: () => {
        show(t("review.messages.delete_success"));
      },
      onError: (error) => {
        show(String(error));
      },
    });

  function handleSave() {
    if ((reviewData.body?.length ?? 0) < 200) {
      show(
        t("review.validation.min_chars", {
          defaultValue: "Reviews must be at least 200 characters",
        }),
      );
      return;
    }

    if (reviewData._editRating) {
      if (reviewData._editRating > 10 || reviewData._editRating < 0) {
        show(t("review.messages.rating_range_error"));
        return;
      }
    }

    const input: UpdatePostInput = {
      body: reviewData.body || "",
      extra: {
        ...reviewData.extra,
        title: reviewData._editTitle || undefined,
        rating: reviewData._editRating || 0,
      },
    };

    mutate({ unitId: reviewId, input });
  }

  function handleDelete() {
    deletePostMutation(reviewId, {
      onSuccess: () => {
        show(t("review.messages.delete_success"));
        navigate({ to: `/review/book/${reviewData.targetUnitId ?? ""}` });
      },
      onError: (error) => {
        show(`Review delete failed: ${error}`);
      },
    });
  }

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  if (isError || !data) {
    return <div>{t("review.messages.failed_load")}</div>;
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">Edit Review</h1>
        <ReviewEditPage
          data={reviewData}
          setData={setReviewData}
          onSubmit={handleSave}
          submitLabel={isPending ? t("common.submitting") : t("common.submit")}
          extraActions={<DeleteButton onDelete={handleDelete} />}
        />
      </div>
    </div>
  );
}
