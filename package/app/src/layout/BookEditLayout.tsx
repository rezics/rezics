import React, { ReactNode, useEffect, useState } from "react";
import { useMediaQuery } from "@mui/material";
import { Sidebar } from "@component/Layout/Sidebar";
import { Header } from "@component/Layout/MainLayoutHeader";

import { useLayoutStore } from "@/global/layoutStore";
import { appStore } from "@/global/appStore";
import { NAVIGATION } from "@/component/Layout/BookEditorNavigation";

import { useQuery } from "urql";
import { ChapterListQuery } from "@/graphql/bookinfo";
import { useParams, useRoute } from "wouter";

import { BookEditorSidebar } from "@/component/Layout/BookEditorSidebar";

interface BookEditLayoutProps {
    children: ReactNode;
}

export const BookEditLayout: React.FC<BookEditLayoutProps> = ({ children }) => {
    // const [match, params] = useRoute("/:chapterId");
    const [match, params] = useRoute("/book/:id/edit/:chapterId");
    const { id } = useParams();

    const [selectedId, setSelectedId] = useState(match ? String(params.chapterId) : "");

    useEffect(() => {
        console.log("match, params", match, params);
        setSelectedId(match ? String(params.chapterId) : "");
    }, [match, params]);

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
                noScrollBar={true}
            >
                <BookEditorSidebar chaptersData={data} selectedId={selectedId} />
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
