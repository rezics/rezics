import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { IconButton, Menu } from "@mui/material";
import type React from "react";
import { useState } from "react";
import { MiscMenuItems } from "./MiscMenuItems";

type Props = {
  children?: React.ReactNode;
  className?: string;
};

export function MoreHorizMenu({ children, className }: Props) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        className={className}
        sx={{
          ml: 2,
          mr: 1,
        }}
      >
        <MoreHorizIcon />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <MiscMenuItems />
        {children}
      </Menu>
    </>
  );
}
