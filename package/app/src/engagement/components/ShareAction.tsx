import { Button, Menu, MenuItem } from "@mui/material";
import { Share2 } from "lucide-react";
import type React from "react";
import { useShareMenu } from "../hooks/useShareMenu";
import type { EngagementSize } from "../types";
import { useReactionBarContext } from "./ReactionBarContext";

export type ShareActionProps = {
  /** Override the size from context. Rarely needed; prefer setting on the bar. */
  size?: EngagementSize;
  /** Absolute or relative URL to share. Resolved via `getShareHref` at the call site. */
  href: string;
  /** Optional title for the Web Share API. */
  title?: string;
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

export const ShareAction: React.FC<ShareActionProps> = ({
  size: sizeProp,
  href,
  title,
}) => {
  const ctx = useReactionBarContext();
  const size = sizeProp ?? ctx.size;
  const isPill = ctx.variant === "pill";
  const {
    anchorEl,
    open,
    canWebShare,
    handleOpen,
    handleClose,
    handleCopy,
    handleWebShare,
  } = useShareMenu({ href, title });

  return (
    <>
      <Button
        variant="text"
        size={size === "lg" ? "medium" : "small"}
        onClick={handleOpen}
        startIcon={<Share2 size={sizeToIconPx(size)} strokeWidth={2} />}
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
        Share
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={(event) => event.stopPropagation()}
      >
        <MenuItem onClick={handleCopy}>Copy link</MenuItem>
        {canWebShare && <MenuItem onClick={handleWebShare}>Share…</MenuItem>}
      </Menu>
    </>
  );
};
