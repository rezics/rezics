import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { PostCard } from "./PostCard";

interface ThreadListProps {
  targetUnitId: string;
  onReply?: (postId: string) => void;
}

export const ThreadList: React.FC<ThreadListProps> = ({
  targetUnitId,
  onReply,
}) => {
  const { data, isLoading } = useQuery(postQueries.byTarget(targetUnitId));

  const threads =
    data?.posts?.filter(
      (p) => p.kind === PostKind.POST && !p.parentPostUnitId,
    ) ?? [];

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (threads.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" py={2}>
        No discussions yet. Start a conversation!
      </Typography>
    );
  }

  return (
    <Box>
      {threads.map((thread) => (
        <PostCard key={thread.unitId} post={thread} onReply={onReply} />
      ))}
    </Box>
  );
};
