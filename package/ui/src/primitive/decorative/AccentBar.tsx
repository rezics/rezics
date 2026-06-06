import clsx from "clsx";
import type React from "react";

export interface AccentBarProps {
  height?: number;
  color?: string;
  width?: number;
  radius?: number;
  className?: string;
}

export const AccentBar: React.FC<AccentBarProps> = ({
  height = 24,
  color,
  width = 4,
  radius = 2,
  className,
}) => {
  return (
    <span
      className={clsx(
        "inline-block flex-shrink-0 align-middle",
        color ? undefined : "bg-brand-fill",
        className,
      )}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: `${radius}px`,
        backgroundColor: color,
      }}
    />
  );
};
