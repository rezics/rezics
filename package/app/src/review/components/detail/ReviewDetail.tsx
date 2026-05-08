import type { BookDTO, PostDTO } from "@rezics/contract";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import type React from "react";
import { useTranslation } from "react-i18next";
import { BookListViewItem } from "@/book-library/components/BookList/BookListView";
import { ReactionBar } from "@/engagement";
import { reviewDetailActions, reviewPolicy } from "../../models/reviewPolicy";

interface ReviewDetailProps {
  review: PostDTO;
  book?: BookDTO | null;
  onReplyInvoke?: () => void;
}

export const ReviewDetail: React.FC<ReviewDetailProps> = ({
  review,
  book,
  onReplyInvoke,
}) => {
  const { t } = useTranslation();
  const rating = (review.extra as { rating?: number } | null)?.rating;
  const title = (review.extra as { title?: string } | null)?.title;
  const dateStr = review.createdAt
    ? new Date(String(review.createdAt)).toLocaleDateString()
    : "";
  const authorName = review.author?.name ?? "";
  const authorInitial = authorName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-8">
      {book && <BookListViewItem book={book} />}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {title || t("pages.review_page")}
        </h1>
        {rating !== undefined && (
          <span className="text-sm text-text-secondary">
            {rating.toFixed(1)} / 10
          </span>
        )}
      </div>

      <div className="flex items-start gap-4">
        <Avatar
          className="h-14 w-14 rounded-md"
          onClick={(e) => e.stopPropagation()}
        >
          {review.author?.avatar && (
            <AvatarImage src={review.author.avatar} alt={authorName} />
          )}
          <AvatarFallback>{authorInitial}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={(props) => (
                  <TextLink
                    to="/user/$userId"
                    params={{ userId: review.author?.userId ?? "" }}
                    {...props}
                  >
                    <span className="text-lg font-bold text-text-brand">
                      {authorName}
                    </span>
                  </TextLink>
                )}
              />
              <TooltipContent side="top">
                {t("review.open_user_interface")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {dateStr && (
            <div className="text-xs text-text-secondary">{dateStr}</div>
          )}
        </div>
      </div>

      <div>
        <MarkdownContent content={review.body ?? ""} />
      </div>

      <ReactionBar
        size="lg"
        post={review}
        policy={reviewPolicy}
        actions={reviewDetailActions}
        onReplyInvoke={onReplyInvoke}
      />
    </div>
  );
};
