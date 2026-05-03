import { IconButton, Menu } from "@mui/material";
import type React from "react";
import { useState } from "react";

import { CreateMenuItem } from "./CreateMenuItem";
import { Plus as AddIcon, ChevronDown as ArrowDropDownIcon } from "lucide-react";

export const CreateMenu: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton
        onClick={handleOpen}
        sx={{
          borderRadius: 1,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          px: 1,
          gap: 0.5,
        }}
      >
        <AddIcon fontSize="small" />
        <ArrowDropDownIcon fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <CreateMenuItem onClose={handleClose} />
      </Menu>
    </>
  );
};
