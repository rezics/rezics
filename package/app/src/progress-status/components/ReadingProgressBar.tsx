import type React from "react";
import { cn } from "@/shared/utils/css-util";

export interface ReadingProgressBarProps {
  /** Completion ratio in [0, 1]. Values outside the range are clamped. */
  value: number;
  /** Optional caption rendered above the bar (e.g. "3 / 10 chapters"). */
  label?: React.ReactNode;
  /** Accessible name for the progress bar. */
  ariaLabel: string;
  /** `onDark` adapts the track and label for the always-dark book hero. */
  variant?: "default" | "onDark";
  className?: string;
}

/**
 * Shared reading-progress display. Every surface that reflects the same
 * `UserUnitProgress` / `UserContentNodeProgress` fact-source — the dashboard
 * continue-reading cards and the book detail progress hint — renders through
 * this one component so the bar stays visually consistent. Progress is never
 * communicated by color alone: the numeric caption carries the same fact.
 */
export const ReadingProgressBar: React.FC<ReadingProgressBarProps> = ({
  value,
  label,
  ariaLabel,
  variant = "default",
  className,
}) => {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const onDark = variant === "onDark";
  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      {label != null ? (
        <span
          className={cn(
            "text-xs",
            onDark ? "text-white/70" : "text-text-secondary",
          )}
        >
          {label}
        </span>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={ariaLabel}
        className={cn(
          "h-1 w-full overflow-hidden rounded",
          onDark ? "bg-white/15" : "bg-surface-sunken",
        )}
      >
        <div className="h-full bg-brand" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};
