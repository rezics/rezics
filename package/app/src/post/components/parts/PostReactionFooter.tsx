import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { Box, Tooltip, Typography } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { parseReactionSummaries } from "@/shared/utils/reaction-summaries-parser";

interface PostReactionFooterProps {
  post: PostDTO;
  onReply?: () => void;
}

export const PostReactionFooter: React.FC<PostReactionFooterProps> = ({
  post,
  onReply,
}) => {
  const reactions = parseReactionSummaries(post.reactionSummaries ?? []);

  return (
    <Box className="flex items-center justify-between gap-3 text-gray-600 dark:text-gray-400">
      <Typography variant="caption" color="text.secondary">
        {reactions.likes ?? 0} likes
      </Typography>
      <Tooltip title="Replies">
        <Box
          className="flex items-center gap-1"
          sx={onReply ? { cursor: "pointer" } : undefined}
          onClick={onReply}
        >
          <ChatBubbleOutlineIcon style={{ fontSize: "1rem" }} />
          <Typography variant="caption">{post.replyCount ?? 0}</Typography>
        </Box>
      </Tooltip>
    </Box>
  );
};
