import { ChatBubbleOutline } from "@mui/icons-material";
import { Avatar, Box, IconButton, Tooltip, Typography } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { postQueries } from "@rezics/api/post/post";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import { useQuery } from "@tanstack/react-query";
import { useMatchRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookListViewItem } from "@/book-library/components/BookList/BookListView";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { InlinePostForm } from "@/discussion/components/InlinePostForm";
import { ThreadView } from "@/discussion/components/ThreadView";
import {
  MiniActionBar,
  MiniAdminActionBar,
} from "@/engagement/components/MiniActionBar.tsx";
import { ReactionStatistics } from "@/engagement/components/ReactionStatistics.tsx";
import { parseReactionSummaries } from "@/shared/utils/reaction-summaries-parser";

export function ReviewPage() {
  const matchRoute = useMatchRoute();
  const reviewParams = matchRoute({ to: "/review/$reviewId", fuzzy: false });
  const remarkParams = matchRoute({ to: "/remark/$reviewId", fuzzy: false });
  const reviewId =
    (reviewParams ? reviewParams.reviewId : "") ||
    (remarkParams ? remarkParams.reviewId : "") ||
    "";
  const { t } = useTranslation();
  const {
    data: review,
    isLoading,
    error,
  } = useQuery(postQueries.detail(reviewId || ""));

  const bookUnitId = review?.targetUnitId ?? "";
  const {
    data: book,
    isLoading: bookLoading,
    error: bookError,
  } = useQuery({
    ...bookQueries.detail(bookUnitId),
    enabled: !!bookUnitId,
  });

  // Rating from post.extra.rating (legacy) or linked ScoreEntry via scoreEntryId
  const rating = (review?.extra as any)?.rating as number | undefined;
  const reviewTitle = (review?.extra as any)?.title as string | undefined;

  const commentRef = useRef<HTMLDivElement>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const handleGoToComments = () => {
    commentRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (isLoading) {
    return <div className="mt-6">{t("common.loading")}</div>;
  }

  if (error) {
    return <QueryErrorDisplay error={error} className="mt-6" />;
  }

  if (!review) {
    return <div className="mt-6">{t("common.no_data")}</div>;
  }

  const dateStr = review.createdAt
    ? new Date(String(review.createdAt)).toLocaleDateString()
    : "";

  return (
    <div className="w-11/12 mx-auto mt-10 max-w-4xl">
      {/* Book Info */}
      {bookLoading ? (
        <div className="mt-6">{t("common.loading")}</div>
      ) : bookError ? (
        <QueryErrorDisplay error={bookError} className="mt-6" />
      ) : !book ? (
        <div className="mt-6">{t("common.no_data")}</div>
      ) : (
        <div className="mt-6">
          <BookListViewItem book={book} />
        </div>
      )}

      <div className="flex items-center justify-between mt-6">
        <div className="text-2xl font-bold">
          {reviewTitle || t("pages.review_page")}
        </div>
        <div>
          <div className="text-right">
            {!!rating && (
              <Typography variant="body2" color="text.secondary">
                {rating.toFixed(1)} / 10
              </Typography>
            )}
            <div className="text-xs text-gray-500">
              <MUILink
                to="/book/$bookId"
                params={{ bookId: bookUnitId }}
              >{`/book/${bookUnitId}`}</MUILink>
            </div>
          </div>
        </div>
      </div>

      {/* Author Info */}
      <div className="mt-6">
        <div className="flex items-start gap-4">
          <Avatar
            src={review.author?.avatar ?? ""}
            sx={{ width: 56, height: 56, borderRadius: 1 }}
          />
          <div className="flex-1">
            <Tooltip
              title={t("review.open_user_interface")}
              placement="top-start"
            >
              <MUILink
                to="/user/$unitId"
                params={{ unitId: review.author?.unitId ?? "" }}
                className="flex items-center"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <Typography variant="h6" className="font-bold text-primary">
                      {review.author?.name}
                    </Typography>
                    <div className="text-sm text-gray-500 mt-1">
                      <span>{dateStr}</span>
                    </div>
                  </div>
                </div>
              </MUILink>
            </Tooltip>
          </div>
          <div className="text-right">
            <div className="flex justify-end">
              <MiniAdminActionBar
                editionURL={`/review/${review.unitId}/edit`}
                userUnitId={review.author?.unitId}
              />
              <MiniActionBar
                handleOnCommentClick={handleGoToComments}
                unitId={review.unitId}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <Box sx={{ mt: 3 }}>
          <MarkdownContent content={review.body || ""} />
        </Box>

        <div className="mt-2">
          <ReactionStatistics
            reactionSummaries={parseReactionSummaries(review.reactionSummaries)}
          />
        </div>

        {/* Comments / Replies */}
        <div ref={commentRef} className="mt-5">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <AccentBar />
              <p className="text-2xl font-bold">{t("review.comments")}</p>
            </div>

            <IconButton
              size="large"
              sx={{ fontSize: "1.5rem" }}
              onClick={() => setShowReplyForm(!showReplyForm)}
            >
              <ChatBubbleOutline fontSize="inherit" />
            </IconButton>
          </div>

          {showReplyForm && (
            <Box mb={2}>
              <InlinePostForm
                targetUnitId={review.unitId}
                placeholder="Write a reply..."
                onSuccess={() => setShowReplyForm(false)}
              />
            </Box>
          )}

          <ThreadView rootPostUnitId={review.unitId} />
          <div className="mb-[200px]" />
        </div>
      </div>
    </div>
  );
}
