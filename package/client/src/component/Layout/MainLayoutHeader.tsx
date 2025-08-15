import React from "react";
import { User } from "./User";
import { useTheme } from "@mui/material/styles";
import { useLayoutStore } from "@/global/layoutStore";
import { AppBar, IconButton, Toolbar, Typography } from "@mui/material";
import { Brightness4, Brightness7, Menu } from "@mui/icons-material";
import { ThemeQuickToggle } from "@/component/Theme/ThemeCustomizer";
import { useTranslation } from "react-i18next";
import { LangToggle } from "./LangToggle";
// import clsx from 'clsx';

interface HeaderProps {
	handleDrawerToggle: () => void;
	mode: "light" | "dark";
	onThemeToggle: () => void;
	drawerWidth: number;
	isDragging?: boolean;
}

export const Header: React.FC<HeaderProps> = (
	{
		handleDrawerToggle,
		mode,
		onThemeToggle,
		drawerWidth,
		isDragging = false,
	},
) => {
	const { sidebarOpen } = useLayoutStore();
	const theme = useTheme();
	const { t } = useTranslation();
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
			className={isDragging ? "rounded-tl-2xl rounded-bl-2xl" : ""}
		>
			<Toolbar>
				<IconButton
					color="inherit"
					aria-label={t("accessibility.open_drawer")}
					onClick={handleDrawerToggle}
					edge="start"
					sx={{ mr: 2, display: sidebarOpen ? "none" : "flex" }}
				>
					<Menu />
				</IconButton>
				<Typography
					variant="h6"
					noWrap
					component="div"
					sx={{ flexGrow: 1 }}
				>
					REZICS
				</Typography>
				<ThemeQuickToggle />
				<LangToggle />
				<IconButton color="inherit" onClick={onThemeToggle}>
					{mode === "dark" ? <Brightness7 /> : <Brightness4 />}
				</IconButton>
				<User.Container onLogout={() => console.log("Logout")} />
			</Toolbar>
		</AppBar>
	);
};
