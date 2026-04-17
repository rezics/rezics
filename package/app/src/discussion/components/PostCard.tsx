import { Avatar, Box, Typography } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type React from "react";

interface PostCardProps {
  post: PostDTO;
  depth?: number;
  onReply?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, depth = 0, onReply }) => {
  const dateStr = post.createdAt
    ? new Date(String(post.createdAt)).toLocaleDateString()
    : "";

  return (
    <Box
      sx={{ pl: depth > 0 ? depth * 3 : 0 }}
      className="py-3 border-b border-gray-200 dark:border-gray-700"
    >
      <Box className="flex gap-3">
        <Link to="/user/$unitId" params={{ unitId: post.author?.unitId ?? "" }}>
          <Avatar
            src={post.author?.avatar ?? ""}
            sx={{ width: 32, height: 32 }}
            variant="rounded"
          />
        </Link>

        <Box className="flex-1">
          <Box className="flex items-center gap-2 mb-1">
            <Typography variant="body2" fontWeight={600}>
              {post.author?.name ?? "Anonymous"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {dateStr}
            </Typography>
          </Box>

          <MarkdownContent
            content={post.body ?? ""}
            className="markdown-body text-sm"
          />

          <Box className="flex items-center gap-3 mt-1">
            <Typography variant="caption" color="text.secondary">
              {post.replyCount ?? 0} replies
            </Typography>
            {onReply && (
              <Typography
                variant="caption"
                color="primary"
                sx={{ cursor: "pointer" }}
                onClick={() => onReply(post.unitId)}
              >
                Reply
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
