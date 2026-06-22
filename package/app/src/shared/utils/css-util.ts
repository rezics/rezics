import type { CSSProperties } from "react";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type WebkitClampStyle = CSSProperties & {
  WebkitBoxOrient?: "vertical";
  WebkitLineClamp?: number;
};

// Inline style for -webkit-line-clamp (dynamic line count).
// 用于 -webkit-line-clamp 的内联样式（动态行数）。
export function clampStyle(lines: number): WebkitClampStyle {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
}
