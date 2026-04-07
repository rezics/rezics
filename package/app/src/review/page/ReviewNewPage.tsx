import { useAlertStore } from "@app/state/windowAlertStore";
import { TextField } from "@mui/material";
import { useCreateReviewMutation } from "@rezics/api/review/review.mutations";
import { type ReviewResponse, UnitType } from "@rezics/contract";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useUserProfileStore } from "@/user/state";
import { ReviewEditPage } from "./ReviewEditPage";

export function ReviewNewPage({
  bookUnitId,
}: {
  bookUnitId: string;
}) {
  const search = useRouterState({ select: (s) => s.location.search ?? "" });
  const searchParams = new URLSearchParams(search);
  const [reviewData, setReviewData] = useState<ReviewResponse>(
    {} as ReviewResponse,
  );
  const { show } = useAlertStore();
  const { user } = useUserProfileStore();
  const unitType =
    searchParams.get("tab") === "remark" ? UnitType.REMARK : UnitType.REVIEW;
  const { mutate, isPending } = useCreateReviewMutation(
    {
      onSuccess: (data) => {
        show("Review created successfully");
        console.log("create review success", data);
      },
      onError: (error) => {
        show(`Create review failed: ${error}`);
        console.error("create review failed", error);
      },
    },
    unitType,
  );

  function handleSave() {
    console.log(reviewData);
    const userId = user?.unitId as string;
    if (!userId) {
      show("Please login first");
      return;
    }
    mutate({
      bookId: bookUnitId,
      title: reviewData.title || "",
      content: reviewData.content || "",
      rating: reviewData.rating || 0,
      userId: userId,
    });
  }
  return (
    <div>
      <div className="max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">New {unitType}</h1>
        <TextField
          label="Book Unit ID"
          variant="filled"
          className="w-full !mt-4"
          value={bookUnitId}
          disabled
        />
        <ReviewEditPage
          data={reviewData}
          setData={setReviewData}
          onSubmit={handleSave}
          submitLabel={isPending ? "Submitting..." : "Submit"}
        />
      </div>
    </div>
  );
}
