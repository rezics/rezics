import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import { Tooltip, Typography, Box } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { ReactionBar } from "@/engagement";
import { PostAuthorHeader } from "@/post/components/parts/PostAuthorHeader";
import { PostBodyMarkdown } from "@/post/components/parts/PostBodyMarkdown";
import {
  remarkCardActions,
  remarkPolicy,
} from "../../models/remarkPolicy";

interface RemarkRatingBadgeProps {
  remark: PostDTO;
}

const RemarkRatingBadge: React.FC<RemarkRatingBadgeProps> = ({ remark }) => {
  const rating = (remark.extra as { rating?: number } | null)?.rating;
  const isRecommended = !!(rating && rating >= 3);
  const dateStr = remark.createdAt
    ? new Date(String(remark.createdAt)).toLocaleDateString()
    : "";

  return (
    <Tooltip title="阅读完整评测" placement="top-start">
      <MUILink
        to="/remark/$reviewId"
        params={{ reviewId: remark.unitId }}
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
        sx={{
          textDecoration: "none",
          color: "inherit",
          p: 0.5,
          borderRadius: 1,
          transition: "background-color 0.2s ease",
          "&:hover": { backgroundColor: "action.hover" },
        }}
      >
        {isRecommended ? (
          <ThumbUpIcon fontSize="small" color="primary" />
        ) : (
          <ThumbDownIcon fontSize="small" color="disabled" />
        )}
        <Typography variant="caption">
          {rating?.toFixed(1) ?? "0.0"}/10 · {dateStr}
        </Typography>
      </MUILink>
    </Tooltip>
  );
};

interface RemarkCardProps {
  remark: PostDTO;
}

export const RemarkCard: React.FC<RemarkCardProps> = ({ remark }) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (!remark.unitId) return;
    navigate({ to: "/remark/$reviewId", params: { reviewId: remark.unitId } });
  };

  const handleReplyInvoke = () => {
    if (!remark.unitId) return;
    navigate({
      to: "/remark/$reviewId",
      params: { reviewId: remark.unitId },
      search: { focus: "reply" },
    });
  };

  return (
    <Box
      className="py-4 border-b border-gray-200 dark:border-gray-700"
      onClick={handleCardClick}
      sx={remark.unitId ? { cursor: "pointer" } : undefined}
    >
      <Box className="flex flex-col gap-2">
        <Box className="flex items-center gap-2">
          <PostAuthorHeader post={remark} />
          <Box ml="auto">
            <RemarkRatingBadge remark={remark} />
          </Box>
        </Box>
        <PostBodyMarkdown body={remark.body ?? ""} clamp={{ maxLines: 4 }} />
        <ReactionBar
          size="md"
          post={remark}
          policy={remarkPolicy}
          actions={remarkCardActions}
          onReplyInvoke={handleReplyInvoke}
        />
      </Box>
    </Box>
  );
};
