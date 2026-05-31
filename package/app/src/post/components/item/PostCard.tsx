import type { PostDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { ReactionBar } from "@/engagement";
import { PollEmbed } from "@/poll";
import {
  postCardActions,
  postCardOverflow,
  postPolicy,
} from "../../models/postPolicy";
import { PostAuthorHeader } from "../parts/PostAuthorHeader";
import { PostBodyMarkdown } from "../parts/PostBodyMarkdown";

interface PostCardProps {
  post: PostDTO;
  onOpen?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onOpen }) => {
  const navigate = useNavigate();
  const rootPostUnitId = post.unitId;

  const handleCardClick = () => {
    if (onOpen) {
      onOpen();
      return;
    }
    navigate({
      to: "/post/$rootPostUnitId",
      params: { rootPostUnitId },
    });
  };

  const handleReplyInvoke = () => {
    if (onOpen) {
      onOpen();
      return;
    }
    navigate({
      to: "/post/$rootPostUnitId",
      params: { rootPostUnitId },
      search: { focus: "reply" },
    });
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: whole card click is pointer-only; nested actions and links provide keyboard access.
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users can open via nested controls or route links.
    <div
      className="py-3 border-b border-border-whisper cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex flex-col gap-2">
        <PostAuthorHeader post={post} />
        <PostBodyMarkdown
          content={post.content}
          clamp={{ maxLines: 4 }}
          className="text-sm"
        />
        {post.extra?.poll?.unitId && (
          <PollEmbed pollUnitId={post.extra.poll.unitId} />
        )}
        <ReactionBar
          size="md"
          variant="pill"
          post={post}
          policy={postPolicy}
          actions={postCardActions}
          overflow={postCardOverflow}
          onReplyInvoke={handleReplyInvoke}
        />
      </div>
    </div>
  );
};
