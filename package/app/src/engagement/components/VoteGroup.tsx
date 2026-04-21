import {
  KeyboardArrowDown,
  KeyboardArrowUp,
} from "@mui/icons-material";
import { IconButton, Stack, Typography } from "@mui/material";
import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from "@rezics/api/reaction/reaction.mutations";
import type React from "react";
import { useEffect, useState } from "react";
import type { EngagementSize } from "../types";

export type VoteGroupProps = {
  targetUnitId: string;
  initialScore: number;
  initialUserVote?: "like" | "dislike" | null;
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
  size = "md",
}) => {
  const [userVote, setUserVote] = useState<"like" | "dislike" | null>(
    initialUserVote,
  );
  const [score, setScore] = useState<number>(initialScore);

  useEffect(() => {
    setUserVote(initialUserVote);
  }, [initialUserVote]);

  useEffect(() => {
    setScore(initialScore);
  }, [initialScore]);

  const createReaction = useCreateReactionMutation();
  const deleteReaction = useDeleteReactionMutation();

  const applyVote = (next: "like" | "dislike" | null) => {
    const prev = userVote;
    if (prev === next) return;
    const delta =
      (next === "like" ? 1 : next === "dislike" ? -1 : 0) -
      (prev === "like" ? 1 : prev === "dislike" ? -1 : 0);
    setUserVote(next);
    setScore((s) => s + delta);
    if (prev) {
      deleteReaction.mutate({ targetId: targetUnitId, reaction: prev });
    }
    if (next) {
      createReaction.mutate({ targetId: targetUnitId, reaction: next });
    }
  };

  const handleUp = (event: React.MouseEvent) => {
    event.stopPropagation();
    applyVote(userVote === "like" ? null : "like");
  };

  const handleDown = (event: React.MouseEvent) => {
    event.stopPropagation();
    applyVote(userVote === "dislike" ? null : "dislike");
  };

  const iconFontSize = sizeToIconFontSize(size);
  const typoVariant = sizeToTypography(size);
  const buttonSize = size === "lg" ? "medium" : "small";

  return (
    <Stack direction="row" alignItems="center" spacing={0.25}>
      <IconButton
        size={buttonSize}
        onClick={handleUp}
        sx={{ p: size === "sm" ? 0.25 : 0.5 }}
        aria-label="Upvote"
      >
        <KeyboardArrowUp
          sx={{ fontSize: iconFontSize }}
          color={userVote === "like" ? "primary" : "inherit"}
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
              ? "primary.main"
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
        sx={{ p: size === "sm" ? 0.25 : 0.5 }}
        aria-label="Downvote"
      >
        <KeyboardArrowDown
          sx={{ fontSize: iconFontSize }}
          color={userVote === "dislike" ? "error" : "inherit"}
        />
      </IconButton>
    </Stack>
  );
};
