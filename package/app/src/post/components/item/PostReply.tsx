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
  parentLine?: {
    level: number;
    postUnitId: string;
    continuesAfterElbow: boolean;
  };
  continuationLines?: Array<{ level: number; postUnitId: string }>;
  highlightedThreadUnitId?: string;
  isCollapsed: boolean;
  hasThreadChildren?: boolean;
  hasVisibleDescendants?: boolean;
  onToggleCollapse: () => void;
  onThreadHoverChange?: (postUnitId: string, hovered: boolean) => void;
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
  parentLine,
  continuationLines = [],
  highlightedThreadUnitId,
  isCollapsed,
  hasThreadChildren,
  hasVisibleDescendants,
  onToggleCollapse,
  onThreadHoverChange,
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
        {continuationLines.map((line) => (
          <ThreadingRail
            key={`${line.level}-${line.postUnitId}`}
            leftPx={railLeftPxForLevel(line.level)}
            highlighted={highlightedThreadUnitId === line.postUnitId}
            useSharedHover={false}
          />
        ))}
        {parentLine ? (
          <ThreadingRail
            leftPx={railLeftPxForLevel(parentLine.level)}
            elbowWidthPx={
              Math.max(0, indentLevel - parentLine.level) * INDENT_UNIT_PX
            }
            elbowTopPx={TOGGLE_CENTER_Y_PX}
            continuesAfterElbow={parentLine.continuesAfterElbow}
            highlighted={highlightedThreadUnitId === parentLine.postUnitId}
            useSharedHover={false}
          />
        ) : null}
        {hasChildren && (
          <ThreadingRail
            leftPx={railLeftPx}
            isCollapsed={isCollapsed}
            onToggleCollapse={onToggleCollapse}
            showLine={showOwnRail}
            lineStartPx={TOGGLE_CENTER_Y_PX}
            onHoverChange={(hovered) =>
              onThreadHoverChange?.(post.unitId, hovered)
            }
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
