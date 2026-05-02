import { IconButton, Stack, Typography } from "@mui/material";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import type React from "react";
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

function sizeToTypography(size: EngagementSize): "caption" | "body2" | "body1" {
  switch (size) {
    case "sm":
      return "caption";
    case "lg":
      return "body1";
    default:
      return "body2";
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
  const typoVariant = sizeToTypography(size);
  const buttonSize = size === "lg" ? "medium" : "small";

  const iconButtonSx = {
    p: size === "sm" ? 0.25 : 0.5,
    color: "text.secondary",
    "&:hover": {
      bgcolor: (theme: { palette: { mode: string } }) =>
        theme.palette.mode === "dark"
          ? "rgba(255, 255, 255, 0.06)"
          : "rgba(0, 0, 0, 0.06)",
    },
  };

  const upActive = userVote === "like";
  const downActive = userVote === "dislike";

  const groupSx =
    variant === "pill"
      ? {
          borderRadius: "var(--rezics-radius-pill, 999px)",
          bgcolor: (theme: { palette: { mode: string } }) =>
            theme.palette.mode === "dark"
              ? "rgba(255, 255, 255, 0.04)"
              : "rgba(0, 0, 0, 0.04)",
          px: 0.5,
          py: 0.25,
        }
      : undefined;

  return (
    <Stack direction="row" alignItems="center" spacing={0.25} sx={groupSx}>
      <IconButton
        size={buttonSize}
        onClick={handleUp}
        sx={{
          ...iconButtonSx,
          color: upActive
            ? "var(--rezics-color-sentiment-positive-text)"
            : "text.secondary",
        }}
        aria-label="Upvote"
      >
        <ArrowBigUp
          size={iconPx}
          fill={upActive ? "currentColor" : "none"}
          strokeWidth={2}
        />
      </IconButton>
      <Typography
        variant={typoVariant}
        sx={{
          minWidth: "2ch",
          textAlign: "center",
          fontVariantNumeric: "tabular-nums",
          color:
            userVote === "like"
              ? "var(--rezics-color-sentiment-positive-text)"
              : userVote === "dislike"
                ? "var(--rezics-color-sentiment-negative-text)"
                : "text.secondary",
          fontWeight: userVote ? 600 : 400,
        }}
      >
        {formatScore(score)}
      </Typography>
      <IconButton
        size={buttonSize}
        onClick={handleDown}
        sx={{
          ...iconButtonSx,
          color: downActive
            ? "var(--rezics-color-sentiment-negative-text)"
            : "text.secondary",
        }}
        aria-label="Downvote"
      >
        <ArrowBigDown
          size={iconPx}
          fill={downActive ? "currentColor" : "none"}
          strokeWidth={2}
        />
      </IconButton>
    </Stack>
  );
};
