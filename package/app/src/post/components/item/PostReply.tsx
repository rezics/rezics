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
  ancestorLines?: Array<{ level: number; isLast: boolean }>;
  isCollapsed: boolean;
  hasThreadChildren?: boolean;
  hasVisibleDescendants?: boolean;
  onToggleCollapse: () => void;
  onReply?: () => void;
  replyComposerSlot?: React.ReactNode;
}

const INDENT_UNIT_PX = 32;
const RAIL_HITBOX_PX = 12;
const TOGGLE_SIZE_PX = 20;
const CONTENT_GAP_PX = 8;
const TOGGLE_TOP_PX = 12;
const TOGGLE_CENTER_Y_PX = TOGGLE_TOP_PX + TOGGLE_SIZE_PX / 2;
const CONTENT_START_PX = TOGGLE_SIZE_PX + CONTENT_GAP_PX;

function railLeftPxForLevel(level: number): number {
  return level * INDENT_UNIT_PX + (TOGGLE_SIZE_PX - RAIL_HITBOX_PX) / 2;
}

export const PostReply: React.FC<PostReplyProps> = ({
  post,
  indentLevel,
  ancestorLines = [],
  isCollapsed,
  hasThreadChildren,
  hasVisibleDescendants,
  onToggleCollapse,
  onReply,
  replyComposerSlot,
}) => {
  const hasChildren = hasThreadChildren ?? (post.directReplyCount ?? 0) > 0;
  const showOwnRail = hasChildren && hasVisibleDescendants && !isCollapsed;
  const contentLeftPx = indentLevel * INDENT_UNIT_PX + CONTENT_START_PX;
  const railLeftPx = railLeftPxForLevel(indentLevel);

  return (
    <ThreadingHoverProvider>
      <div
        className="relative py-2"
        style={{ paddingLeft: `${contentLeftPx}px` }}
      >
        {ancestorLines.map(({ level, isLast }) => (
          <ThreadingRail
            key={level}
            leftPx={railLeftPxForLevel(level)}
            lineEndPx={isLast ? TOGGLE_CENTER_Y_PX : 0}
            roundedEnd={isLast}
          />
        ))}
        {hasChildren && (
          <ThreadingRail
            leftPx={railLeftPx}
            isCollapsed={isCollapsed}
            onToggleCollapse={onToggleCollapse}
            showLine={showOwnRail}
            lineStartPx={TOGGLE_CENTER_Y_PX}
            toggleSlot={
              <CollapseToggle
                isCollapsed={isCollapsed}
                onToggle={onToggleCollapse}
              />
            }
          />
        )}
        <div className="flex items-start">
          <div className="flex-1 flex flex-col gap-1">
            <PostAuthorHeader post={post} size="compact" />
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
          </div>
        </div>
      </div>
    </ThreadingHoverProvider>
  );
};
