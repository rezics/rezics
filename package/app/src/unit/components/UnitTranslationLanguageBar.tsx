import { CONTENT_LANGUAGE_SLUGS, languageLabel } from "@rezics/contract";
import {
  Button,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { Plus as AddIcon } from "lucide-react";
import type React from "react";

export interface UnitTranslationLanguageBarProps {
  existingLanguages: string[];
  selectedLanguage: string;
  defaultLanguage?: string | null;
  onSelect: (language: string) => void;
  onAddClick: () => void;
  hasAvailable?: boolean;
  label: React.ReactNode;
  addLabel: React.ReactNode;
  defaultLabel?: React.ReactNode;
  className?: string;
  selectClassName?: string;
}

const ALL_LANGUAGES = CONTENT_LANGUAGE_SLUGS;

export const UnitTranslationLanguageBar: React.FC<
  UnitTranslationLanguageBarProps
> = ({
  existingLanguages,
  selectedLanguage,
  defaultLanguage,
  onSelect,
  onAddClick,
  hasAvailable,
  label,
  addLabel,
  defaultLabel,
  className,
  selectClassName,
}) => {
  const visible = existingLanguages;
  const canAdd =
    hasAvailable ?? ALL_LANGUAGES.some((lang) => !visible.includes(lang));

  return (
    <div className={className ?? "flex flex-row flex-wrap items-center gap-2"}>
      <span className="text-sm text-text-secondary">{label}</span>
      <Select
        value={selectedLanguage}
        onValueChange={(value) => onSelect(value)}
      >
        <SelectTrigger className={selectClassName ?? "min-w-[180px]"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {visible.map((lang) => {
              const isDefault = defaultLanguage === lang;
              return (
                <SelectItem key={lang} value={lang}>
                  <span className="flex flex-row items-center gap-1">
                    <span>{languageLabel(lang)}</span>
                    {isDefault && defaultLabel ? (
                      <span className="text-text-secondary">
                        · {defaultLabel}
                      </span>
                    ) : null}
                  </span>
                </SelectItem>
              );
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button size="sm" variant="ghost" onClick={onAddClick} disabled={!canAdd}>
        <AddIcon data-icon="inline-start" />
        {addLabel}
      </Button>
    </div>
  );
};

