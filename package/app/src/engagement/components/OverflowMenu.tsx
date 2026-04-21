import {
  ChatBubbleOutline,
  IosShare,
  LibraryAdd,
  MoreHoriz,
} from "@mui/icons-material";
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
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
  reply: { label: "Reply", icon: <ChatBubbleOutline fontSize="small" /> },
  share: { label: "Share", icon: <IosShare fontSize="small" /> },
  shelf: { label: "Shelf", icon: <LibraryAdd fontSize="small" /> },
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
        <MoreHoriz sx={{ fontSize: sizeToIconFontSize(size) }} />
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
