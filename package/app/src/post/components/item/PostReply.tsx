import { Box } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import type React from "react";
import { ReactionBar } from "@/engagement";
import {
  postPolicy,
  postReplyRowActions,
  postReplyRowOverflow,
} from "../../models/postPolicy";
import { PostAuthorHeader } from "../parts/PostAuthorHeader";
import { PostBodyMarkdown } from "../parts/PostBodyMarkdown";
import { CollapseToggle } from "../parts/CollapseToggle";
import { ThreadingHoverProvider } from "../parts/ThreadingContext";
import { ThreadingRail } from "../parts/ThreadingRail";

interface PostReplyProps {
  post: PostDTO;
  indentLevel: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onReply?: () => void;
  replyComposerSlot?: React.ReactNode;
}

const INDENT_UNIT_PX = 20;

export const PostReply: React.FC<PostReplyProps> = ({
  post,
  indentLevel,
  isCollapsed,
  onToggleCollapse,
  onReply,
  replyComposerSlot,
}) => {
  const paddingLeft = indentLevel * INDENT_UNIT_PX;
  const hasChildren = (post.directReplyCount ?? 0) > 0;

  return (
    <ThreadingHoverProvider>
      <Box
        sx={{
          position: "relative",
          pl: `${paddingLeft}px`,
        }}
        className="py-2"
      >
        {indentLevel > 0 && (
          <ThreadingRail
            leftPx={paddingLeft - 10}
            isCollapsed={isCollapsed}
            onToggleCollapse={onToggleCollapse}
          />
        )}
        <Box className="flex items-start gap-2">
          {hasChildren ? (
            <Box sx={{ mt: 0.5 }}>
              <CollapseToggle
                isCollapsed={isCollapsed}
                onToggle={onToggleCollapse}
              />
            </Box>
          ) : (
            <Box sx={{ width: 20, height: 20, mt: 0.5 }} />
          )}
          <Box className="flex-1 flex flex-col gap-1">
            <PostAuthorHeader post={post} size="compact" />
            {!isCollapsed && (
              <>
                <PostBodyMarkdown
                  body={post.body ?? ""}
                  clamp={{ maxLines: 4 }}
                  className="text-sm"
                />
                <ReactionBar
                  size="sm"
                  post={post}
                  policy={postPolicy}
                  actions={postReplyRowActions}
                  overflow={postReplyRowOverflow}
                  onReplyInvoke={onReply}
                />
                {replyComposerSlot}
              </>
            )}
          </Box>
        </Box>
      </Box>
    </ThreadingHoverProvider>
  );
};
