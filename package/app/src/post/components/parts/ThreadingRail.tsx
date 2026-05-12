import type React from "react";
import { useThreadingHover } from "./ThreadingContext";

export interface ThreadingRailProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  toggleSlot?: React.ReactNode;
  /** Horizontal position of the rail within the indent gutter (px). */
  leftPx?: number;
}

/**
 * A 2 px vertical stroke painted inside a reply row's indent gutter, with a
 * ~12 px transparent hit-box for easier click/hover. Clicking toggles the
 * row's collapse state; hovering broadcasts through `ThreadingHoverContext`.
 */
export const ThreadingRail: React.FC<ThreadingRailProps> = ({
  isCollapsed,
  onToggleCollapse,
  toggleSlot,
  leftPx = 0,
}) => {
  const { hovered, setHovered } = useThreadingHover();

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onToggleCollapse();
  };

  return (
    <>
      <button
        type="button"
        aria-label={isCollapsed ? "Expand thread" : "Collapse thread"}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        data-hovered={hovered ? "true" : undefined}
        className="absolute top-0 bottom-0 w-3 cursor-pointer flex justify-center focus-visible:outline-2 focus-visible:outline-brand-fill focus-visible:outline-offset-1"
        style={{ left: `${leftPx}px` }}
      >
        <div
          className={[
            "w-[2px] h-full transition-colors duration-100 ease-in-out",
            hovered ? "bg-brand-fill" : "bg-border-whisper",
          ].join(" ")}
        />
      </button>
      {toggleSlot ? (
        <div
          className="absolute top-3 z-10 -translate-x-1/2"
          style={{ left: `${leftPx + 6}px` }}
        >
          {toggleSlot}
        </div>
      ) : null}
    </>
  );
};
