import { LANGUAGE_META } from "@rezics/contract";
import { Badge, Button } from "@rezics/ui/shadcn";
import { Plus as AddIcon } from "lucide-react";
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
    <div className="flex flex-row items-center gap-2 flex-wrap">
      <span className="text-sm text-text-secondary mr-2">
        {t("page.book_edit.info.translation.language_label")}
      </span>
      {visible.map((lang) => {
        const isActive = lang === selectedLanguage;
        const isDefault = defaultLanguage === lang;
        return (
          <Badge
            key={lang}
            variant={isActive ? "default" : "outline"}
            onClick={() => onSelect(lang)}
            className="cursor-pointer"
          >
            <span className="flex flex-row items-center gap-1">
              <span>{languageLabel(lang)}</span>
              {isDefault && (
                <span
                  className={`text-xs ${isActive ? "" : "text-text-secondary"}`}
                >
                  · {t("page.book_edit.info.translation.default_badge")}
                </span>
              )}
            </span>
          </Badge>
        );
      })}
      <Button
        size="sm"
        variant="ghost"
        onClick={onAddClick}
        disabled={!hasAvailable}
      >
        <AddIcon className="w-4 h-4 mr-2" />
        {t("page.book_edit.info.translation.add_button")}
      </Button>
    </div>
  );
};
