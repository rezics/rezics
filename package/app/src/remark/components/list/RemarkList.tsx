import { Stack } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { RemarkCard } from "../item/RemarkCard";

interface RemarkListProps {
  posts: PostDTO[];
  spacing?: number | string;
}

export const RemarkList: React.FC<RemarkListProps> = ({
  posts,
  spacing = 2,
}) => {
  return (
    <Stack spacing={spacing}>
      {posts.map((post) => (
        <RemarkCard key={post.unitId} remark={post} />
      ))}
    </Stack>
  );
};
