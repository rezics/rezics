import { useAlertStore } from "@app/state/windowAlertStore";
import { TextField } from "@mui/material";
import { useCreatePostMutation } from "@rezics/api/post/post";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useUserProfileStore } from "@/user/state";
import { ReviewEditPage } from "./ReviewEditPage";

/**
 * ReviewNewPage - now uses Post API instead of Review API.
 * Creates a Post with kindKey='review' or kindKey='remark'.
 */

// MOCK: local editing state matching ReviewEditPage's expected shape
type ReviewEditState = {
  unitId: string;
  body: string;
  _editTitle: string;
  _editRating: number;
  extra: Record<string, any>;
  targetUnitId?: string | null;
};

export function ReviewNewPage({
  bookUnitId,
}: {
  bookUnitId: string;
}) {
  const search = useRouterState({ select: (s) => s.location.search ?? "" });
  const searchParams = new URLSearchParams(search);
  const [reviewData, setReviewData] = useState<ReviewEditState>({
    unitId: '',
    body: '',
    _editTitle: '',
    _editRating: 0,
    extra: {},
  });
  const { show } = useAlertStore();
  const { user } = useUserProfileStore();
  const kindKey = searchParams.get("tab") === "remark" ? "remark" : "review";

  const { mutate, isPending } = useCreatePostMutation({
    onSuccess: (data) => {
      show("Review created successfully");
      console.log("create review success", data);
    },
    onError: (error) => {
      show(`Create review failed: ${error}`);
      console.error("create review failed", error);
    },
  });

  function handleSave() {
    const userId = user?.unitId as string;
    if (!userId) {
      show("Please login first");
      return;
    }
    mutate({
      targetUnitId: bookUnitId,
      kindKey,
      body: reviewData.body || "",
      extra: {
        title: reviewData._editTitle || undefined,
        rating: reviewData._editRating || 0,
      },
    });
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">New {kindKey}</h1>
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
