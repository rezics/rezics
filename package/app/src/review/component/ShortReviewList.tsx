import { Stack } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { SingleRemarkShow } from "./SingleRemark";

/**
 * ShortReviewListShow - now uses PostDTO instead of ReviewDTO.
 * The data shape has changed from { reviews, total } to { posts, total }.
 */
export type ShortReviewListShowProps = {
  data: { posts: PostDTO[]; total?: number };
  onLike?: (postId: string) => void;
  onDislike?: (postId: string) => void;
  spacing?: number | string;
};

export const ShortReviewListShow: React.FC<ShortReviewListShowProps> = ({
  data,
  onLike,
  onDislike,
  spacing = 2,
}) => {
  return (
    <Stack spacing={spacing}>
      {(Array.isArray(data.posts) ? data.posts : []).map((post) => (
        <SingleRemarkShow
          key={post.unitId}
          review={post}
          onLike={onLike}
          onDislike={onDislike}
        />
      ))}
    </Stack>
  );
};
