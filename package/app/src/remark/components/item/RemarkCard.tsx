import type { PostDTO } from "@rezics/contract";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import {
  ThumbsDown as ThumbDownIcon,
  ThumbsUp as ThumbUpIcon,
} from "lucide-react";
import type React from "react";
import { ReactionBar } from "@/engagement";
import { PostAuthorHeader } from "@/post/components/parts/PostAuthorHeader";
import { PostBodyMarkdown } from "@/post/components/parts/PostBodyMarkdown";
import { cn } from "@/shared/utils/css-util";
import { remarkCardActions, remarkPolicy } from "../../models/remarkPolicy";

interface RemarkRatingBadgeProps {
  remark: PostDTO;
}

const RemarkRatingBadge: React.FC<RemarkRatingBadgeProps> = ({ remark }) => {
  const rating = (remark.extra as { rating?: number } | null)?.rating;
  const isRecommended = !!(rating && rating >= 3);
  const dateStr = remark.createdAt
    ? new Date(String(remark.createdAt)).toLocaleDateString()
    : "";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={(props) => (
            <TextLink
              to="/remark/$reviewId"
              params={{ reviewId: remark.unitId }}
              className="flex items-center gap-1 rounded p-1 text-inherit no-underline transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              onClick={(e) => e.stopPropagation()}
              {...props}
            >
              {isRecommended ? (
                <ThumbUpIcon className="h-4 w-4 text-text-brand" />
              ) : (
                <ThumbDownIcon className="h-4 w-4 text-text-secondary" />
              )}
              <span className="text-xs">
                {rating?.toFixed(1) ?? "0.0"}/10 · {dateStr}
              </span>
            </TextLink>
          )}
        />
        <TooltipContent side="top">阅读完整评测</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface RemarkCardProps {
  remark: PostDTO;
}

export const RemarkCard: React.FC<RemarkCardProps> = ({ remark }) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (!remark.unitId) return;
    navigate({ to: "/remark/$reviewId", params: { reviewId: remark.unitId } });
  };

  const handleReplyInvoke = () => {
    if (!remark.unitId) return;
    navigate({
      to: "/remark/$reviewId",
      params: { reviewId: remark.unitId },
      search: { focus: "reply" },
    });
  };

  return (
    <div
      className={cn(
        "py-4 border-b border-gray-200 dark:border-gray-700",
        remark.unitId && "cursor-pointer",
      )}
      onClick={handleCardClick}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <PostAuthorHeader post={remark} />
          <div className="ml-auto">
            <RemarkRatingBadge remark={remark} />
          </div>
        </div>
        <PostBodyMarkdown body={remark.body ?? ""} clamp={{ maxLines: 4 }} />
        <ReactionBar
          size="md"
          post={remark}
          policy={remarkPolicy}
          actions={remarkCardActions}
          onReplyInvoke={handleReplyInvoke}
        />
      </div>
    </div>
  );
};
