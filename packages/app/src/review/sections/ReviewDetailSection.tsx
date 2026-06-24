import { bookQueries } from "@rezics/contract/api/book/book";
import { useEditorEntry } from "@rezics/contract/api/hooks";
import { postQueries } from "@rezics/contract/api/post/post";
import type { CommentListContext } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import {
  COMMENT_CONTEXT_ALL,
  CommentThreadSection,
  ReplyComposer,
  toCommentWriteRealmUnitId,
  useFocusReplyFromQuery,
} from "@/comment";
import {
  isApiNotFoundError,
  QueryErrorDisplay,
  ResourceNotFoundState,
} from "@/core";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link } from "@/shared/ui/link";
import { ReviewDetail } from "../components/detail/ReviewDetail";

interface ReviewDetailSectionProps {
  reviewId: string;
}

/**
 * Review detail section.
 *
 * Displays a book review with target book metadata, edit button (if authorized),
 * reply composer, and nested comment thread. Comment context selector defaults to All.
 *
 * 评论详情区域，显示评论内容、目标书籍元数据、编辑按钮（如有权限）、
 * 回复框和评论线程。评论分区选择器默认为"全部"。
 *
 * Desktop (1200px):
 * +-----------------------------------------------+
 * | [Edit icon]                                  |
 * +-----------------------------------------------+
 * | [Book Cover] | Book Title                    |
 * |              | Author                        |
 * | Review Title                                 |
 * | Reviewer | Rating ★★★★★ | 2 weeks ago       |
 * | Review body text here...                     |
 * +-----------------------------------------------+
 * | Comments                                     |
 * | [All] [Realm A] [Realm B]                    |
 * | + Reply Composer                             |
 * | [____________________________]                |
 * | - Comment 1 Author | Date                    |
 * |   - Reply 1                                  |
 * +-----------------------------------------------+
 *
 * Tablet (768px):
 * +---------------------------------+
 * | [Edit]                          |
 * +---------------------------------+
 * | [Book] | Title                  |
 * |        | Author                 |
 * | Review Title                    |
 * | Author | ★★★★★                 |
 * | Review body...                  |
 * +---------------------------------+
 * | Comments                        |
 * | [All] [Realm A]                 |
 * | [_____________________]         |
 * | - Comment 1                     |
 * +---------------------------------+
 *
 * Mobile (360px):
 * +----------+
 * | [Edit]   |
 * +----------+
 * | Book     |
 * | Title    |
 * | Author   |
 * +----------+
 * | Review   |
 * | Author   |
 * | ★★★★★   |
 * +----------+
 * | Comments |
 * | [All]    |
 * | [___]    |
 * | Cmts...  |
 * +----------+
 *
 * Loading/Error State:
 * +----------+
 * | Loading...|
 * | or Error |
 * +----------+
 */
export const ReviewDetailSection: React.FC<ReviewDetailSectionProps> = ({
  reviewId,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const commentRef = useRef<HTMLDivElement>(null);
  const composerRef = useFocusReplyFromQuery();
  const readContext = useReadLanguageContext();

  const {
    data: review,
    isLoading,
    error,
  } = useQuery({
    ...postQueries.detail(reviewId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && Boolean(reviewId),
  });
  const bookUnitId = review?.targetUnitId ?? "";
  const { data: book } = useQuery({
    ...bookQueries.detail(bookUnitId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && !!bookUnitId,
  });

  const editorEntry = useEditorEntry({
    surface: "review",
    ownerUnit: { user: review?.author },
  });
  // Direct unit surface: the selector defaults to All; the root composer
  // mirrors the user's pick so new comments target the selected partition.
  // 直接 Unit 界面：选择器默认为“全部”；根级编辑器镜像用户的选择，使新
  // 评论写入所选分区。
  const [pickedCommentContext, setPickedCommentContext] =
    useState<CommentListContext | null>(null);
  const commentContext = pickedCommentContext ?? COMMENT_CONTEXT_ALL;

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  if (error) {
    return isApiNotFoundError(error) ? (
      <ResourceNotFoundState variant="section" />
    ) : (
      <QueryErrorDisplay error={error} />
    );
  }
  if (!review) return <ResourceNotFoundState variant="section" />;

  const handleReplyInvoke = () => {
    composerRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-8">
      {editorEntry.canEnter && (
        <div className="self-end">
          <Link to="/review/$reviewId/edit" params={{ reviewId }}>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("common:edit")}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      <ReviewDetail
        review={review}
        book={book}
        onReplyInvoke={handleReplyInvoke}
      />

      <div ref={commentRef} className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AccentBar />
          <h2 className="text-lg font-bold">
            {t("community:review_comments")}
          </h2>
        </div>

        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={review.targetUnitId ?? review.unitId}
          rootUnitId={review.unitId}
          realmUnitId={toCommentWriteRealmUnitId(commentContext)}
          parentCommentId={review.unitId}
        />

        <CommentThreadSection
          rootUnitId={review.unitId}
          defaultContext={COMMENT_CONTEXT_ALL}
          availableRealmUnitIds={[review.realmUnitId]}
          onContextChange={setPickedCommentContext}
          rootAuthorUserId={review.author?.unitId ?? review.authorUserId}
        />
      </div>
    </div>
  );
};
