import { postQueries } from "@rezics/api/post/post";
import type { PostDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ShortReviewListShow } from "@/review/component/ShortReviewList.tsx";

interface ShortBookReviewsProps {
  bookId: string;
}

/**
 * Remark Preview - short reviews / remarks for a book.
 * Now uses Post API with kindKey='remark' instead of the old Remark UnitType.
 */
export const RemarkPreview: React.FC<ShortBookReviewsProps> = ({ bookId }) => {
  const { t } = useTranslation();
  // MOCK: fetch posts with kindKey='remark' for this book
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(bookId, { kindKey: 'remark', limit: 4 }),
    enabled: !!bookId,
  });

  const handleLike = (postId: string) => {
    console.log("Like post:", postId);
  };

  const handleDislike = (postId: string) => {
    console.log("Dislike post:", postId);
  };

  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }
  if (error && error instanceof Error) {
    return (
      <div>
        {t("common.error")}: {error.message}
      </div>
    );
  }

  const posts: PostDTO[] = data?.posts?.slice(0, 4) ?? [];

  return (
    <ShortReviewListShow
      data={{ posts, total: data?.total }}
      onLike={handleLike}
      onDislike={handleDislike}
    />
  );
};
