import { useAlertStore } from "@app/states/windowAlertStore";
import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import { useCreatePostMutation } from "@rezics/api/post/post";
import { useUpsertScoreMutation } from "@rezics/api/score/score";
import { PostKind } from "@rezics/contract";
import { Input, Label } from "@rezics/ui/shadcn";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { ReviewForm, type ReviewEditState } from "@/review/forms/ReviewForm";
import { useUserProfileStore } from "@/user/states";

export function ReviewNewPage({ bookUnitId }: { bookUnitId: string }) {
  const search = useRouterState({ select: (s) => s.location.search ?? "" });
  const searchParams = new URLSearchParams(search);
  const navigate = useNavigate();
  const [reviewData, setReviewData] = useState<ReviewEditState>({
    unitId: "",
    body: "",
    _editTitle: "",
    _editRating: 0,
    extra: {},
  });
  const { show } = useAlertStore();
  const { user } = useUserProfileStore();
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
    const userId = user?.unitId as string;
    if (!userId) {
      show("Please login first");
      return;
    }

    if (kind === PostKind.REVIEW && (reviewData.body?.length ?? 0) < 200) {
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
      body: reviewData.body || "",
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
        <h1 className="text-xl font-semibold">New {kind.toLowerCase()}</h1>
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="book-unit-id">Book Unit ID</Label>
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
          submitLabel={isPending ? "Submitting..." : "Submit"}
        />
      </div>
    </div>
  );
}
