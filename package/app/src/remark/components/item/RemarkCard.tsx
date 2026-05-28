import type { PostDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
import { TextLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { remarkCardActions, remarkPolicy } from "../../models/remarkPolicy";

interface RemarkRatingBadgeProps {
  remark: PostDTO;
}

const RemarkRatingBadge: React.FC<RemarkRatingBadgeProps> = ({ remark }) => {
  const { t } = useTranslation(["page"]);
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
        <TooltipContent side="top">
          {t("page:remark_open_remark_page")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface RemarkCardProps {
  remark: PostDTO;
}

export const RemarkCard: React.FC<RemarkCardProps> = ({ remark }) => {
  const navigate = useNavigate();

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
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <PostAuthorHeader post={remark} />
          <div className="ml-auto">
            <RemarkRatingBadge remark={remark} />
          </div>
        </div>
        <PostBodyMarkdown content={remark.content} clamp={{ maxLines: 4 }} />
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
