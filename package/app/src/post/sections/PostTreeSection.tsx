import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { postThreadQuery } from "@rezics/api/post/post";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { PostReply } from "../components/item/PostReply";
import { usePostTreeCollapse } from "../hooks/usePostTreeCollapse";

interface PostTreeSectionProps {
  rootPostUnitId: string;
  maxDepth?: number;
  visualMaxDepth?: number;
  onReply?: (postId: string) => void;
}

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_VISUAL_MAX_DEPTH = 4;

export const PostTreeSection: React.FC<PostTreeSectionProps> = ({
  rootPostUnitId,
  maxDepth = DEFAULT_MAX_DEPTH,
  visualMaxDepth = DEFAULT_VISUAL_MAX_DEPTH,
  onReply,
}) => {
  const { data, isLoading } = useQuery(
    postThreadQuery(rootPostUnitId, { mode: "threaded", maxDepth }),
  );
  const posts = data?.posts ?? [];
  const { isCollapsed, toggleCollapse, visiblePosts } =
    usePostTreeCollapse(posts);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  return (
    <Box>
      {visiblePosts.map((post) => {
        const depth = post.depth ?? 0;
        const indentLevel = Math.min(depth, visualMaxDepth);
        const atMaxDepth =
          depth === maxDepth && (post.directReplyCount ?? 0) > 0;

        return (
          <Box key={post.unitId}>
            <PostReply
              post={post}
              indentLevel={indentLevel}
              isCollapsed={isCollapsed(post.unitId)}
              onToggleCollapse={() => toggleCollapse(post.unitId)}
              onReply={onReply ? () => onReply(post.unitId) : undefined}
            />
            {atMaxDepth && (
              <Box sx={{ pl: `${(indentLevel + 1) * 20}px`, py: 0.5 }}>
                <MUILink
                  to="/post/$rootPostUnitId/continue/$unitId"
                  params={{
                    rootPostUnitId,
                    unitId: post.unitId,
                  }}
                >
                  <Typography variant="caption" color="primary">
                    Continue thread →
                  </Typography>
                </MUILink>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
