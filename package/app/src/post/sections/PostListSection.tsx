import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { postsByTargetQuery } from "@rezics/api/post/post";
import type { PostKind } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
import { PostCard } from "../components/item/PostCard";

interface PostListSectionProps {
  targetUnitId: string;
  kind?: PostKind;
  limit?: number;
  onReply?: (postId: string) => void;
}

export const PostListSection: React.FC<PostListSectionProps> = ({
  targetUnitId,
  kind,
  limit = 20,
  onReply: _onReply,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(
    postsByTargetQuery(targetUnitId, {
      kind,
      limit,
      parentPostUnitId: undefined,
    }),
  );
  const posts = data?.posts ?? [];

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (posts.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" py={2}>
        {t("discussion.empty", "No discussions yet.")}
      </Typography>
    );
  }

  return (
    <Box>
      {posts
        .filter((post) => !post.parentPostUnitId)
        .map((post) => (
          <PostCard
            key={post.unitId}
            post={post}
            onOpen={() =>
              navigate({
                to: "/post/$rootPostUnitId",
                params: { rootPostUnitId: post.unitId },
              })
            }
          />
        ))}
    </Box>
  );
};
