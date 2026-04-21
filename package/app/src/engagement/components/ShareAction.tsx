import { IosShare } from "@mui/icons-material";
import { Button, Menu, MenuItem } from "@mui/material";
import type React from "react";
import { useState } from "react";
import type { EngagementSize } from "../types";

export type ShareActionProps = {
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

function absolute(href: string): string {
  if (/^https?:\/\//.test(href)) return href;
  if (typeof window === "undefined") return href;
  return window.location.origin + href;
}

export const ShareAction: React.FC<ShareActionProps> = ({
  size = "md",
  href,
  title,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (event?: React.MouseEvent | {}) => {
    if (event && "stopPropagation" in event) {
      (event as React.MouseEvent).stopPropagation();
    }
    setAnchorEl(null);
  };

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(absolute(href));
    } catch {
      // swallow — clipboard write can fail in insecure contexts
    }
    setAnchorEl(null);
  };

  const canWebShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function";

  const handleWebShare = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await (navigator as Navigator).share({
        url: absolute(href),
        title,
      });
    } catch {
      // user-cancelled or unsupported; nothing to do
    }
    setAnchorEl(null);
  };

  return (
    <>
      <Button
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
        }}
      >
        Share
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        onClick={(event) => event.stopPropagation()}
      >
        <MenuItem onClick={handleCopy}>Copy link</MenuItem>
        {canWebShare && <MenuItem onClick={handleWebShare}>Share…</MenuItem>}
      </Menu>
    </>
  );
};
