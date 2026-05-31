import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { ReactionBar } from "@/engagement";
import { PollEmbed } from "@/poll";
import {
  postPolicy,
  postReplyRowActions,
  postReplyRowOverflow,
} from "../../models/postPolicy";
import { PostAuthorHeader } from "../parts/PostAuthorHeader";
import { PostBodyMarkdown } from "../parts/PostBodyMarkdown";
import { CommentPromotionBadge } from "../parts/CommentPromotionBadge";

interface PostReplyProps {
  post: PostDTO;
  onReply?: () => void;
  overflowContent?: React.ReactNode;
  replyComposerSlot?: React.ReactNode;
  showAvatar?: boolean;
}

export const PostReply: React.FC<PostReplyProps> = ({
  post,
  onReply,
  overflowContent,
  replyComposerSlot,
  showAvatar = true,
}) => {
  const contentIndentClass = showAvatar ? "pl-10" : "";

  return (
    <div className="flex min-w-0 flex-col gap-1 py-1">
      <PostAuthorHeader post={post} size="compact" showAvatar={showAvatar} />
      <div className={`flex min-w-0 flex-col gap-1 ${contentIndentClass}`}>
        {post.pinKind ? <CommentPromotionBadge pinKind={post.pinKind} /> : null}
        <PostBodyMarkdown
          content={post.content}
          clamp={{ maxLines: 4 }}
          className="text-sm"
        />
        {post.extra?.poll?.unitId && (
          <PollEmbed pollUnitId={post.extra.poll.unitId} />
        )}
        <ReactionBar
          size="sm"
          post={post}
          policy={postPolicy}
          actions={postReplyRowActions}
          overflow={postReplyRowOverflow}
          onReplyInvoke={onReply}
          overflowContent={overflowContent}
        />
        {replyComposerSlot}
      </div>
    </div>
  );
};
