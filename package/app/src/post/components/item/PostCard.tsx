import { Box } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { PostAuthorHeader } from "../parts/PostAuthorHeader";
import { PostBodyMarkdown } from "../parts/PostBodyMarkdown";
import { PostReactionFooter } from "../parts/PostReactionFooter";

interface PostCardProps {
  post: PostDTO;
  onOpen?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onOpen }) => {
  return (
    <Box
      className="py-3 border-b border-gray-200 dark:border-gray-700"
      onClick={onOpen}
      sx={onOpen ? { cursor: "pointer" } : undefined}
    >
      <Box className="flex flex-col gap-2">
        <PostAuthorHeader post={post} />
        <PostBodyMarkdown
          body={post.body ?? ""}
          clamp={{ maxLines: 4 }}
          className="text-sm"
        />
        <PostReactionFooter post={post} />
      </Box>
    </Box>
  );
};
