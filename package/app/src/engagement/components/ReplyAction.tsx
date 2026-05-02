import { ChatBubbleOutline } from "@mui/icons-material";
import { Button } from "@mui/material";
import type React from "react";
import type { EngagementSize } from "../types";
import { useReactionBarContext } from "./ReactionBarContext";

export type ReplyActionProps = {
  /** Override the size from context. Rarely needed; prefer setting on the bar. */
  size?: EngagementSize;
  replyCount?: number;
  mode?: "count" | "label";
  onInvoke?: () => void;
};

function sizeToIconFontSize(size: EngagementSize): string {
  switch (size) {
    case "sm":
      return "1rem";
    case "lg":
      return "1.375rem";
    default:
      return "1.125rem";
  }
}

export const ReplyAction: React.FC<ReplyActionProps> = ({
  size: sizeProp,
  replyCount = 0,
  mode = "count",
  onInvoke,
}) => {
  const ctx = useReactionBarContext();
  const size = sizeProp ?? ctx.size;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onInvoke?.();
  };

  const showCount = mode === "count" && replyCount > 0;
  const label = showCount ? String(replyCount) : "Reply";

  return (
    <Button
      variant="text"
      size={size === "lg" ? "medium" : "small"}
      onClick={handleClick}
      startIcon={
        <ChatBubbleOutline sx={{ fontSize: sizeToIconFontSize(size) }} />
      }
      sx={{
        color: "text.secondary",
        textTransform: "none",
        fontSize:
          size === "sm" ? "0.75rem" : size === "lg" ? "0.95rem" : "0.875rem",
        minWidth: 0,
        px: size === "sm" ? 0.75 : 1,
        "&:hover": {
          bgcolor: (theme: { palette: { mode: string } }) =>
            theme.palette.mode === "dark"
              ? "rgba(255, 255, 255, 0.06)"
              : "rgba(0, 0, 0, 0.06)",
          color: "text.primary",
        },
      }}
    >
      {label}
    </Button>
  );
};
