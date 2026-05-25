import { post_collapse_thread } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import type React from "react";
import type { PostTreeNodeModel } from "../models/postTreeRails";
import {
  AVATAR_CENTER_PX,
  AVATAR_CENTER_Y_PX,
  BRANCH_RADIUS_PX,
  RAIL_CAP_RADIUS_PX,
  RAIL_HITBOX_PX,
  RAIL_STROKE_PX,
  TERMINAL_RAIL_HEIGHT_PX,
  THREAD_INDENT_PX,
} from "./postTreeLayout";

const i18nMessages = {
  post_collapse_thread,
};

interface PostTreeRailProps {
  childrenNodes: PostTreeNodeModel[];
  canIndentChildren: boolean;
  railColor: string;
  onRailEnter: () => void;
  onRailLeave: () => void;
  onRailToggle: (event: React.MouseEvent) => void;
  renderChild: (child: PostTreeNodeModel) => React.ReactNode;
}

export function PostTreeRail({
  childrenNodes,
  canIndentChildren,
  railColor,
  onRailEnter,
  onRailLeave,
  onRailToggle,
  renderChild,
}: PostTreeRailProps) {
  const m = useMessage(i18nMessages);
  const railCenterLeftPx = -THREAD_INDENT_PX + AVATAR_CENTER_PX;
  const lineLeftPx = railCenterLeftPx - RAIL_STROKE_PX / 2;
  const railLeftPx = railCenterLeftPx - RAIL_HITBOX_PX / 2;
  const branchWidthPx = THREAD_INDENT_PX;

  return (
    <div
      className="relative"
      style={{ marginLeft: canIndentChildren ? THREAD_INDENT_PX : 0 }}
    >
      {canIndentChildren ? (
        <button
          type="button"
          aria-label={m.post_collapse_thread()}
          className="absolute z-10 cursor-pointer appearance-none border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-brand-fill focus-visible:outline-offset-1"
          style={{
            left: `${railLeftPx}px`,
            top: 0,
            bottom: 0,
            width: `${RAIL_HITBOX_PX}px`,
          }}
          onClick={onRailToggle}
          onMouseEnter={onRailEnter}
          onMouseLeave={onRailLeave}
        />
      ) : null}

      {childrenNodes.map((child, index) => {
        const isLastChild = index === childrenNodes.length - 1;

        return (
          <div key={child.post.unitId} className="relative">
            {canIndentChildren ? (
              <>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-full transition-colors duration-100 ease-in-out"
                  style={{
                    left: `${lineLeftPx}px`,
                    top: 0,
                    bottom: isLastChild ? undefined : 0,
                    height: isLastChild
                      ? `${TERMINAL_RAIL_HEIGHT_PX}px`
                      : undefined,
                    width: `${RAIL_STROKE_PX}px`,
                    borderRadius: `${RAIL_CAP_RADIUS_PX}px`,
                    backgroundColor: railColor,
                  }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute box-border border-0 border-b-2 border-solid transition-colors duration-100 ease-in-out"
                  style={{
                    left: `${lineLeftPx}px`,
                    top: 0,
                    width: `${branchWidthPx}px`,
                    height: `${AVATAR_CENTER_Y_PX}px`,
                    borderBottomLeftRadius: `${BRANCH_RADIUS_PX}px`,
                    borderColor: railColor,
                  }}
                />
              </>
            ) : null}
            {renderChild(child)}
          </div>
        );
      })}
    </div>
  );
}
