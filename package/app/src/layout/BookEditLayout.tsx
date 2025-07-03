import React, { ReactNode } from "react";
import { useMediaQuery } from "@mui/material";
import { Sidebar } from "@component/Layout/Sidebar";
import { Header } from "@component/Layout/MainLayoutHeader";
import { proxy, useSnapshot } from "valtio";
// import { Box } from "@mui/material";
import { useLayoutStore } from "@/global/layoutStore";
import { appStore } from "@/global/appStore";
import { NAVIGATION } from "@/component/Layout/BookEditorNavigation";

import { Tree } from 'react-arborist';
import { useQuery } from "urql";
import { ChapterListQuery } from "@/graphql/bookinfo";
import { useParams } from "wouter";

import { BookEditorSidebar } from "@/component/Layout/BookEditorSidebar";

interface BookEditLayoutProps {
    children: ReactNode;
}

export const BookEditLayout: React.FC<BookEditLayoutProps> = ({ children }) => {
    const { id } = useParams();

    const [{ data, fetching, error }] = useQuery({
        query: ChapterListQuery,
        variables: { id },
    });

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
            >
                <BookEditorSidebar chaptersData={data} />
            </Sidebar>

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
