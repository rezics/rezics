import React, { ReactNode } from "react";
import { useMediaQuery } from "@mui/material";
import { Sidebar } from "@component/Layout/Sidebar";
import { Header } from "@component/Layout/MainLayoutHeader";
import { proxy, useSnapshot } from "valtio";
// import { Box } from "@mui/material";
import { useLayoutStore } from "@/global/layoutStore";
import { appStore } from "@/global/appStore";
import { NAVIGATION } from "@/component/Layout/BookEditorNavigation";

interface BookReadLayout {
    children: ReactNode;
}

const drawerWidth = proxy({
    data: 240,
});

export const BookReadLayout: React.FC<BookReadLayout> = ({ children }) => {
    const isMobile = useMediaQuery("(max-width:960px)");
    const { sidebarOpen, drawerWidth, toggleSidebar, closeSidebar } = useLayoutStore();

    const handleDrawerToggle = () => {
        toggleSidebar();
    };

    const mode = appStore((state) => state.theme);
    function toggleTheme() {
        appStore.setState({ theme: mode === "light" ? "dark" : "light" });
    }

    return (
        <div className="flex min-h-screen">
            <Header
                handleDrawerToggle={handleDrawerToggle}
                mode={mode}
                onThemeToggle={toggleTheme}
                drawerWidth={drawerWidth}
            />

            <Sidebar
                onClose={() => isMobile && closeSidebar()}
                handleDrawerToggle={handleDrawerToggle}
                NAVIGATION={NAVIGATION}
            />

            <main
                className="flex-grow pt-16 transition-all duration-300"
                style={{
                    width: `calc(100% - ${!isMobile && sidebarOpen ? drawerWidth : 0}px)`,
                }}
            >
                {children}
            </main>
        </div>
    );
};
