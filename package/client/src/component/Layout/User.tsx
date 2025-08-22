import { useUserStore } from "@/global/userStore.ts";
import {
	Logout as LogoutIcon,
	Person as PersonIcon,
	Settings as SettingsIcon,
} from "@mui/icons-material";
import {
	Avatar,
	Divider,
	IconButton,
	ListItemIcon,
	ListItemText,
	Menu,
	MenuItem,
} from "@mui/material";
import React, { useState } from "react";
import { Link } from "wouter";

export type UserShowProps = {
	anchorEl: HTMLElement | null;
	onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
	onMenuClose: () => void;
	onLogout: () => void;
	onProfile?: () => void;
	onSettings?: () => void;
};

export const UserShow: React.FC<UserShowProps> = (
	{ anchorEl, onMenuOpen, onMenuClose, onLogout, onProfile, onSettings },
) => {
	const user = useUserStore((state) => state.user);
	return (
		<>
			<IconButton
				onClick={onMenuOpen}
				size="small"
				sx={{ ml: 2 }}
				aria-controls="menu-appbar"
				aria-haspopup="true"
			>
				<Avatar sx={{ width: 32, height: 32 }}>U</Avatar>
			</IconButton>
			<Menu
				id="menu-appbar"
				anchorEl={anchorEl}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				keepMounted
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				open={Boolean(anchorEl)}
				onClose={onMenuClose}
			>
				<MenuItem
					onClick={() => {
						onMenuClose();
						onProfile?.();
					}}
				>
					<ListItemIcon>
						<PersonIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText>
						<Link to={`/user/${user?.id}`}>Profile</Link>
					</ListItemText>
				</MenuItem>
				<MenuItem
					onClick={() => {
						onMenuClose();
						onSettings?.();
					}}
				>
					<ListItemIcon>
						<SettingsIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText>Settings</ListItemText>
				</MenuItem>
				<Divider />
				<MenuItem onClick={onLogout}>
					<ListItemIcon>
						<LogoutIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText>Logout</ListItemText>
				</MenuItem>
			</Menu>
		</>
	);
};

export type UserContainerProps = {
	onLogout?: () => void;
};

export const UserContainer: React.FC<UserContainerProps> = ({ onLogout }) => {
	const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

	const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
		setAnchorEl(event.currentTarget);
	};

	const handleMenuClose = () => {
		setAnchorEl(null);
	};

	const handleLogout = () => {
		handleMenuClose();
		onLogout?.();
	};

	const handleProfile = () => {
		console.log("Profile clicked");
	};

	const handleSettings = () => {
		console.log("Settings clicked");
	};

	return (
		<UserShow
			anchorEl={anchorEl}
			onMenuOpen={handleMenuOpen}
			onMenuClose={handleMenuClose}
			onLogout={handleLogout}
			onProfile={handleProfile}
			onSettings={handleSettings}
		/>
	);
};
