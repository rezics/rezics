import type React from "react";
import { useState } from "react";

export type UseShareMenuArgs = {
  href: string;
  title?: string;
};

export type UseShareMenuReturn = {
  anchorEl: HTMLElement | null;
  open: boolean;
  canWebShare: boolean;
  handleOpen: (event: React.MouseEvent<HTMLElement>) => void;
  handleClose: (event?: React.MouseEvent | {}) => void;
  handleCopy: (event: React.MouseEvent) => Promise<void>;
  handleWebShare: (event: React.MouseEvent) => Promise<void>;
};

function absolute(href: string): string {
  if (/^https?:\/\//.test(href)) return href;
  if (typeof window === "undefined") return href;
  return window.location.origin + href;
}

export function useShareMenu({
  href,
  title,
}: UseShareMenuArgs): UseShareMenuReturn {
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

  return {
    anchorEl,
    open: Boolean(anchorEl),
    canWebShare,
    handleOpen,
    handleClose,
    handleCopy,
    handleWebShare,
  };
}
