import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { ReactionBar } from "@/engagement";
import {
  postPolicy,
  postReplyRowActions,
  postReplyRowOverflow,
} from "../../models/postPolicy";
import { PostAuthorHeader } from "../parts/PostAuthorHeader";
import { PostBodyMarkdown } from "../parts/PostBodyMarkdown";

interface PostReplyProps {
  post: PostDTO;
  onReply?: () => void;
  replyComposerSlot?: React.ReactNode;
  showAvatar?: boolean;
}

export const PostReply: React.FC<PostReplyProps> = ({
  post,
  onReply,
  replyComposerSlot,
  showAvatar = true,
}) => {
  const contentIndentClass = showAvatar ? "pl-10" : "";

  return (
    <div className="flex min-w-0 flex-col gap-1 py-1">
      <PostAuthorHeader post={post} size="compact" showAvatar={showAvatar} />
      <div className={`flex min-w-0 flex-col gap-1 ${contentIndentClass}`}>
        <PostBodyMarkdown
          content={post.content}
          clamp={{ maxLines: 4 }}
          className="text-sm"
        />
        <ReactionBar
          size="sm"
          post={post}
          policy={postPolicy}
          actions={postReplyRowActions}
          overflow={postReplyRowOverflow}
          onReplyInvoke={onReply}
        />
        {replyComposerSlot}
      </div>
    </div>
  );
};
