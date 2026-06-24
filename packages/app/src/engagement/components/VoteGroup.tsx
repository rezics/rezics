import { useReactionData } from "@rezics/contract/api/reaction/reaction";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import type React from "react";
import { cn } from "@/shared/utils/css-util";
import { useVoteController } from "../hooks/useVoteController";
import type { EngagementSize } from "../types";
import { useReactionBarContext } from "./ReactionBarContext";

export type VoteGroupProps = {
  targetId: string;
  summaryContextUnitId?: string | null;
  userContextUnitId?: string | null;
  /**
   * Override the size from context. Rarely needed; prefer setting on the bar.
   * 覆盖来自 context 的 size。很少需要；优先在 bar 上设置。
   */
  size?: EngagementSize;
};

export const VoteGroup: React.FC<VoteGroupProps> = ({
  targetId,
  summaryContextUnitId,
  userContextUnitId,
  size: sizeProp,
}) => {
  const { t } = useTranslation(["community"]);
  const ctx = useReactionBarContext();
  const size = sizeProp ?? ctx.size;
  const variant = ctx.variant;
  const { summary, userReactions, isHydrated } = useReactionData(targetId, {
    summaryContextUnitId,
    userContextUnitId,
  });
  const score = (summary.upvote ?? 0) - (summary.downvote ?? 0);
  const userVote: "upvote" | "downvote" | null = userReactions.includes(
    "upvote",
  )
    ? "upvote"
    : userReactions.includes("downvote")
      ? "downvote"
      : null;
  const { toggleUp, toggleDown, auth } = useVoteController({
    targetId,
    contextUnitId: userContextUnitId ?? null,
    userVote,
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

  const upActive = isHydrated && userVote === "upvote";
  const downActive = isHydrated && userVote === "downvote";

  const groupClass =
    variant === "pill"
      ? "rounded-[var(--radius-pill,999px)] bg-black/5 dark:bg-white/5 px-1 py-0.5"
      : "";

  const scoreLabelClass = !isHydrated
    ? "text-text-secondary"
    : userVote === "upvote"
      ? "font-semibold text-sentiment-positive-text"
      : userVote === "downvote"
        ? "font-semibold text-sentiment-negative-text"
        : "text-text-secondary";

  return (
    <div className={cn("flex flex-row items-center gap-0.5", groupClass)}>
      {auth.AuthModal({})}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleUp}
        aria-label={t("community:tag_upvote")}
        className={cn(
          buttonSizeClass,
          "h-auto w-auto hover:bg-black/10 dark:hover:bg-white/10",
          upActive ? "text-sentiment-positive-text" : "text-text-secondary",
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
          scoreLabelClass,
        )}
      >
        {isHydrated ? formatScore(score) : "—"}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDown}
        aria-label={t("community:tag_downvote")}
        className={cn(
          buttonSizeClass,
          "h-auto w-auto hover:bg-black/10 dark:hover:bg-white/10",
          downActive ? "text-sentiment-negative-text" : "text-text-secondary",
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
