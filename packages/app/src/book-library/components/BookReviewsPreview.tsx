import { postQueries } from "@rezics/contract/api/post/post.queries";
import { type PostDTO, PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { ReviewList } from "@/review";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

/**
 * Props for BookReviews component.
 * BookReviews 组件的 props。
 */
interface BookReviewsProps {
  /** Book unit ID. 书籍 unit ID。 */
  bookId: string;
  /** Book title for display. 用于展示的书名。 */
  title: string;
  /** Number of reviews to show. 要显示的评论数量。 */
  reviewNumber?: number;
}

/**
 * Book Reviews Preview - Displays a preview of reviews for a book.
 * Book Reviews Preview - 展示某本书评论的预览。
 * Now uses Post API with kind='review' instead of the old Review model.
 * 现在使用 kind='review' 的 Post API，而非旧的 Review 模型。
 */
export const BookReviews: React.FC<BookReviewsProps> = ({
  bookId,
  title,
  reviewNumber = 3,
}) => {
  const { t } = useTranslation(["book"]);
  const readContext = useReadLanguageContext();
  // Fetch posts with kind='review' for this book
  // 获取该书 kind='review' 的帖子
  const { data } = useQuery({
    ...postQueries.byTarget(bookId, {
      kind: PostKind.REVIEW,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      limit: reviewNumber,
    }),
    enabled: readContext.ready && !!bookId,
  });

  const reviews: PostDTO[] = data?.posts?.slice(0, reviewNumber) ?? [];

  return (
    <div>
      <ArrowForwardIcon size={16} to={`/review/book/${bookId}/`}>
        <AccentBarWithText text={t("book:reviews_of_book", { title })} />
      </ArrowForwardIcon>
      <ReviewList reviews={reviews} showTargetUnit={false} />
    </div>
  );
};
