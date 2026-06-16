import { useAlertStore } from "@app/states/windowAlertStore";
import {
  postQueries,
  useDeletePostMutation,
  useUpdatePostMutation,
} from "@rezics/api/post/post";
import { unitQueries } from "@rezics/api/unit/unit";
import { mainMarkdownSource, markdownContentDoc } from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { DeleteButton } from "@rezics/ui/composite/forms/DeleteWrapper.tsx";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { type ReviewEditState, ReviewForm } from "@/review/forms/ReviewForm";
import { Route as reviewEditRoute } from "@/routes/_editor/review/$reviewId/edit";

/**
 * 评论编辑页面容器 - 从路由参数加载评论数据并显示编辑表单
 *
 * 布局结构：
 * - 移动端 (<640px)：全宽 max-w-4xl，垂直堆叠，mt-4（顶部间距）
 * - 平板 (640-1023px)：mx-auto 中心，max-w-4xl，mt-4
 * - 桌面 (1024-1535px)：mx-auto 中心，max-w-4xl，mt-4
 * - 超宽 (>=1536px)：mx-auto 中心，max-w-4xl，mt-4
 *
 * ASCII 布局示意:
 *
 * All Viewports (centered with max-w-4xl, mt-4)
 * +----------+
 * |TITLE     |
 * +----------+
 * +----------+
 * |FORM      |
 * |...[form] |
 * +----------+
 * +----------+
 * |DELETE    |
 * +----------+
 */
export function ReviewEditPageContainer() {
  const { t } = useTranslation(["common", "community"]);
  const locale = useLocale();
  const { reviewId } = reviewEditRoute.useParams();
  const { data, isLoading, isError } = useQuery(postQueries.detail(reviewId));
  const { data: languageContent, isLoading: isLanguageContentLoading } =
    useQuery(unitQueries.languageContent(reviewId, { appLocale: locale }));
  const navigate = useNavigate();
  const initializedUnitId = useRef<string | null>(null);
  const [reviewData, setReviewData] = useState<ReviewEditState>({
    unitId: "",
    contentSource: "",
    _editTitle: "",
    _editRating: 0,
    extra: {},
  });

  useEffect(() => {
    if (!data || !languageContent) return;
    if (initializedUnitId.current === data.unitId) return;

    setReviewData({
      unitId: data.unitId,
      contentSource: mainMarkdownSource(languageContent.content) ?? "",
      _editTitle: languageContent.title ?? "",
      _editRating: (data.extra as any)?.rating ?? 0,
      language: languageContent.resolvedLanguage ?? locale,
      extra: (data.extra as Record<string, any>) ?? {},
      targetUnitId: data.targetUnitId,
    });
    initializedUnitId.current = data.unitId;
  }, [data, languageContent, locale]);

  const { show } = useAlertStore();

  const { mutate, isPending } = useUpdatePostMutation({
    onSuccess: () => {
      show(t("community:review_messages_update_success"));
      // Navigate back to the review detail page after successful update.
      // 更新成功后导航回评论详情页。
      navigate({
        to: "/review/book/$bookId",
        params: { bookId: reviewData.targetUnitId ?? "" },
      });
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
        navigate({
          to: "/review/book/$bookId",
          params: { bookId: reviewData.targetUnitId ?? "" },
        });
      },
      onError: () => {
        show(t("community:review_messages_delete_failed"));
      },
    });
  }

  if (isLoading || isLanguageContentLoading) {
    return <div>{t("common:loading")}</div>;
  }

  if (isError || !data) {
    return <div>{t("community:review_messages_failed_load")}</div>;
  }

  return (
    <div>
      <div className="w-full max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">
          {t("community:review_edit_title")}
        </h1>
        <ReviewForm
          data={reviewData}
          setData={setReviewData}
          mode="update"
          primaryAction={{
            label: isPending ? t("common:submitting") : t("common:update"),
            onClick: handleSave,
            disabled: isPending,
          }}
          secondaryActions={<DeleteButton onDelete={handleDelete} size="sm" />}
          post={data}
          defaultLanguage={locale}
        />
      </div>
    </div>
  );
}
