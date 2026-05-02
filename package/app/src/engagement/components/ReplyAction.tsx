import { Button } from "@mui/material";
import { MessageSquare } from "lucide-react";
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

function sizeToIconPx(size: EngagementSize): number {
  switch (size) {
    case "sm":
      return 16;
    case "lg":
      return 22;
    default:
      return 18;
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
  const isPill = ctx.variant === "pill";

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
      startIcon={<MessageSquare size={sizeToIconPx(size)} strokeWidth={2} />}
      sx={{
        color: "text.secondary",
        textTransform: "none",
        fontSize:
          size === "sm" ? "0.75rem" : size === "lg" ? "0.95rem" : "0.875rem",
        minWidth: 0,
        px: size === "sm" ? 1 : 1.25,
        ...(isPill && {
          borderRadius: "var(--rezics-radius-pill, 999px)",
          bgcolor: (theme: { palette: { mode: string } }) =>
            theme.palette.mode === "dark"
              ? "rgba(255, 255, 255, 0.04)"
              : "rgba(0, 0, 0, 0.04)",
        }),
        "&:hover": {
          bgcolor: (theme: { palette: { mode: string } }) =>
            theme.palette.mode === "dark"
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(0, 0, 0, 0.08)",
          color: "text.primary",
        },
      }}
    >
      {label}
    </Button>
  );
};
