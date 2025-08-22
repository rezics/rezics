import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import LanguageIcon from "@mui/icons-material/Language";
import { IconButton, Menu, MenuItem, Tooltip } from "@mui/material";

export const LangToggle: React.FC = () => {
	const { i18n } = useTranslation();

	const changeLang = (lang: string) => {
		i18n.changeLanguage(lang);
		localStorage.setItem("lang", lang);
		console.log("set lang to ", lang);
	};

	const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
	const open = Boolean(anchorEl);
	const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		setAnchorEl(event.currentTarget);
	};
	const handleClose = () => {
		setAnchorEl(null);
	};

	return (
		<>
			<Tooltip title="主题自定义">
				<IconButton onClick={handleClick}>
					<LanguageIcon className="text-white" />
				</IconButton>
			</Tooltip>
			<Menu
				id="basic-menu"
				anchorEl={anchorEl}
				open={open}
				onClose={handleClose}
				slotProps={{
					list: {
						"aria-labelledby": "basic-button",
					},
				}}
			>
				<MenuItem onClick={() => changeLang("zh-CN")}>中文</MenuItem>
				<MenuItem onClick={() => changeLang("en-US")}>English</MenuItem>
			</Menu>
		</>
	);
};
