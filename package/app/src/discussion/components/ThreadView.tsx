import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { postQueries } from "@rezics/api/post/post";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { PostCard } from "./PostCard";

interface ThreadViewProps {
  rootPostUnitId: string;
  onReply?: (postId: string) => void;
}

export const ThreadView: React.FC<ThreadViewProps> = ({
  rootPostUnitId,
  onReply,
}) => {
  const { data, isLoading } = useQuery(postQueries.thread(rootPostUnitId));

  const posts = data?.posts ?? [];

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  return (
    <Box>
      {posts.map((post) => (
        <PostCard
          key={post.unitId}
          post={post}
          depth={post.depth ?? 0}
          onReply={onReply}
        />
      ))}
    </Box>
  );
};
