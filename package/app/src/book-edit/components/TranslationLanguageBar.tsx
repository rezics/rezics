import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
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
  const { t } = useTranslation(["page"]);
  return (
    <UnitTranslationLanguageBar
      existingLanguages={existingLanguages}
      selectedLanguage={selectedLanguage}
      defaultLanguage={defaultLanguage}
      onSelect={onSelect}
      onAddClick={onAddClick}
      hasAvailable={hasAvailable}
      label={t("page:book_edit_info_translation_language_label")}
      addLabel={t("page:book_edit_info_translation_add_button")}
      defaultLabel={t("page:book_edit_info_translation_default_badge")}
    />
  );
};
