import AddIcon from "@mui/icons-material/Add";
import { Button, Chip, Stack, Typography } from "@mui/material";
import { LANGUAGE_META } from "@rezics/contract";
import type React from "react";
import { useTranslation } from "react-i18next";

export interface TranslationLanguageBarProps {
  existingLanguages: string[];
  selectedLanguage: string;
  defaultLanguage?: string | null;
  onSelect: (language: string) => void;
  onAddClick: () => void;
  hasAvailable: boolean;
}

function languageLabel(lang: string): string {
  const meta = (LANGUAGE_META as Record<string, { nativeName?: string }>)[lang];
  return meta?.nativeName ?? lang;
}

export const TranslationLanguageBar: React.FC<TranslationLanguageBarProps> = ({
  existingLanguages,
  selectedLanguage,
  defaultLanguage,
  onSelect,
  onAddClick,
  hasAvailable,
}) => {
  const { t } = useTranslation();
  const visible = existingLanguages.length
    ? existingLanguages
    : selectedLanguage
      ? [selectedLanguage]
      : [];

  return (
    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
      <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
        {t("page.book_edit.info.translation.language_label")}
      </Typography>
      {visible.map((lang) => {
        const isActive = lang === selectedLanguage;
        const isDefault = defaultLanguage === lang;
        return (
          <Chip
            key={lang}
            size="small"
            label={
              <Stack direction="row" alignItems="center" gap={0.75}>
                <span>{languageLabel(lang)}</span>
                {isDefault && (
                  <Typography
                    component="span"
                    variant="caption"
                    color={isActive ? "inherit" : "text.secondary"}
                  >
                    · {t("page.book_edit.info.translation.default_badge")}
                  </Typography>
                )}
              </Stack>
            }
            color={isActive ? "primary" : "default"}
            variant={isActive ? "filled" : "outlined"}
            onClick={() => onSelect(lang)}
            sx={{ cursor: "pointer" }}
          />
        );
      })}
      <Button
        size="small"
        variant="text"
        startIcon={<AddIcon fontSize="small" />}
        onClick={onAddClick}
        disabled={!hasAvailable}
      >
        {t("page.book_edit.info.translation.add_button")}
      </Button>
    </Stack>
  );
};
