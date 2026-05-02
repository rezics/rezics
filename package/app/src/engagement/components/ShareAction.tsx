import { IosShare } from "@mui/icons-material";
import { Button, Menu, MenuItem } from "@mui/material";
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

export const ShareAction: React.FC<ShareActionProps> = ({
  size: sizeProp,
  href,
  title,
}) => {
  const ctx = useReactionBarContext();
  const size = sizeProp ?? ctx.size;
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
        startIcon={<IosShare sx={{ fontSize: sizeToIconFontSize(size) }} />}
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
