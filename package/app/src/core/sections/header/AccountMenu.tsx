import {
  Logout as LogoutIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import {
  Avatar,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { logout } from "@/user/models/handler";
import { useUserProfileStore } from "@/user/states";
import { MiscMenuItems } from "../../components/header/MiscMenuItems";
export type AccountMenuProps = {
  onLogout?: () => void;
};

export const AccountMenu: React.FC<AccountMenuProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const clearProfile = useUserProfileStore((state) => state.clearProfile);
  const user = useUserProfileStore((state) => state.user);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { t } = useTranslation();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    onLogout?.();
    clearProfile();
    navigate({ to: "/login" });
    void logout();
  };

  return (
    <>
      <IconButton
        onClick={handleMenuOpen}
        size="small"
        aria-controls="menu-appbar"
        aria-haspopup="true"
      >
        <Avatar
          sx={{ width: 36, height: 36 }}
          variant="rounded"
          src={user?.avatar}
        >
          {user?.name?.charAt(0).toUpperCase()}
        </Avatar>
      </IconButton>
      <Menu
        id="menu-appbar"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem component={Link} to={`/user/me`} onClick={handleMenuClose}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("navigation.profile")}</ListItemText>
        </MenuItem>
        <MenuItem
          component={Link}
          to={`/user/me/setting/profile`}
          onClick={handleMenuClose}
        >
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("navigation.settings")}</ListItemText>
        </MenuItem>
        <MiscMenuItems />
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("auth.logout")}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};
