import { bookQueries } from "@rezics/api/book/book";
import { useEditorEntry } from "@rezics/api/hooks";
import { postQueries } from "@rezics/api/post/post";
import {
  common_edit,
  common_loading,
  common_no_data,
  review_comments,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
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
import { Link } from "@/shared/ui/link";
import { ReviewDetail } from "../components/detail/ReviewDetail";

const i18nMessages = {
  common_edit,
  common_loading,
  common_no_data,
  review_comments,
};

interface ReviewDetailSectionProps {
  reviewId: string;
}

export const ReviewDetailSection: React.FC<ReviewDetailSectionProps> = ({
  reviewId,
}) => {
  const m = useMessage(i18nMessages);
  const commentRef = useRef<HTMLDivElement>(null);
  const composerRef = useFocusReplyFromQuery();

  const {
    data: review,
    isLoading,
    error,
  } = useQuery(postQueries.detail(reviewId));
  const bookUnitId = review?.targetUnitId ?? "";
  const { data: book } = useQuery({
    ...bookQueries.detail(bookUnitId),
    enabled: !!bookUnitId,
  });

  const editorEntry = useEditorEntry({
    surface: "review",
    ownerUnit: { user: review?.author },
  });

  if (isLoading) return <div>{m.common_loading()}</div>;
  if (error) return <QueryErrorDisplay error={error} />;
  if (!review) return <div>{m.common_no_data()}</div>;

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
              aria-label={m.common_edit()}
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
          <h2 className="text-lg font-bold">{m.review_comments()}</h2>
        </div>

        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={review.unitId}
          parentPostUnitId={review.unitId}
        />

        <PostTreeSection rootPostUnitId={review.unitId} />
      </div>
    </div>
  );
};
