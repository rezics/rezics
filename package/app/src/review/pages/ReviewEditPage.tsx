import { useAlertStore } from "@app/states/windowAlertStore";
import {
  postQueries,
  useDeletePostMutation,
  useUpdatePostMutation,
} from "@rezics/api/post/post";
import type { UpdatePostInput } from "@rezics/contract";
import { DeleteButton } from "@rezics/ui/composite/forms/DeleteWrapper.tsx";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "@rezics/i18n/react";
import { ReviewForm, type ReviewEditState } from "@/review/forms/ReviewForm";
import { Route as reviewEditRoute } from "@/routes/_mainLayout/review/$reviewId/edit";

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

  const { mutate: deletePostMutation } = useDeletePostMutation({
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
        <ReviewForm
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
