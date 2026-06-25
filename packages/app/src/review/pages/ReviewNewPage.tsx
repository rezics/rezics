import { useAlertStore } from "@app/states/windowAlertStore";
import { bookQueries } from "@rezics/contract/api/book/book";
import { useCurrentUserId } from "@rezics/contract/api/hooks/useCurrentUserId";
import { getDefaultRealmId } from "@rezics/contract/api/infra/bootstrap";
import { useCreatePostMutation } from "@rezics/contract/api/post/post";
import { useUpsertScoreMutation } from "@rezics/contract/api/score/score";
import {
  markdownContentDoc,
  normalizeContentLanguage,
  PostKind,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { resolveCatalogEntryInteractionContext } from "@/book-library";
import { DraftPublishActions } from "@/draft";
import { policyDenialFromError } from "@/policy";
import { type ReviewEditState, ReviewForm } from "@/review/forms/ReviewForm";
import { useAutoDetectedAuthoringLanguageState } from "@/shared/hooks/useAuthoringLanguageDefault";

/**
 * 新建评论或备注页面 - 允许用户为指定书籍创建新的评论或备注
 *
 * 布局结构：
 * - 移动端 (<640px)：全宽卡片 max-w-4xl，垂直堆叠，mt-4（顶部间距）
 * - 平板 (640-1023px)：mx-auto 中心，max-w-4xl，mt-4
 * - 桌面 (1024-1535px)：mx-auto 中心，max-w-4xl，mt-4
 * - 超宽 (>=1536px)：mx-auto 中心，max-w-4xl，mt-4
 *
 * ASCII 布局示意:
 *
 * Mobile (<640px)          Tablet (640-1023px)      Desktop (1024-1535px)    Ultra-wide (>=1536px)
 * +--+                     +------+                  +----------+              +----------+
 * |TL|                     |TITLE |                  | TITLE    |              | TITLE    |
 * +--+                     +------+                  +----------+              +----------+
 * |BK|                     |BOOK  |                  |BOOK      |              |BOOK      |
 * +--+                     |      |                  |          |              |          |
 * |FM|                     |FORM  |                  |FORM      |              |FORM      |
 * |..                      |      |                  |          |              |          |
 * +--+                     +------+                  +----------+              +----------+
 *
 * TL=Title, BK=BookId, FM=ReviewForm (title, rating, content)
 */
export function ReviewNewPage({ bookUnitId }: { bookUnitId: string }) {
  const { t } = useTranslation(["common", "community", "page"]);
  const search = useRouterState({ select: (s) => s.location.search });
  const searchParams =
    typeof search === "string"
      ? new URLSearchParams(search)
      : new URLSearchParams(search as Record<string, string>);
  const navigate = useNavigate();
  const userId = useCurrentUserId();
  const { data: bookInfo } = useQuery({
    ...bookQueries.detail(bookUnitId),
    enabled: Boolean(bookUnitId),
  });
  const [reviewData, setReviewData] = useState<ReviewEditState>({
    unitId: "",
    contentSource: "",
    _editTitle: "",
    _editRating: 0,
    extra: {},
  });
  const { show } = useAlertStore();
  const kind =
    searchParams.get("tab") === "remark" ? PostKind.REMARK : PostKind.REVIEW;
  const catalogContext = bookInfo
    ? resolveCatalogEntryInteractionContext(bookInfo)
    : null;
  const primaryTargetUnitId = catalogContext?.primaryTargetUnitId ?? bookUnitId;
  const variantUnitId =
    searchParams.get("variantUnitId") ?? catalogContext?.variantUnitId;
  const { language: authoringLanguage } = useAutoDetectedAuthoringLanguageState(
    {
      text: `${reviewData._editTitle}\n${reviewData.contentSource}`,
    },
  );

  const scoreMutation = useUpsertScoreMutation();
  const postMutation = useCreatePostMutation({
    onSuccess: (data) => {
      show(t("community:review_messages_create_success"));
      navigate({ to: "/review/$reviewId", params: { reviewId: data.unitId } });
    },
    onError: (error) => {
      // A recognized policy denial renders inline below; other errors toast.
      // 已识别的策略拒绝会在下方内联渲染；其他错误则以 toast 提示。
      if (!policyDenialFromError(error)) {
        show(
          t("community:review_messages_create_failed", {
            error: String(error),
          }),
        );
      }
    },
  });

  async function handleSave(status: "DRAFT" | "PUBLISHED") {
    if (!userId) {
      show(t("common:please_login_first"));
      return;
    }
    if (!reviewData._editTitle.trim()) {
      show(t("community:review_messages_title_required"));
      return;
    }

    // Drafts may be incomplete; only enforce the length floor on publish.
    // 草稿可能不完整；仅在发布时强制执行长度下限。
    if (
      status === "PUBLISHED" &&
      kind === PostKind.REVIEW &&
      (reviewData.contentSource?.length ?? 0) < 200
    ) {
      show(t("community:review_validation_min_chars"));
      return;
    }

    let scoreEntryId: string | undefined;

    if (reviewData._editRating > 0) {
      try {
        const scoreEntry = await scoreMutation.mutateAsync({
          unitId: bookUnitId,
          realm: getDefaultRealmId() ?? "default",
          value: reviewData._editRating,
        });
        scoreEntryId = scoreEntry.id;
      } catch (err) {
        toast.error(
          t("community:review_messages_score_failed", {
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        return;
      }
    }

    postMutation.mutate({
      targetUnitId: primaryTargetUnitId,
      variantUnitId,
      kind,
      language:
        normalizeContentLanguage(reviewData.language ?? authoringLanguage) ??
        authoringLanguage,
      title: reviewData._editTitle.trim(),
      status,
      content: markdownContentDoc(reviewData.contentSource || ""),
      scoreEntryId,
    });
  }

  const isPending = scoreMutation.isPending || postMutation.isPending;
  const denial = policyDenialFromError(postMutation.error);

  return (
    <div>
      <div className="w-full max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">
          {kind === PostKind.REMARK
            ? t("page:remark_new_title")
            : t("community:review_new_title")}
        </h1>
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="book-unit-id">
            {t("community:excerpt_book_unit_id")}
          </Label>
          <Input
            id="book-unit-id"
            className="w-full"
            value={bookUnitId}
            disabled
          />
        </div>
        <ReviewForm
          data={reviewData}
          setData={setReviewData}
          mode="create"
          primaryAction={{
            label: isPending ? t("common:submitting") : t("common:publish"),
            onClick: () => handleSave("PUBLISHED"),
            disabled: isPending,
          }}
          secondaryActions={
            <DraftPublishActions
              onSaveDraft={() => handleSave("DRAFT")}
              isPending={isPending}
              denial={denial}
            />
          }
          defaultLanguage={authoringLanguage}
        />
      </div>
    </div>
  );
}
