import type React from "react";
import { useThreadingHover } from "./ThreadingContext";
import { useMessage } from "@rezics/i18n/react";
import {
  post_collapse_thread,
  post_expand_thread,
} from "@rezics/i18n/messages";
const m = {
  post_collapse_thread,
  post_expand_thread,
};

const i18nMessages = {
  post_collapse_thread,
  post_expand_thread,
};

export interface ThreadingRailProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  showLine?: boolean;
  lineStartPx?: number;
  lineEndPx?: number;
  elbowWidthPx?: number;
  elbowTopPx?: number;
  continuesAfterElbow?: boolean;
  toggleSlot?: React.ReactNode;
  /** Horizontal position of the rail within the indent gutter (px). */
  leftPx?: number;
  highlighted?: boolean;
  useSharedHover?: boolean;
  onHoverChange?: (hovered: boolean) => void;
}

const RAIL_STROKE_PX = 2;
const RAIL_HITBOX_PX = 12;
const RAIL_RADIUS_PX = 10;

/**
 * A CSS-painted thread rail inside a reply row's indent gutter. Each row owns
 * its local rail segment, so vertical lines follow normal layout height instead
 * of depending on a tree-wide overlay measurement.
 */
export const ThreadingRail: React.FC<ThreadingRailProps> = ({
  isCollapsed = false,
  onToggleCollapse,
  showLine = true,
  lineStartPx = 0,
  lineEndPx = 0,
  elbowWidthPx = 0,
  elbowTopPx = 0,
  continuesAfterElbow = false,
  toggleSlot,
  leftPx = 0,
  highlighted = false,
  useSharedHover = true,
  onHoverChange,
}) => {
  const m = useMessage(i18nMessages);
  const { hovered, setHovered } = useThreadingHover();

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onToggleCollapse?.();
  };
  const handleHoverChange = (next: boolean) => {
    if (useSharedHover) setHovered(next);
    onHoverChange?.(next);
  };
  const isActive = highlighted || (useSharedHover && hovered);
  const railColorClass = isActive
    ? "border-brand-fill"
    : "border-border-whisper";
  const railFillClass = isActive ? "bg-brand-fill" : "bg-border-whisper";
  const hitWidthPx = Math.max(RAIL_HITBOX_PX, elbowWidthPx + RAIL_HITBOX_PX);
  const elbowRadius = Math.min(
    RAIL_RADIUS_PX,
    Math.max(0, elbowTopPx - RAIL_STROKE_PX),
    elbowWidthPx,
  );

  return (
    <>
      <div
        className={[
          "absolute z-10 transition-colors duration-100 ease-in-out",
          onToggleCollapse ? "cursor-pointer" : "pointer-events-none",
        ].join(" ")}
        style={{
          left: `${leftPx}px`,
          top: 0,
          bottom: 0,
          width: `${hitWidthPx}px`,
        }}
        aria-hidden="true"
        onMouseEnter={() => handleHoverChange(true)}
        onMouseLeave={() => handleHoverChange(false)}
        onClick={onToggleCollapse ? handleClick : undefined}
      >
        {showLine && elbowWidthPx === 0 ? (
          <div
            data-testid="threading-rail-line"
            className={[
              "absolute left-1/2 w-0.5 -translate-x-1/2 transition-colors duration-100 ease-in-out",
              railFillClass,
            ].join(" ")}
            style={{
              top: `${lineStartPx}px`,
              bottom: `${lineEndPx}px`,
            }}
          />
        ) : null}
        {showLine && elbowWidthPx > 0 ? (
          <>
            <div
              data-testid="threading-rail-branch"
              className={[
                "absolute left-1/2 top-0 box-border border-0 border-l-2 border-b-2 border-solid transition-colors duration-100 ease-in-out",
                railColorClass,
              ].join(" ")}
              style={{
                width: `${elbowWidthPx}px`,
                height: `${elbowTopPx}px`,
                borderBottomLeftRadius: `${elbowRadius}px`,
              }}
            />
            {continuesAfterElbow ? (
              <div
                data-testid="threading-rail-line"
                className={[
                  "absolute left-1/2 w-0.5 -translate-x-1/2 transition-colors duration-100 ease-in-out",
                  railFillClass,
                ].join(" ")}
                style={{
                  top: `${elbowTopPx}px`,
                  bottom: `${lineEndPx}px`,
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>
      {toggleSlot ? (
        <div
          className="absolute top-3 z-20 -translate-x-1/2"
          style={{ left: `${leftPx + 6}px` }}
        >
          {toggleSlot}
        </div>
      ) : null}
      {onToggleCollapse && showLine ? (
        <button
          type="button"
          aria-label={
            isCollapsed ? m.post_expand_thread() : m.post_collapse_thread()
          }
          onClick={handleClick}
          onMouseEnter={() => handleHoverChange(true)}
          onMouseLeave={() => handleHoverChange(false)}
          data-hovered={isActive ? "true" : undefined}
          className="absolute z-20 cursor-pointer appearance-none border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-brand-fill focus-visible:outline-offset-1"
          style={{
            left: `${leftPx}px`,
            top: `${Math.max(lineStartPx, 0)}px`,
            bottom: `${lineEndPx}px`,
            width: `${hitWidthPx}px`,
          }}
        />
      ) : null}
    </>
  );
};
