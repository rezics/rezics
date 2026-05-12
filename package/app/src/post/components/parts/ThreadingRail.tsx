import type React from "react";
import { useThreadingHover } from "./ThreadingContext";

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

/**
 * A 2 px vertical stroke painted inside a reply row's indent gutter, with a
 * ~12 px transparent hit-box for easier click/hover. Clicking toggles the
 * row's collapse state; hovering broadcasts through `ThreadingHoverContext`.
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
  const strokeClass = isActive ? "text-brand-fill" : "text-border-whisper";
  const elbowRadius = Math.min(10, Math.max(0, elbowTopPx - 2), elbowWidthPx);
  const elbowVerticalEndPx = Math.max(0, elbowTopPx - elbowRadius);
  const elbowPath =
    elbowWidthPx > 0
      ? [
          `M 1 ${elbowVerticalEndPx}`,
          `Q 1 ${elbowTopPx - 1} ${elbowRadius + 1} ${elbowTopPx - 1}`,
          `H ${elbowWidthPx}`,
        ].join(" ")
      : "";

  return (
    <>
      <div
        className={[
          "absolute w-3",
          onToggleCollapse ? "cursor-pointer" : "pointer-events-none",
        ].join(" ")}
        style={{
          left: `${leftPx}px`,
          top: `${lineStartPx}px`,
          bottom: `${lineEndPx}px`,
        }}
        onMouseEnter={() => handleHoverChange(true)}
        onMouseLeave={() => handleHoverChange(false)}
      >
        {showLine && elbowWidthPx === 0 ? (
          <div
            className={[
              "absolute left-1/2 top-0 h-full border-l-2 transition-colors duration-100 ease-in-out",
              isActive ? "border-brand-fill" : "border-border-whisper",
            ].join(" ")}
          />
        ) : null}
        {showLine && elbowWidthPx > 0 ? (
          <>
            <div
              className={[
                "absolute left-1/2 top-0 border-l-2 transition-colors duration-100 ease-in-out",
                isActive ? "border-brand-fill" : "border-border-whisper",
              ].join(" ")}
              style={{
                height: continuesAfterElbow
                  ? "100%"
                  : `${elbowVerticalEndPx}px`,
              }}
            />
            <svg
              aria-hidden="true"
              className={[
                "absolute left-1/2 top-0 overflow-visible transition-colors duration-100 ease-in-out",
                strokeClass,
              ].join(" ")}
              fill="none"
              height={elbowTopPx}
              style={{
                width: `${elbowWidthPx}px`,
              }}
              width={elbowWidthPx}
            >
              <path
                d={elbowPath}
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth={2}
              />
            </svg>
          </>
        ) : null}
      </div>
      {toggleSlot ? (
        <div
          className="absolute top-3 z-10 -translate-x-1/2"
          style={{ left: `${leftPx + 6}px` }}
          onMouseEnter={() => handleHoverChange(true)}
          onMouseLeave={() => handleHoverChange(false)}
        >
          {toggleSlot}
        </div>
      ) : null}
      {onToggleCollapse && showLine ? (
        <button
          type="button"
          aria-label={isCollapsed ? "Expand thread" : "Collapse thread"}
          onClick={handleClick}
          onMouseEnter={() => handleHoverChange(true)}
          onMouseLeave={() => handleHoverChange(false)}
          data-hovered={isActive ? "true" : undefined}
          className="absolute top-8 bottom-0 w-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-fill focus-visible:outline-offset-1"
          style={{ left: `${leftPx}px` }}
        />
      ) : null}
    </>
  );
};
