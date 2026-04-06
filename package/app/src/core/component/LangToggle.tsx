import { ListItemText, Menu, MenuItem } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

type LangToggleProps = {
  children: (props: {
    onClick: (e: React.MouseEvent<HTMLElement>) => void;
  }) => React.ReactNode;
};

export const LangToggle: React.FC<LangToggleProps> = ({ children }) => {
  const { i18n } = useTranslation();

  const changeLang = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("lang", lang);
  };

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChangeLang = (lang: string) => {
    handleClose();
    changeLang(lang);
  };

  return (
    <>
      {children({ onClick: handleClick })}

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 180,
            },
          },
        }}
      >
        <MenuItem onClick={() => handleChangeLang("zh-SC")}>
          <ListItemText>简体中文</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleChangeLang("zh-TC")}>
          <ListItemText>繁体中文</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleChangeLang("en-US")}>
          <ListItemText>English</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleChangeLang("ja-JP")}>
          <ListItemText>日本語</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleChangeLang("de-DE")}>
          <ListItemText>Deutsch</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};
