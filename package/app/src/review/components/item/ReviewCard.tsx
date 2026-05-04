import type { PostDTO } from "@rezics/contract";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { ReactionBar } from "@/engagement";
import { PostBodyMarkdown } from "@/post";
import { cn } from "@/shared/utils/css-util";
import { reviewCardActions, reviewPolicy } from "../../models/reviewPolicy";

interface ReviewCardProps {
  review: PostDTO;
  className?: string;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  className,
}) => {
  const navigate = useNavigate();

  const bookMetadata = (review.extra as any)?.book as
    | { coverUrl?: string; title?: string }
    | undefined;
  const reviewTitle = (review.extra as any)?.title as string | undefined;
  const rating = (review.extra as any)?.rating as number | undefined;

  const handleOpenReview = () => {
    if (!review.unitId) return;
    navigate({ to: "/review/$reviewId", params: { reviewId: review.unitId } });
  };

  const handleReplyInvoke = () => {
    if (!review.unitId) return;
    navigate({
      to: "/review/$reviewId",
      params: { reviewId: review.unitId },
      search: { focus: "reply" },
    });
  };

  return (
    <Card
      className={cn(
        "w-full transition-all hover:shadow-md",
        review.unitId && "cursor-pointer",
        className,
      )}
      onClick={handleOpenReview}
    >
      <CardContent>
        <div className="flex gap-4">
          {bookMetadata?.coverUrl && (
            <div className="flex-shrink-0 w-20 h-28 overflow-hidden rounded shadow-sm border border-border-whisper">
              <img
                src={bookMetadata.coverUrl}
                alt={bookMetadata.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex-grow min-w-0">
            {bookMetadata?.title && (
              <span
                className="block truncate text-xs"
                style={{ letterSpacing: "1px" }}
              >
                《{bookMetadata.title}》
              </span>
            )}

            {reviewTitle && (
              <h3 className="truncate text-[1.1rem] text-text-primary">
                {reviewTitle}
              </h3>
            )}

            <PostBodyMarkdown
              body={review.body ?? ""}
              clamp={{ maxLines: 3 }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <ReactionBar
            size="md"
            post={review}
            policy={reviewPolicy}
            actions={reviewCardActions}
            onReplyInvoke={handleReplyInvoke}
          />

          <div className="flex items-center gap-2">
            <span
              className="text-xs text-text-secondary whitespace-nowrap"
              style={{ lineHeight: 1 }}
            >
              {review.author?.name || "匿名"}
            </span>

            {rating !== undefined && (
              <span
                className="text-xs whitespace-nowrap"
                style={{
                  lineHeight: 1,
                  color: "var(--rezics-sys-color-secondary, var(--rezics-sys-color-text-secondary))",
                }}
              >
                {rating}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReviewCard;
