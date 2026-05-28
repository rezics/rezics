import { useAlertStore } from "@app/states/windowAlertStore";
import { useCurrentUserId } from "@rezics/api/hooks";
import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import { useCreatePostMutation } from "@rezics/api/post/post";
import { useUpsertScoreMutation } from "@rezics/api/score/score";
import { markdownContentDoc, PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Input, Label } from "@rezics/ui/shadcn";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { type ReviewEditState, ReviewForm } from "@/review/forms/ReviewForm";

export function ReviewNewPage({ bookUnitId }: { bookUnitId: string }) {
  const { t } = useTranslation(["common", "community", "page"]);
const search = useRouterState({ select: (s) => s.location.search ?? "" });
  const searchParams = new URLSearchParams(search);
  const navigate = useNavigate();
  const userId = useCurrentUserId();
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

  const scoreMutation = useUpsertScoreMutation();
  const postMutation = useCreatePostMutation({
    onSuccess: (data) => {
      show("Review created successfully");
      navigate({ to: "/review/$reviewId", params: { reviewId: data.unitId } });
    },
    onError: (error) => {
      show(`Create review failed: ${error}`);
    },
  });

  async function handleSave() {
    if (!userId) {
      show("Please login first");
      return;
    }

    if (
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
      targetUnitId: bookUnitId,
      kind,
      content: markdownContentDoc(reviewData.contentSource || ""),
      scoreEntryId,
      extra: {
        title: reviewData._editTitle || undefined,
      },
    });
  }

  const isPending = scoreMutation.isPending || postMutation.isPending;

  return (
    <div>
      <div className="max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">
          {kind === PostKind.REMARK
            ? t("page:remark_new_title")
            : t("community:review_new_title")}
        </h1>
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="book-unit-id">{t("community:excerpt_book_unit_id")}</Label>
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
          onSubmit={handleSave}
          submitLabel={isPending ? t("common:submitting") : t("common:submit")}
        />
      </div>
    </div>
  );
}
