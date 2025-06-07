import React from "react";
import { User } from "./User";
import { useSnapshot } from "valtio";
import { useTheme } from "@mui/material/styles";
interface HeaderProps {
    handleDrawerToggle: () => void;
    mode: "light" | "dark";
    onThemeToggle: () => void;
    drawerWidth: any;
}

export const Header: React.FC<HeaderProps> = ({ handleDrawerToggle, mode, onThemeToggle, drawerWidth }) => {
    const snap = useSnapshot(layoutState);
    const drawerWidthsnap = useSnapshot(drawerWidth);
    const theme = useTheme();
    return (
        <AppBar
            position="fixed"
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                ml: snap.sidebarOpen ? drawerWidthsnap.data : 0,
                width: snap.sidebarOpen ? `calc(100% - ${drawerWidthsnap.data}px)` : "100%",
                transition: theme.transitions.create(["margin", "width"], {
                    easing: theme.transitions.easing.easeOut,
                    duration: theme.transitions.duration.enteringScreen,
                }),
            }}
        >
            <Toolbar>
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    onClick={handleDrawerToggle}
                    edge="start"
                    sx={{ mr: 2, display: snap.sidebarOpen ? "none" : "flex" }}
                >
                    <Menu />
                </IconButton>
                <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                    REZICS
                </Typography>
                <IconButton color="inherit" onClick={onThemeToggle}>
                    {mode === "dark" ? <Brightness7 /> : <Brightness4 />}
                </IconButton>
                <User onLogout={() => console.log("Logout")} />
            </Toolbar>
        </AppBar>
    );
};
