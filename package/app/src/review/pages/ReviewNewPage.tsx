import { useAlertStore } from "@app/states/windowAlertStore";
import { bookQueries } from "@rezics/api/book/book";
import { useCurrentUserId } from "@rezics/api/hooks";
import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import { useCreatePostMutation } from "@rezics/api/post/post";
import { useUpsertScoreMutation } from "@rezics/api/score/score";
import { markdownContentDoc, PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { resolveCatalogEntryInteractionContext } from "@/book-library/models/catalogEntryContext";
import { DraftPublishActions } from "@/draft";
import { policyDenialFromError } from "@/policy";
import { type ReviewEditState, ReviewForm } from "@/review/forms/ReviewForm";
import { useAuthoringLanguageDefault } from "@/shared/hooks/useAuthoringLanguageDefault";

export function ReviewNewPage({ bookUnitId }: { bookUnitId: string }) {
  const { t } = useTranslation(["common", "community", "page"]);
  const authoringLanguage = useAuthoringLanguageDefault();
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

  const scoreMutation = useUpsertScoreMutation();
  const postMutation = useCreatePostMutation({
    onSuccess: (data) => {
      show("Review created successfully");
      navigate({ to: "/review/$reviewId", params: { reviewId: data.unitId } });
    },
    onError: (error) => {
      // A recognized policy denial renders inline below; other errors toast.
      if (!policyDenialFromError(error)) {
        show(`Create review failed: ${error}`);
      }
    },
  });

  async function handleSave(status: "DRAFT" | "PUBLISHED") {
    if (!userId) {
      show("Please login first");
      return;
    }
    if (!reviewData._editTitle.trim()) {
      show("Review title is required");
      return;
    }

    // Drafts may be incomplete; only enforce the length floor on publish.
    if (
      status === "PUBLISHED" &&
      kind === PostKind.REVIEW &&
      (reviewData.contentSource?.length ?? 0) < 200
    ) {
      show("Reviews must be at least 200 characters");
      return;
    }

    let scoreEntryId: string | undefined;

    if (reviewData._editRating > 0) {
      const scoreEntry = await scoreMutation.mutateAsync({
        unitId: bookUnitId,
        realm: getDefaultRealmId() ?? "default",
        value: reviewData._editRating,
      });
      scoreEntryId = scoreEntry.id;
    }

    postMutation.mutate({
      targetUnitId: primaryTargetUnitId,
      variantUnitId,
      kind,
      language: reviewData.language ?? authoringLanguage,
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
      <div className="max-w-4xl mx-auto mt-4">
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
        />
      </div>
    </div>
  );
}
