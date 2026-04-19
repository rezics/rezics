import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import { Box, Typography } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import type React from "react";
import { PostAuthorHeader } from "@/post/components/parts/PostAuthorHeader";
import { PostBodyMarkdown } from "@/post/components/parts/PostBodyMarkdown";
import { PostReactionFooter } from "@/post/components/parts/PostReactionFooter";

interface RemarkDetailProps {
  remark: PostDTO;
}

export const RemarkDetail: React.FC<RemarkDetailProps> = ({ remark }) => {
  const rating = (remark.extra as { rating?: number } | null)?.rating;
  const isRecommended = !!(rating && rating >= 3);
  const bookUnitId = remark.targetUnitId;

  return (
    <Box className="flex flex-col gap-4">
      <Box className="flex items-start justify-between gap-4">
        <PostAuthorHeader post={remark} />
        <Box className="flex items-center gap-2">
          {isRecommended ? (
            <ThumbUpIcon color="primary" />
          ) : (
            <ThumbDownIcon color="disabled" />
          )}
          {rating !== undefined && (
            <Typography variant="body2">{rating.toFixed(1)} / 10</Typography>
          )}
        </Box>
      </Box>
      {bookUnitId && (
        <Box>
          <MUILink to="/book/$bookId" params={{ bookId: bookUnitId }}>
            <Typography variant="caption" color="primary">
              View book
            </Typography>
          </MUILink>
        </Box>
      )}
      <PostBodyMarkdown body={remark.body ?? ""} />
      <PostReactionFooter post={remark} />
    </Box>
  );
};
