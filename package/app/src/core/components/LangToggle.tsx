import { ListItemText, Menu, MenuItem } from "@mui/material";
import { LANGUAGE_META, LANGUAGES } from "@rezics/contract";
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
        <MenuItem onClick={() => handleChangeLang(LANGUAGES.ZH_HANT)}>
          <ListItemText>{LANGUAGE_META["zh-hant"].nativeName}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleChangeLang(LANGUAGES.EN)}>
          <ListItemText>{LANGUAGE_META.en.nativeName}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleChangeLang(LANGUAGES.JA)}>
          <ListItemText>{LANGUAGE_META.ja.nativeName}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleChangeLang(LANGUAGES.DE)}>
          <ListItemText>{LANGUAGE_META.de.nativeName}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleChangeLang(LANGUAGES.ZH_HANS)}>
          <ListItemText>{LANGUAGE_META["zh-hans"].nativeName}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};
