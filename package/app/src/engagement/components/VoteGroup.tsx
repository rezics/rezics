import {
  KeyboardArrowDown,
  KeyboardArrowUp,
} from "@mui/icons-material";
import { IconButton, Stack, Typography } from "@mui/material";
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

function sizeToIconFontSize(size: EngagementSize): string {
  switch (size) {
    case "sm":
      return "1rem";
    case "lg":
      return "1.5rem";
    default:
      return "1.25rem";
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

  const iconFontSize = sizeToIconFontSize(size);
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

  return (
    <Stack direction="row" alignItems="center" spacing={0.25}>
      <IconButton
        size={buttonSize}
        onClick={handleUp}
        sx={iconButtonSx}
        aria-label="Upvote"
      >
        <KeyboardArrowUp
          sx={{
            fontSize: iconFontSize,
            color:
              userVote === "like"
                ? "var(--rezics-color-text-brand)"
                : "inherit",
          }}
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
              ? "var(--rezics-color-text-brand)"
              : userVote === "dislike"
                ? "error.main"
                : "text.secondary",
          fontWeight: userVote ? 600 : 400,
        }}
      >
        {formatScore(score)}
      </Typography>
      <IconButton
        size={buttonSize}
        onClick={handleDown}
        sx={iconButtonSx}
        aria-label="Downvote"
      >
        <KeyboardArrowDown
          sx={{
            fontSize: iconFontSize,
            color: userVote === "dislike" ? "error.main" : "inherit",
          }}
        />
      </IconButton>
    </Stack>
  );
};
