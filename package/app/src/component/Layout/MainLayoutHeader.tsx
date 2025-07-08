import React from "react";
import { User } from "./User";
import { useTheme } from "@mui/material/styles";
import { useLayoutStore } from "@/global/layoutStore";
import { AppBar, IconButton, Toolbar, Typography } from "@mui/material";
import { Menu, Brightness7, Brightness4 } from "@mui/icons-material";
import { t } from "@component/Text";

interface HeaderProps {
    handleDrawerToggle: () => void;
    mode: "light" | "dark";
    onThemeToggle: () => void;
    drawerWidth: number;
}

export const Header: React.FC<HeaderProps> = ({ handleDrawerToggle, mode, onThemeToggle, drawerWidth }) => {
    const { sidebarOpen } = useLayoutStore();
    const theme = useTheme();
    return (
        <AppBar
            position="fixed"
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                ml: sidebarOpen ? drawerWidth : 0,
                width: sidebarOpen ? `calc(100% - ${drawerWidth}px)` : "100%",
                transition: theme.transitions.create(["margin", "width"], {
                    easing: theme.transitions.easing.easeOut,
                    duration: theme.transitions.duration.enteringScreen,
                }),
            }}
        >
            <Toolbar>
                <IconButton
                    color="inherit"
                    aria-label={t("accessibility->open_drawer")}
                    onClick={handleDrawerToggle}
                    edge="start"
                    sx={{ mr: 2, display: sidebarOpen ? "none" : "flex" }}
                >
                    <Menu />
                </IconButton>
                <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                    REZICS
                </Typography>
                <IconButton color="inherit" onClick={onThemeToggle}>
                    {mode === "dark" ? <Brightness7 /> : <Brightness4 />}
                </IconButton>
                <User.Container onLogout={() => console.log("Logout")} />
            </Toolbar>
        </AppBar>
    );
};
