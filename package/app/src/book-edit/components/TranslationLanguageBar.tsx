import type React from "react";
import { useTranslation } from "react-i18next";
import { UnitTranslationLanguageBar } from "@/unit";

export interface TranslationLanguageBarProps {
  existingLanguages: string[];
  selectedLanguage: string;
  defaultLanguage?: string | null;
  onSelect: (language: string) => void;
  onAddClick: () => void;
  hasAvailable: boolean;
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

  return (
    <UnitTranslationLanguageBar
      existingLanguages={existingLanguages}
      selectedLanguage={selectedLanguage}
      defaultLanguage={defaultLanguage}
      onSelect={onSelect}
      onAddClick={onAddClick}
      hasAvailable={hasAvailable}
      label={t("page.book_edit.info.translation.language_label")}
      addLabel={t("page.book_edit.info.translation.add_button")}
      defaultLabel={t("page.book_edit.info.translation.default_badge")}
    />
  );
};
