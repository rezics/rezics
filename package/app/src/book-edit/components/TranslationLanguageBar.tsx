import type React from "react";
import { UnitTranslationLanguageBar } from "@/unit";
import { useMessage } from "@rezics/i18n/react";
import {
  page_book_edit_info_translation_add_button,
  page_book_edit_info_translation_default_badge,
  page_book_edit_info_translation_language_label,
} from "@rezics/i18n/messages";
const m = {
  page_book_edit_info_translation_add_button,
  page_book_edit_info_translation_default_badge,
  page_book_edit_info_translation_language_label,
};

const i18nMessages = {
  page_book_edit_info_translation_add_button,
  page_book_edit_info_translation_default_badge,
  page_book_edit_info_translation_language_label,
};

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
  const m = useMessage(i18nMessages);
  return (
    <UnitTranslationLanguageBar
      existingLanguages={existingLanguages}
      selectedLanguage={selectedLanguage}
      defaultLanguage={defaultLanguage}
      onSelect={onSelect}
      onAddClick={onAddClick}
      hasAvailable={hasAvailable}
      label={m.page_book_edit_info_translation_language_label()}
      addLabel={m.page_book_edit_info_translation_add_button()}
      defaultLabel={m.page_book_edit_info_translation_default_badge()}
    />
  );
};
