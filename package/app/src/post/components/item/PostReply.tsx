import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, IconButton } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { PostAuthorHeader } from "../parts/PostAuthorHeader";
import { PostBodyMarkdown } from "../parts/PostBodyMarkdown";
import { PostReactionFooter } from "../parts/PostReactionFooter";

interface PostReplyProps {
  post: PostDTO;
  indentLevel: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onReply?: () => void;
}

const INDENT_UNIT_PX = 20;

export const PostReply: React.FC<PostReplyProps> = ({
  post,
  indentLevel,
  isCollapsed,
  onToggleCollapse,
  onReply,
}) => {
  const paddingLeft = indentLevel * INDENT_UNIT_PX;
  const realDepth = post.depth ?? 0;

  return (
    <Box
      sx={{
        pl: `${paddingLeft}px`,
        borderLeft: realDepth > 0 ? "2px solid" : "none",
        borderColor: "divider",
        ["--post-depth" as unknown as string]: String(realDepth),
      }}
      className="py-2"
    >
      <Box className="flex items-start gap-2">
        <IconButton
          size="small"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Expand" : "Collapse"}
          sx={{ mt: 0.5 }}
        >
          {isCollapsed ? (
            <ExpandMoreIcon fontSize="small" />
          ) : (
            <ExpandLessIcon fontSize="small" />
          )}
        </IconButton>
        <Box className="flex-1 flex flex-col gap-1">
          <PostAuthorHeader post={post} size="compact" />
          {!isCollapsed && (
            <>
              <PostBodyMarkdown
                body={post.body ?? ""}
                clamp={{ maxLines: 4 }}
                className="text-sm"
              />
              <PostReactionFooter post={post} onReply={onReply} />
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};
