import { ListItemIcon, ListItemText, MenuItem } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LangToggle } from "../LangToggle";
import { ThemeToggler } from "./ThemeToggler";
import { Languages as LanguageIcon } from "lucide-react";

export function MiscMenuItems() {
  const { t } = useTranslation();
  return (
    <>
      <LangToggle>
        {({ onClick }) => (
          <MenuItem onClick={onClick}>
            <ListItemIcon>
              <LanguageIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("layout.header.toggle_language")}</ListItemText>
          </MenuItem>
        )}
      </LangToggle>
      <ThemeToggler />
      {/* <MenuItem>
          <ThemeQuickToggle />
        </MenuItem> */}
    </>
  );
}
