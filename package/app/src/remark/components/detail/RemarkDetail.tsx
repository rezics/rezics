import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { PostDTO } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import {
  ThumbsDown as ThumbDownIcon,
  ThumbsUp as ThumbUpIcon,
} from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { ReactionBar } from "@/engagement";
import { PostAuthorHeader } from "@/post/components/parts/PostAuthorHeader";
import { PostBodyMarkdown } from "@/post/components/parts/PostBodyMarkdown";
import { TextLink } from "@/shared/ui/link";
import { remarkDetailActions, remarkPolicy } from "../../models/remarkPolicy";

interface RemarkDetailProps {
  remark: PostDTO;
  onReplyInvoke?: () => void;
}

export const RemarkDetail: React.FC<RemarkDetailProps> = ({
  remark,
  onReplyInvoke,
}) => {
  const rating = (remark.extra as { rating?: number } | null)?.rating;
  const isRecommended = !!(rating && rating >= 3);
  const bookUnitId = remark.targetUnitId;
  const hydrationIds = useMemo(
    () => (remark.unitId ? [remark.unitId] : []),
    [remark.unitId],
  );
  useReactionHydration(hydrationIds);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <PostAuthorHeader post={remark} />
        <div className="flex items-center gap-2">
          {isRecommended ? (
            <ThumbUpIcon className="h-5 w-5 text-text-brand" />
          ) : (
            <ThumbDownIcon className="h-5 w-5 text-text-secondary" />
          )}
          {rating !== undefined && (
            <span className="text-sm">{rating.toFixed(1)} / 10</span>
          )}
        </div>
      </div>
      {bookUnitId && (
        <div>
          <TextLink to="/book/$bookId" params={{ bookId: bookUnitId }}>
            <span className="text-xs text-text-brand">
              {m.page_book_edit_info_dialog_view_book()}
            </span>
          </TextLink>
        </div>
      )}
      <PostBodyMarkdown content={remark.content} />
      <ReactionBar
        size="lg"
        post={remark}
        policy={remarkPolicy}
        actions={remarkDetailActions}
        onReplyInvoke={onReplyInvoke}
      />
    </div>
  );
};
