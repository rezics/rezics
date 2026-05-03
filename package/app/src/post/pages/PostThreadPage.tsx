import { Box } from "@mui/material";
import { postQueries } from "@rezics/api/post/post";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type React from "react";
import { PostCard } from "../components/item/PostCard";
import { PostTreeSection } from "../sections/PostTreeSection";

export const PostThreadPage: React.FC = () => {
  const { rootPostUnitId } = useParams({ strict: false }) as {
    rootPostUnitId: string;
  };
  const { data: root } = useQuery(postQueries.detail(rootPostUnitId));

  return (
    <Box className="w-full max-w-3xl mx-auto mt-8 px-4">
      {root && <PostCard post={root} />}
      <PostTreeSection rootPostUnitId={rootPostUnitId} />
    </Box>
  );
};

export default PostThreadPage;
