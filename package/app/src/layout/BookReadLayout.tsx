import React, { ReactNode, useEffect, useState } from "react";
import { Button, Divider, useMediaQuery } from "@mui/material";
import { Sidebar } from "@component/Layout/Sidebar";
import { Header } from "@component/Layout/MainLayoutHeader";
import { proxy, useSnapshot } from "valtio";
// import { Box } from "@mui/material";
import { useLayoutStore } from "@/global/layoutStore";
import { appStore } from "@/global/appStore";

import { BookEditorSidebar } from "@/component/Layout/BookEditorSidebar";
import { Link, useParams, useRoute } from "wouter";

import { useQuery } from "urql";
import { ChapterListQuery } from "@/graphql/bookInfo";

interface BookReadLayout {
    children: ReactNode;
}

const drawerWidth = proxy({
    data: 240,
});

export const BookReadLayout: React.FC<BookReadLayout> = ({ children }) => {
    const [match, params] = useRoute("/book/:bookId/read/:chapterId");
    const locationParams = useParams();
    const isMobile = useMediaQuery("(max-width:960px)");
    const { sidebarOpen, drawerWidth, toggleSidebar, closeSidebar } = useLayoutStore();
    const [baseUrl, setBaseUrl] = useState("");
    const [selectedId, setSelectedId] = useState(match ? String(params.chapterId) : "");
    let bookId = "";

    useEffect(() => {
        console.log("locationParams", locationParams);
        bookId = locationParams[0] || "";
        setBaseUrl(`/book/${bookId}/read`);
        console.log("bookId", bookId);
        console.log("baseUrl", baseUrl);
    }, [locationParams]);

    useEffect(() => {
        console.log("match, params", match, params);
        setSelectedId(match ? String(params.chapterId) : "");
    }, [match, params]);

    const [{ data, fetching, error }] = useQuery({
        query: ChapterListQuery,
        variables: { id: bookId },
    });

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
                NAVIGATION={[]}
                noScrollBar={false}
                onOverflowx={true}
                onOverflowy={true}
            >
                <div>
                    <div className="flex items-center justify-between mb-2 bg-gray-50 text-sm text-gray-800">
                        <div className="font-medium">目录</div>
                        <Link to={`/book/${locationParams[0]}/`} className="text-blue-600 hover:underline">
                            <Button variant="text">查看详情</Button>
                        </Link>
                    </div>
                    <Divider/>
                    <BookEditorSidebar chaptersData={data} selectedId={selectedId} baseLink={baseUrl} />
                </div>
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
