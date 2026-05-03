import { Button } from "@rezics/ui/shadcn";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import type React from "react";
import { cn } from "@/shared/utils/css-util";
import { useVoteController, type VoteValue } from "../hooks/useVoteController";
import type { EngagementSize } from "../types";
import { useReactionBarContext } from "./ReactionBarContext";

export type VoteGroupProps = {
  targetUnitId: string;
  initialScore: number;
  initialUserVote?: VoteValue;
  /** Override the size from context. Rarely needed; prefer setting on the bar. */
  size?: EngagementSize;
};

function formatScore(score: number): string {
  const abs = Math.abs(score);
  if (abs < 1000) return String(score);
  const sign = score < 0 ? "-" : "";
  const k = abs / 1000;
  return `${sign}${k.toFixed(k < 10 ? 1 : 0).replace(/\.0$/, "")}K`;
}

function sizeToIconPx(size: EngagementSize): number {
  switch (size) {
    case "sm":
      return 16;
    case "lg":
      return 24;
    default:
      return 20;
  }
}

function sizeToTextClass(size: EngagementSize): string {
  switch (size) {
    case "sm":
      return "text-xs";
    case "lg":
      return "text-base";
    default:
      return "text-sm";
  }
}

export const VoteGroup: React.FC<VoteGroupProps> = ({
  targetUnitId,
  initialScore,
  initialUserVote = null,
  size: sizeProp,
}) => {
  const ctx = useReactionBarContext();
  const size = sizeProp ?? ctx.size;
  const variant = ctx.variant;
  const { score, userVote, toggleUp, toggleDown } = useVoteController({
    targetUnitId,
    initialScore,
    initialUserVote,
  });

  const handleUp = (event: React.MouseEvent) => {
    event.stopPropagation();
    toggleUp();
  };

  const handleDown = (event: React.MouseEvent) => {
    event.stopPropagation();
    toggleDown();
  };

  const iconPx = sizeToIconPx(size);
  const textClass = sizeToTextClass(size);
  const buttonSizeClass = size === "sm" ? "p-0.5" : "p-1";

  const upActive = userVote === "like";
  const downActive = userVote === "dislike";

  const groupClass =
    variant === "pill"
      ? "rounded-[var(--rezics-radius-pill,999px)] bg-black/5 dark:bg-white/5 px-1 py-0.5"
      : "";

  return (
    <div className={cn("flex flex-row items-center gap-0.5", groupClass)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleUp}
        aria-label="Upvote"
        className={cn(
          buttonSizeClass,
          "h-auto w-auto hover:bg-black/10 dark:hover:bg-white/10",
          upActive
            ? "text-[var(--rezics-color-sentiment-positive-text)]"
            : "text-rezics-color-fg-muted",
        )}
      >
        <ArrowBigUp
          size={iconPx}
          fill={upActive ? "currentColor" : "none"}
          strokeWidth={2}
        />
      </Button>
      <span
        className={cn(
          "min-w-[2ch] text-center tabular-nums",
          textClass,
          userVote === "like"
            ? "font-semibold text-[var(--rezics-color-sentiment-positive-text)]"
            : userVote === "dislike"
              ? "font-semibold text-[var(--rezics-color-sentiment-negative-text)]"
              : "text-rezics-color-fg-muted",
        )}
      >
        {formatScore(score)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDown}
        aria-label="Downvote"
        className={cn(
          buttonSizeClass,
          "h-auto w-auto hover:bg-black/10 dark:hover:bg-white/10",
          downActive
            ? "text-[var(--rezics-color-sentiment-negative-text)]"
            : "text-rezics-color-fg-muted",
        )}
      >
        <ArrowBigDown
          size={iconPx}
          fill={downActive ? "currentColor" : "none"}
          strokeWidth={2}
        />
      </Button>
    </div>
  );
};
