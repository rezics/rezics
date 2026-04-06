import { ChatBubbleOutline } from "@mui/icons-material";
import {
  Avatar,
  Box,
  IconButton,
  Rating,
  Tooltip,
  Typography,
} from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { reviewQueries } from "@rezics/api/review/review";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import { useQuery } from "@tanstack/react-query";
import { useMatchRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { BookListViewItem } from "@/book-library/component/BookList/BookListView";
import { SingleCommentElementWrapper } from "@/comment/component/SingleCommentElementWrapper.tsx";
import TreeReplyComponents from "@/comment/component/TreeReplyComponents";
import {
  MiniActionBar,
  MiniAdminActionBar,
} from "@/engagement/component/MiniActionBar.tsx";
import { ReactionStatistics } from "@/engagement/component/ReactionStatistics.tsx";
import { parseReactionSummaries } from "@/shared/util/reaction-summaries-parser";

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
  } = useQuery(reviewQueries.detail(reviewId || ""));

  const {
    data: book,
    isLoading: bookLoading,
    error: bookError,
  } = useQuery(bookQueries.detail(review?.bookId || ""));

  const commentRef = useRef<HTMLDivElement>(null);
  const handleGoToComments = () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error: scrollIntoView is not defined in the type declaration
    commentRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (isLoading) {
    return <div className="mt-6">{t("common.loading")}</div>;
  }

  if (error instanceof Error) {
    return <div className="mt-6 text-red-500">Error: {error.message}</div>;
  }

  if (!review) {
    return <div className="mt-6">{t("common.no_data")}</div>;
  }

  return (
    <div className="w-11/12 mx-auto mt-10 max-w-4xl">
      {/* ANCHOR Book Info  */}
      {bookLoading ? (
        <div className="mt-6">{t("common.loading")}</div>
      ) : bookError instanceof Error ? (
        <div className="mt-6 text-red-500">Error: {bookError.message}</div>
      ) : !book ? (
        <div className="mt-6">{t("common.no_data")}</div>
      ) : (
        <div className="mt-6">
          <BookListViewItem book={book} />
        </div>
      )}

      <div className="flex items-center justify-between mt-6">
        <div className="text-2xl font-bold">
          {review?.title || t("pages.review_page")}
        </div>
        <div>
          <div className="text-right">
            {!!review.rating && (
              <Rating
                value={review.rating / 2}
                precision={0.5}
                max={5}
                readOnly
              />
            )}
            <div className="text-xs text-gray-500">
              <MUILink
                to="/book/$bookId"
                params={{ bookId: review.bookId }}
              >{`/book/${review.bookId}`}</MUILink>
            </div>
          </div>
          {/* <Button variant="contained" color="primary">
            <Link to={`/review/${reviewId}/edit`}>{t('common.edit')}</Link>
          </Button> */}
        </div>
      </div>

      {/* ANCHOR Author Info */}

      <div className="mt-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Avatar
            src={review.user?.avatar ?? ""}
            sx={{ width: 56, height: 56, borderRadius: 1 }}
          />
          <div className="flex-1">
            <Tooltip
              title={t("review.open_user_interface")}
              placement="top-start"
            >
              <MUILink
                to="/user/$unitId"
                params={{ unitId: review.user?.unitId ?? "" }}
                className="flex items-center"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <Typography variant="h6" className="font-bold text-primary">
                      {review.user?.name}
                    </Typography>
                    <div className="text-sm text-gray-500 mt-1">
                      <span>{review.created_at}</span>
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
                userUnitId={review.user?.unitId}
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
          <MarkdownContent content={review.content || ""} />
        </Box>

        <div className="mt-2">
          <ReactionStatistics
            reactionSummaries={parseReactionSummaries(review.reactionSummaries)}
          />
        </div>

        {/* ANCHOR Comments */}
        <div ref={commentRef} className="mt-5">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <AccentBar />
              <p className="text-2xl font-bold">{t("review.comments")}</p>
            </div>

            <SingleCommentElementWrapper replyUnitId={review.unitId || ""}>
              <IconButton size="large" sx={{ fontSize: "1.5rem" }}>
                <ChatBubbleOutline fontSize="inherit" />
              </IconButton>
            </SingleCommentElementWrapper>
          </div>

          <TreeReplyComponents unitId={review.unitId || ""} />
          {/* 供评论区占位符 */}
          <div className="mb-[200px]" />
        </div>
        {/* Footer meta */}
      </div>
    </div>
  );
}
