import { bookQueries } from "@rezics/api/book/book";
import { useEditorEntry } from "@rezics/api/hooks";
import { postQueries } from "@rezics/api/post/post";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { PostTreeSection } from "@/post";
import {
  ReplyComposer,
  type ReplyComposerHandle,
} from "@/post/forms/ReplyComposer";
import { useFocusReplyFromQuery } from "@/post/hooks/useFocusReplyFromQuery";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link } from "@/shared/ui/link";
import { ReviewDetail } from "../components/detail/ReviewDetail";

interface ReviewDetailSectionProps {
  reviewId: string;
}

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
    ...postQueries.detail(reviewId, { languages: readContext.languages }),
    enabled: readContext.ready && Boolean(reviewId),
  });
  const bookUnitId = review?.targetUnitId ?? "";
  const { data: book } = useQuery({
    ...bookQueries.detail(bookUnitId, { languages: readContext.languages }),
    enabled: readContext.ready && !!bookUnitId,
  });

  const editorEntry = useEditorEntry({
    surface: "review",
    ownerUnit: { user: review?.author },
  });

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;
  if (!review) return <div>{t("common:no_data")}</div>;

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
          realmUnitId={review.realmUnitId}
          parentCommentId={review.unitId}
        />

        <PostTreeSection
          rootUnitId={review.unitId}
          realmUnitId={review.realmUnitId}
        />
      </div>
    </div>
  );
};
