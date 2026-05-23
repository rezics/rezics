import { useAlertStore } from "@app/states/windowAlertStore";
import {
  postQueries,
  useDeletePostMutation,
  useUpdatePostMutation,
} from "@rezics/api/post/post";
import { DeleteButton } from "@rezics/ui/composite/forms/DeleteWrapper.tsx";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ReviewForm, type ReviewEditState } from "@/review/forms/ReviewForm";
import { Route as reviewEditRoute } from "@/routes/_mainLayout/review/$reviewId/edit";
import * as m from "@rezics/i18n/messages";

export function ReviewEditPageContainer() {
  const { reviewId } = reviewEditRoute.useParams();
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
      show(m.review_messages_update_success());
    },
    onError: (error) => {
      show(String(error));
    },
  });

  const { mutate: deletePostMutation } = useDeletePostMutation({
    onSuccess: () => {
      show(m.review_messages_delete_success());
    },
    onError: (error) => {
      show(String(error));
    },
  });

  function handleSave() {
    if ((reviewData.body?.length ?? 0) < 200) {
      show(m.review_validation_min_chars());
      return;
    }

    if (reviewData._editRating) {
      if (reviewData._editRating > 10 || reviewData._editRating < 0) {
        show(m.review_messages_rating_range_error());
        return;
      }
    }

    const input = {
      patch: {
        post: {
          body: reviewData.body || "",
          extra: {
            ...reviewData.extra,
            title: reviewData._editTitle || undefined,
            rating: reviewData._editRating || 0,
          },
        },
      },
    };

    mutate({ unitId: reviewId, input });
  }

  function handleDelete() {
    deletePostMutation(reviewId, {
      onSuccess: () => {
        show(m.review_messages_delete_success());
        navigate({ to: `/review/book/${reviewData.targetUnitId ?? ""}` });
      },
      onError: (error) => {
        show(`Review delete failed: ${error}`);
      },
    });
  }

  if (isLoading) {
    return <div>{m.common_loading()}</div>;
  }

  if (isError || !data) {
    return <div>{m.review_messages_failed_load()}</div>;
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">{m.review_edit_title()}</h1>
        <ReviewForm
          data={reviewData}
          setData={setReviewData}
          onSubmit={handleSave}
          submitLabel={isPending ? m.common_submitting() : m.common_submit()}
          extraActions={<DeleteButton onDelete={handleDelete} />}
        />
      </div>
    </div>
  );
}
