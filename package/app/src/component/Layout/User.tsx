import React, { useState } from "react";
import { IconButton, Avatar, Menu, MenuItem, Divider, ListItemIcon, ListItemText } from "@mui/material";
import { Person as PersonIcon, Settings as SettingsIcon, Logout as LogoutIcon } from "@mui/icons-material";
//  ;

export namespace User {
    export type Show = {
        anchorEl: HTMLElement | null;
        onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
        onMenuClose: () => void;
        onLogout: () => void;
        onProfile?: () => void;
        onSettings?: () => void;
    };

    export const Show: React.FC<Show> = ({ anchorEl, onMenuOpen, onMenuClose, onLogout, onProfile, onSettings }) => {
        return (
            <>
                <IconButton
                    onClick={onMenuOpen}
                    size="small"
                    sx={{ ml: 2 }}
                    aria-controls="menu-appbar"
                    aria-haspopup="true"
                >
                    <Avatar sx={{ width: 32, height: 32 }}>U</Avatar>
                </IconButton>
                <Menu
                    id="menu-appbar"
                    anchorEl={anchorEl}
                    anchorOrigin={{
                        vertical: "bottom",
                        horizontal: "right",
                    }}
                    keepMounted
                    transformOrigin={{
                        vertical: "top",
                        horizontal: "right",
                    }}
                    open={Boolean(anchorEl)}
                    onClose={onMenuClose}
                >
                    <MenuItem
                        onClick={() => {
                            onMenuClose();
                            onProfile?.();
                        }}
                    >
                        <ListItemIcon>
                            <PersonIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Profile</ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            onMenuClose();
                            onSettings?.();
                        }}
                    >
                        <ListItemIcon>
                            <SettingsIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Settings</ListItemText>
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={onLogout}>
                        <ListItemIcon>
                            <LogoutIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Logout</ListItemText>
                    </MenuItem>
                </Menu>
            </>
        );
    };

    export type Container = {
        onLogout?: () => void;
    };

    export const Container: React.FC<Container> = ({ onLogout }) => {
        const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

        const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
            setAnchorEl(event.currentTarget);
        };

        const handleMenuClose = () => {
            setAnchorEl(null);
        };

        const handleLogout = () => {
            handleMenuClose();
            onLogout?.();
        };

        const handleProfile = () => {
            console.log("Profile clicked");
        };

        const handleSettings = () => {
            console.log("Settings clicked");
        };

        return (
            <Show
                anchorEl={anchorEl}
                onMenuOpen={handleMenuOpen}
                onMenuClose={handleMenuClose}
                onLogout={handleLogout}
                onProfile={handleProfile}
                onSettings={handleSettings}
            />
        );
    };
}
