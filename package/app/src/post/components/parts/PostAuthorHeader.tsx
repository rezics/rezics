import { Avatar, Box, Typography } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type React from "react";

interface PostAuthorHeaderProps {
  post: PostDTO;
  size?: "compact" | "default";
}

export const PostAuthorHeader: React.FC<PostAuthorHeaderProps> = ({
  post,
  size = "default",
}) => {
  const avatarSize = size === "compact" ? 24 : 36;
  const nameVariant = size === "compact" ? "caption" : "body2";
  const dateStr = post.createdAt
    ? new Date(String(post.createdAt)).toLocaleDateString()
    : "";

  return (
    <Box className="flex items-center gap-2">
      <Link to="/user/$unitId" params={{ unitId: post.author?.unitId ?? "" }}>
        <Avatar
          src={post.author?.avatar ?? ""}
          sx={{ width: avatarSize, height: avatarSize }}
          variant="rounded"
        />
      </Link>
      <Typography variant={nameVariant} fontWeight={600}>
        {post.author?.name ?? "Anonymous"}
      </Typography>
      {dateStr && (
        <Typography variant="caption" color="text.secondary">
          {dateStr}
        </Typography>
      )}
    </Box>
  );
};
