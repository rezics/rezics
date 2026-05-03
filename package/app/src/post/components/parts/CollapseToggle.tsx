import { IconButton } from "@mui/material";
import type React from "react";
import { useThreadingHover } from "./ThreadingContext";
import { Plus as AddIcon, Minus as RemoveIcon } from "lucide-react";

export interface CollapseToggleProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export const CollapseToggle: React.FC<CollapseToggleProps> = ({
  isCollapsed,
  onToggle,
}) => {
  const { hovered, setHovered } = useThreadingHover();

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onToggle();
  };

  return (
    <IconButton
      size="small"
      aria-label={isCollapsed ? "Expand replies" : "Collapse replies"}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-hovered={hovered ? "true" : undefined}
      sx={{
        width: 20,
        height: 20,
        border: "1px solid",
        borderColor: hovered ? "primary.main" : "divider",
        color: hovered ? "primary.main" : "text.secondary",
        borderRadius: "50%",
        p: 0,
        transition: "border-color 120ms ease, color 120ms ease",
      }}
    >
      {isCollapsed ? (
        <AddIcon size={14} />
      ) : (
        <RemoveIcon size={14} />
      )}
    </IconButton>
  );
};
