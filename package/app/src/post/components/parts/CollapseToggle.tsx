import { Plus as AddIcon, Minus as RemoveIcon } from "lucide-react";
import type React from "react";
import { useThreadingHover } from "./ThreadingContext";

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
    <button
      type="button"
      aria-label={isCollapsed ? "Expand replies" : "Collapse replies"}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-hovered={hovered ? "true" : undefined}
      className={[
        "inline-flex items-center justify-center w-5 h-5 rounded-full border bg-surface-canvas p-0 transition-colors duration-100 ease-in-out",
        hovered
          ? "border-brand-fill text-text-brand"
          : "border-border-whisper text-text-tertiary",
      ].join(" ")}
    >
      {isCollapsed ? <AddIcon size={14} /> : <RemoveIcon size={14} />}
    </button>
  );
};
