import { useTheme } from "@mui/material";
import clsx from "clsx";
import React from "react";

export interface ArrowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className?: string }>;
}

export const ArrowButton = React.forwardRef<
  HTMLButtonElement,
  ArrowButtonProps
>(({ icon: Icon, className, children, disabled, ...props }, ref) => {
  const isDark = useTheme().palette.mode === "dark";

  return (
    <button
      ref={ref}
      disabled={disabled}
      aria-disabled={disabled}
      className={clsx(
        "group inline-flex items-center justify-center",
        "h-10 w-10 rounded-full p-0",
        "select-none backdrop-blur-md",
        "transition-[transform,background-color,box-shadow] duration-200 ease-out",

        // Animation
        "hover:shadow-lg active:shadow-md",
        "hover:scale-[1.06] active:scale-[0.98]",

        // focus
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",

        // Theme
        isDark
          ? "bg-white/10 text-white hover:bg-white/16 active:bg-white/20 focus-visible:ring-white/30 shadow-black/40"
          : "bg-black/5 text-black hover:bg-black/10 active:bg-black/14 focus-visible:ring-black/20 shadow-black/15",

        // Disabled styles
        "disabled:opacity-40",
        "disabled:cursor-not-allowed",
        "disabled:shadow-none",
        "disabled:hover:scale-100",
        "disabled:active:scale-100",

        className,
      )}
      aria-label="arrow"
      {...props}
    >
      <Icon className="pointer-events-none size-5" />
      {children}
    </button>
  );
});
