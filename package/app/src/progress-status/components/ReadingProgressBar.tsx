import type React from "react";
import { cn } from "@/shared/utils/css-util";

export interface ReadingProgressBarProps {
  /**
   * Completion ratio in [0, 1]. Values outside the range are clamped.
   * 完成比例，取值 [0, 1]。超出范围的值会被钳制。
   */
  value: number;
  /**
   * Optional caption rendered above the bar (e.g. "3 / 10 chapters").
   * 渲染在进度条上方的可选标题（例如 "3 / 10 chapters"）。
   */
  label?: React.ReactNode;
  /**
   * Accessible name for the progress bar.
   * 进度条的无障碍名称。
   */
  ariaLabel: string;
  /**
   * `onDark` adapts the track and label for the always-dark book hero.
   * `onDark` 让轨道和标题适配始终为深色的书籍 hero 区。
   */
  variant?: "default" | "onDark";
  className?: string;
}

/**
 * Shared reading-progress display. Every surface that reflects the same
 * `UserUnitProgress` / `UserContentNodeProgress` fact-source — the dashboard
 * continue-reading cards and the book detail progress hint — renders through
 * this one component so the bar stays visually consistent. Progress is never
 * communicated by color alone: the numeric caption carries the same fact.
 * 共享的阅读进度展示。每个反映同一
 * `UserUnitProgress` / `UserContentNodeProgress` 事实来源的面 —— dashboard
 * 的继续阅读卡片与书籍详情的进度提示 —— 都通过这一个组件渲染，使进度条
 * 在视觉上保持一致。进度从不仅靠颜色传达：数字标题承载着相同的事实。
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
