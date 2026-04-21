import { Box } from "@mui/material";
import type React from "react";
import { useThreadingHover } from "./ThreadingContext";

export interface ThreadingRailProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
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
  leftPx = 0,
}) => {
  const { hovered, setHovered } = useThreadingHover();

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onToggleCollapse();
  };

  return (
    <Box
      role="button"
      aria-label={isCollapsed ? "Expand thread" : "Collapse thread"}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleCollapse();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-hovered={hovered ? "true" : undefined}
      sx={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `${leftPx}px`,
        width: "12px",
        cursor: "pointer",
        display: "flex",
        justifyContent: "center",
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: "1px",
        },
      }}
    >
      <Box
        sx={{
          width: "2px",
          height: "100%",
          backgroundColor: hovered ? "primary.main" : "divider",
          transition: "background-color 120ms ease",
        }}
      />
    </Box>
  );
};
