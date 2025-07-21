import React, { ReactNode, useEffect, useState } from "react";
import { useMediaQuery } from "@mui/material";
import { Sidebar } from "@component/Layout/Sidebar";
import { Header } from "@component/Layout/MainLayoutHeader";

import { useLayoutStore } from "@/global/layoutStore";
import { appStore } from "@/global/appStore";
import { NAVIGATION } from "@/component/Layout/BookEditorNavigation";

import { useParams, useRoute } from "wouter";

import { BookEditorSidebar } from "@/component/Layout/BookEditorSidebar";
import tsr from "@/api/tsr";

import { DraggableResizer } from "@/component/Layout/DraggableResizer";

interface BookEditLayoutProps {
    children: ReactNode;
}

export const BookEditLayout: React.FC<BookEditLayoutProps> = ({ children }) => {
    // const [match, params] = useRoute("/:chapterId");
    const [match, params] = useRoute("/book/:bookId/edit/:chapterId");
    const locationParams = useParams();
    const [selectedId, setSelectedId] = useState(match ? String(params.chapterId) : "");
    const [baseUrl, setBaseUrl] = useState("");
    let bookId = "";

    useEffect(() => {
        console.log("locationParams", locationParams);
        bookId = locationParams[0] || "";
        setBaseUrl(`/book/${bookId}/edit`);
        console.log("bookId", bookId);
        console.log("baseUrl", baseUrl);
    }, [locationParams]);

    useEffect(() => {
        console.log("match, params", match, params);
        setSelectedId(match ? String(params.chapterId) : "");
    }, [match, params]);
    const { data, isLoading, error } = tsr.book.chapter.list.useQuery({
        queryKey: ["bookChapters", bookId],
        queryData: {
            params: {
                bookId: bookId || "1",
            },
        },
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

    function setDrawerWidth(width: number) {
        useLayoutStore.setState({ drawerWidth: width });
    }

    const [isDragging, setIsDragging] = useState(false);

    return (
        <div className="flex min-h-screen">
            <Header
                handleDrawerToggle={handleDrawerToggle}
                mode={mode}
                onThemeToggle={toggleTheme}
                drawerWidth={drawerWidth}
                isDragging={isDragging}
            />
            <div id="book-edit-sidebar">
                <Sidebar
                    onClose={() => isMobile && closeSidebar()}
                    handleDrawerToggle={handleDrawerToggle}
                    NAVIGATION={NAVIGATION()}
                    noScrollBar={true}
                    isDragging={isDragging}
                >
                    <BookEditorSidebar
                        chaptersData={
                            data?.body ?? {
                                chapters: [],
                                order: new Map<string, string[]>(),
                            }
                        }
                        selectedId={selectedId}
                        baseLink={baseUrl}
                        drawerWidth={drawerWidth}
                        isDraggable={true}
                        enableDoubleClickRename={true}
                    />
                </Sidebar>
                <DraggableResizer
                    targetId="book-edit-sidebar"
                    setSidebarWidth={setDrawerWidth}
                    onDragging={setIsDragging}
                />
            </div>

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
