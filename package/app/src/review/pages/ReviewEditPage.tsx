import { useAlertStore } from "@app/states/windowAlertStore";
import {
  postQueries,
  useDeletePostMutation,
  useUpdatePostMutation,
} from "@rezics/api/post/post";
import { mainMarkdownSource, markdownContentDoc } from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { DeleteButton } from "@rezics/ui/composite/forms/DeleteWrapper.tsx";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { type ReviewEditState, ReviewForm } from "@/review/forms/ReviewForm";
import { Route as reviewEditRoute } from "@/routes/_editor/review/$reviewId/edit";

export function ReviewEditPageContainer() {
  const { t } = useTranslation(["common", "community"]);
  const locale = useLocale();
  const { reviewId } = reviewEditRoute.useParams();
  const { data, isLoading, isError } = useQuery(postQueries.detail(reviewId));
  const navigate = useNavigate();
  const [reviewData, setReviewData] = useState<ReviewEditState>({
    unitId: "",
    contentSource: "",
    _editTitle: "",
    _editRating: 0,
    extra: {},
  });

  useEffect(() => {
    if (data) {
      setReviewData({
        unitId: data.unitId,
        contentSource: mainMarkdownSource(data.content) ?? "",
        _editTitle: data.title ?? "",
        _editRating: (data.extra as any)?.rating ?? 0,
        language: locale,
        extra: (data.extra as Record<string, any>) ?? {},
        targetUnitId: data.targetUnitId,
      });
    }
  }, [data, locale]);

  const { show } = useAlertStore();

  const { mutate, isPending } = useUpdatePostMutation({
    onSuccess: () => {
      show(t("community:review_messages_update_success"));
    },
    onError: (error) => {
      show(String(error));
    },
  });

  const { mutate: deletePostMutation } = useDeletePostMutation({
    onSuccess: () => {
      show(t("community:review_messages_delete_success"));
    },
    onError: (error) => {
      show(String(error));
    },
  });

  function handleSave() {
    if ((reviewData.contentSource?.length ?? 0) < 200) {
      show(t("community:review_validation_min_chars"));
      return;
    }

    if (reviewData._editRating) {
      if (reviewData._editRating > 10 || reviewData._editRating < 0) {
        show(t("community:review_messages_rating_range_error"));
        return;
      }
    }

    const input = {
      patch: {
        post: {
          content: markdownContentDoc(reviewData.contentSource || ""),
          title: reviewData._editTitle || undefined,
          language: reviewData.language ?? locale,
          extra: {
            ...reviewData.extra,
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
        show(t("community:review_messages_delete_success"));
        navigate({ to: `/review/book/${reviewData.targetUnitId ?? ""}` });
      },
      onError: (error) => {
        show(`Review delete failed: ${error}`);
      },
    });
  }

  if (isLoading) {
    return <div>{t("common:loading")}</div>;
  }

  if (isError || !data) {
    return <div>{t("community:review_messages_failed_load")}</div>;
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">
          {t("community:review_edit_title")}
        </h1>
        <ReviewForm
          data={reviewData}
          setData={setReviewData}
          onSubmit={handleSave}
          submitLabel={isPending ? t("common:submitting") : t("common:submit")}
          extraActions={<DeleteButton onDelete={handleDelete} />}
          post={data}
        />
      </div>
    </div>
  );
}
