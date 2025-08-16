import React, { ReactNode, useEffect, useState } from "react";
import { Button, Divider, useMediaQuery } from "@mui/material";
import { Sidebar } from "@component/Layout/Sidebar.tsx";
import { Header } from "@component/Layout/MainLayoutHeader.tsx";
// import { Box } from "@mui/material";
import { useLayoutStore } from "@/global/Layout/layoutStore.ts";
import { appStore } from "@/global/appStore.ts";

import { BookEditorSidebar } from "@/component/Layout/BookEditorSidebar.tsx";
import { Link, useParams, useRoute } from "wouter";
import { apiPost } from "@/api/swr.ts";
import useSWR from "swr";
interface BookReadLayout {
	children: ReactNode;
}

export const BookReadLayout: React.FC<BookReadLayout> = ({ children }) => {
	const [match, params] = useRoute("/book/:bookId/read/:chapterId");
	const locationParams = useParams();
	const isMobile = useMediaQuery("(max-width:960px)");
	const { sidebarOpen, drawerWidth, toggleSidebar, closeSidebar } =
		useLayoutStore();
	const [baseUrl, setBaseUrl] = useState("");
	const [selectedId, setSelectedId] = useState(
		match ? String(params.chapterId) : "",
	);
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

	const createBookChaptersInput = {
		operation: "chapter.list",
		parameter: {
			bookId: bookId || "1",
		},
	};
	const { data, isLoading, error } = useSWR(createBookChaptersInput, apiPost);

	const handleDrawerToggle = () => {
		toggleSidebar();
	};

	const mode = appStore((state: any) => state.theme);
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
						<Link
							to={`/book/${locationParams[0]}/`}
							className="text-blue-600 hover:underline"
						>
							<Button variant="text">查看详情</Button>
						</Link>
					</div>
					<Divider />
					<BookEditorSidebar
						chaptersData={data ?? {
							chapters: [],
							order: new Map<string, string[]>(),
						}}
						selectedId={selectedId}
						baseLink={baseUrl}
						drawerWidth={drawerWidth}
					/>
				</div>
			</Sidebar>

			<main
				className="flex-grow pt-16 transition-all duration-300"
				style={{
					width: `calc(100% - ${
						!isMobile && sidebarOpen ? drawerWidth : 0
					}px)`,
				}}
			>
				{children}
			</main>
		</div>
	);
};
