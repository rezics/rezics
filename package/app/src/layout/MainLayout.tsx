import React, { ReactNode } from "react";
import { useMediaQuery } from "@mui/material";
import { Sidebar } from "@/components/Layout/Sidebar";
import { Header } from "@/components/Layout/Header";
import { layoutState, layoutActions } from "@/stores/layout";
import { proxy, useSnapshot } from "valtio";
import { Box } from "@mui/material";
interface MainLayoutProps {
    children: ReactNode;
    mode: "light" | "dark";
    toggleTheme: () => void;
}

const drawerWidth = proxy({
    data: 240,
});


export const MainLayout: React.FC<MainLayoutProps> = ({ children, mode, toggleTheme }) => {
    const layoutStatesnap = useSnapshot(layoutState);
    const isMobile = useMediaQuery((theme: any) => theme.breakpoints.down("md"));

    const handleDrawerToggle = () => {
        layoutActions.toggleSidebar();
    };

    return (
        <Box sx={{ display: "flex", minHeight: "100vh" }}>
            <Header
                handleDrawerToggle={handleDrawerToggle}
                mode={mode}
                onThemeToggle={toggleTheme}
                drawerWidth={drawerWidth}
            />

            <Sidebar
                onClose={() => isMobile && layoutActions.closeSidebar()}
                handleDrawerToggle={handleDrawerToggle}
                drawerWidth={drawerWidth}
            />

            <Box
                component="main"
                style={{
                    width: `calc(100% - ${drawerWidth.data}px)`,
                }}
                className="pt-16"
            >
                {children}
            </Box>
        </Box>
    );
};
