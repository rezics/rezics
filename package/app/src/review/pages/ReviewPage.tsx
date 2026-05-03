import { useMatchRoute } from "@tanstack/react-router";
import type React from "react";
import { ReviewDetailSection } from "../sections/ReviewDetailSection";

export const ReviewPage: React.FC = () => {
  const matchRoute = useMatchRoute();
  const reviewParams = matchRoute({ to: "/review/$reviewId", fuzzy: false });
  const remarkParams = matchRoute({ to: "/remark/$reviewId", fuzzy: false });
  const reviewId =
    (reviewParams ? reviewParams.reviewId : "") ||
    (remarkParams ? remarkParams.reviewId : "") ||
    "";

  return (
    <div className="w-11/12 mx-auto mt-16 max-w-4xl">
      <ReviewDetailSection reviewId={reviewId} />
    </div>
  );
};
