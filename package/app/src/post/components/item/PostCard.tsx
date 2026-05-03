import type { PostDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { ReactionBar } from "@/engagement";
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
  const rootPostUnitId =
    (post as unknown as { rootPostUnitId?: string }).rootPostUnitId ??
    post.unitId;

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
    <div
      className="py-3 border-b border-rezics-color-border cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex flex-col gap-2">
        <PostAuthorHeader post={post} />
        <PostBodyMarkdown
          body={post.body ?? ""}
          clamp={{ maxLines: 4 }}
          className="text-sm"
        />
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
