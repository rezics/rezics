import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import {
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Tooltip,
} from "@mui/material";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface LanguageTabsProps {
  languages: string[];
  defaultLanguage: string;
  active: string;
  onChange: (language: string) => void;
  availableToAdd?: string[];
  onAdd?: (language: string) => void;
  onRemove?: (language: string) => void;
}

/**
 * Per-language tabs for the editor dialog. The default-language tab is
 * non-removable and badged with a star. Additional languages surface a
 * "×" affordance; `availableToAdd` fills the "+ Add" dropdown.
 */
export const LanguageTabs: React.FC<LanguageTabsProps> = ({
  languages,
  defaultLanguage,
  active,
  onChange,
  availableToAdd,
  onAdd,
  onRemove,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const canAdd = Boolean(onAdd && availableToAdd && availableToAdd.length > 0);

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Tabs
        value={active}
        onChange={(_, value) => onChange(value as string)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ flex: 1, minHeight: 40 }}
        aria-label={t("pinboard.editor.language_tabs_aria")}
      >
        {languages.map((lang) => {
          const isDefault = lang === defaultLanguage;
          return (
            <Tab
              key={lang}
              value={lang}
              sx={{ minHeight: 40, textTransform: "none" }}
              label={
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  component="span"
                >
                  {isDefault ? (
                    <Tooltip title={t("pinboard.editor.default_language")}>
                      <StarRoundedIcon
                        fontSize="inherit"
                        sx={{ color: "warning.main" }}
                        aria-hidden="true"
                      />
                    </Tooltip>
                  ) : null}
                  <span>{lang}</span>
                  {!isDefault && onRemove ? (
                    <IconButton
                      component="span"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(lang);
                      }}
                      aria-label={t("pinboard.editor.remove_language", {
                        lang,
                      })}
                      sx={{ ml: 0.25, p: 0.25 }}
                    >
                      <CloseRoundedIcon fontSize="inherit" />
                    </IconButton>
                  ) : null}
                </Stack>
              }
            />
          );
        })}
      </Tabs>

      {canAdd ? (
        <>
          <Tooltip title={t("pinboard.editor.add_language")}>
            <IconButton
              size="small"
              onClick={(e) => setAnchorEl(e.currentTarget)}
              aria-label={t("pinboard.editor.add_language")}
            >
              <AddRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
          >
            {availableToAdd?.map((lang) => (
              <MenuItem
                key={lang}
                onClick={() => {
                  onAdd?.(lang);
                  setAnchorEl(null);
                }}
              >
                {lang}
              </MenuItem>
            ))}
          </Menu>
        </>
      ) : null}
    </Stack>
  );
};
