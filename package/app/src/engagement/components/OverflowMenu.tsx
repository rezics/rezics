import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import {
  BookmarkPlus,
  MessageSquare,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { Action, EngagementSize } from "../types";

export type OverflowMenuProps = {
  items: Action[];
  size?: EngagementSize;
  onInvoke: (action: Action) => void;
};

type MenuDescriptor = { label: string; icon: React.ReactNode };

const DESCRIPTORS: Partial<Record<Action, MenuDescriptor>> = {
  reply: { label: "Reply", icon: <MessageSquare size={18} strokeWidth={2} /> },
  share: { label: "Share", icon: <Share2 size={18} strokeWidth={2} /> },
  shelf: { label: "Shelf", icon: <BookmarkPlus size={18} strokeWidth={2} /> },
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

export const OverflowMenu: React.FC<OverflowMenuProps> = ({
  items,
  size = "md",
  onInvoke,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const visible = items.filter(
    (token) => DESCRIPTORS[token] !== undefined,
  ) as Action[];

  if (visible.length === 0) return null;

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

  const handleSelect = (event: React.MouseEvent, action: Action) => {
    event.stopPropagation();
    setAnchorEl(null);
    onInvoke(action);
  };

  return (
    <>
      <IconButton
        size={size === "lg" ? "medium" : "small"}
        onClick={handleOpen}
        aria-label="More actions"
        sx={{ color: "text.secondary" }}
      >
        <MoreHorizontal size={sizeToIconPx(size)} strokeWidth={2} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        onClick={(event) => event.stopPropagation()}
      >
        {visible.map((token) => {
          const descriptor = DESCRIPTORS[token];
          if (!descriptor) return null;
          return (
            <MenuItem
              key={token}
              onClick={(event) => handleSelect(event, token)}
            >
              <ListItemIcon>{descriptor.icon}</ListItemIcon>
              <ListItemText primary={descriptor.label} />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};
