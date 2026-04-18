import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { postQueries } from "@rezics/api/post/post";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { PostCard } from "@/discussion/components/PostCard";

interface RealmContentFeedProps {
  realmId: string;
}

export const RealmContentFeed: React.FC<RealmContentFeedProps> = ({
  realmId,
}) => {
  const { data } = useQuery(postQueries.byTarget(realmId));
  const posts = data?.posts ?? [];

  if (posts.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" py={2}>
        No content in this realm yet
      </Typography>
    );
  }

  return (
    <Box>
      {posts.map((post) => (
        <PostCard key={post.unitId} post={post} />
      ))}
    </Box>
  );
};
