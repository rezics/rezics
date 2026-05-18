import type { PostDTO } from "@rezics/contract";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Star as StarIcon } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ReactionBar } from "@/engagement";
import { PostAuthorHeader } from "@/post/components/parts/PostAuthorHeader";
import { PostBodyMarkdown } from "@/post/components/parts/PostBodyMarkdown";
import { cn } from "@/shared/utils/css-util";
import { reviewCardActions, reviewPolicy } from "../../models/reviewPolicy";

interface ReviewRatingBadgeProps {
  review: PostDTO;
}

const ReviewRatingBadge: React.FC<ReviewRatingBadgeProps> = ({ review }) => {
  const { t } = useTranslation();
  const rating = (review.extra as { rating?: number } | null)?.rating;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={(props) => (
            <TextLink
              to="/review/$reviewId"
              params={{ reviewId: review.unitId }}
              className="flex items-center gap-1 rounded p-1 text-inherit no-underline transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              onClick={(e) => e.stopPropagation()}
              {...props}
            >
              <StarIcon className="h-4 w-4 fill-current text-text-brand" />
              <span className="text-xs">
                {rating !== undefined ? rating.toFixed(1) : "0.0"}/10
              </span>
            </TextLink>
          )}
        />
        <TooltipContent side="top">
          {t("review.open_review_page")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface ReviewCardProps {
  review: PostDTO;
  className?: string;
  targetWork?: ReviewTargetWork | null;
  showTargetWork?: boolean;
}

export interface ReviewTargetWork {
  unitId: string;
  title: string;
}

function getReviewTargetWork(
  review: PostDTO,
  targetWork?: ReviewTargetWork | null,
): ReviewTargetWork | null {
  if (targetWork?.unitId && targetWork.title) return targetWork;
  const book = (
    review.extra as { book?: { id?: string; title?: string } } | null
  )?.book;
  const unitId = book?.id ?? review.targetUnitId ?? undefined;
  const title = book?.title;
  if (!unitId || !title) return null;
  return { unitId, title };
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  className,
  targetWork,
  showTargetWork = true,
}) => {
  const navigate = useNavigate();

  const reviewTitle = (review.extra as any)?.title as string | undefined;
  const reviewTargetWork = showTargetWork
    ? getReviewTargetWork(review, targetWork)
    : null;

  const handleReplyInvoke = () => {
    if (!review.unitId) return;
    navigate({
      to: "/review/$reviewId",
      params: { reviewId: review.unitId },
      search: { focus: "reply" },
    });
  };

  return (
    <div
      className={cn(
        "border-b border-border-whisper py-4",
        review.unitId && "cursor-pointer",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <PostAuthorHeader post={review} />
          <div className="ml-auto">
            <ReviewRatingBadge review={review} />
          </div>
        </div>

        {reviewTitle && (
          <TextLink
            to="/review/$reviewId"
            params={{ reviewId: review.unitId }}
            underline="none"
            className="w-fit max-w-full truncate text-base font-medium text-text-primary hover:text-text-brand"
            onClick={(e) => e.stopPropagation()}
          >
            {reviewTitle}
          </TextLink>
        )}

        {reviewTargetWork && (
          <div className="flex min-w-0 items-center gap-1 text-xs leading-dense text-text-secondary">
            <span className="shrink-0">作品</span>
            <TextLink
              to="/book/$bookId"
              params={{ bookId: reviewTargetWork.unitId }}
              underline="none"
              className="min-w-0 truncate text-text-secondary hover:text-text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              {reviewTargetWork.title}
            </TextLink>
          </div>
        )}

        <PostBodyMarkdown body={review.body ?? ""} clamp={{ maxLines: 6 }} />

        <ReactionBar
          size="md"
          post={review}
          policy={reviewPolicy}
          actions={reviewCardActions}
          onReplyInvoke={handleReplyInvoke}
        />
      </div>
    </div>
  );
};

export default ReviewCard;
