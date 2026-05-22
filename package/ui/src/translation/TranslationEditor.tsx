import type React from "react";
import { useId, useState } from "react";
import { Button } from "@/shadcn/button";
import { Input } from "@/shadcn/input";
import { Label } from "@/shadcn/label";
import { Tabs, TabsList, TabsTrigger } from "@/shadcn/tabs";

const DEFAULT_TRANSLATION_LANGUAGE = "zh-TW";

export interface TranslationEditorEntry {
  language: string;
  title?: string;
  subtitle?: string;
  summary?: string;
  description?: string;
}

interface TranslationEditorProps {
  translations: TranslationEditorEntry[];
  onChange: (translations: TranslationEditorEntry[]) => void;
}

interface FieldRowProps {
  label: string;
  children: React.ReactNode;
  htmlFor: string;
}

function FieldRow({ label, children, htmlFor }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor} className="text-xs text-rezics-fg-muted">
        {label}
      </Label>
      {children}
    </div>
  );
}

export const TranslationEditor: React.FC<TranslationEditorProps> = ({
  translations,
  onChange,
}) => {
  const [activeTab, setActiveTab] = useState(
    translations[0]?.language ?? DEFAULT_TRANSLATION_LANGUAGE,
  );
  const idPrefix = useId();

  const activeTranslation = translations.find(
    (t) => t.language === activeTab,
  ) ?? {
    language: activeTab,
  };

  const updateField = (field: keyof TranslationEditorEntry, value: string) => {
    const updated = translations.map((t) =>
      t.language === activeTab ? { ...t, [field]: value } : t,
    );
    if (!translations.find((t) => t.language === activeTab)) {
      updated.push({ language: activeTab, [field]: value });
    }
    onChange(updated);
  };

  const addLanguage = () => {
    const newLang = prompt("Enter language code (e.g., en, ja):");
    if (newLang && !translations.find((t) => t.language === newLang)) {
      onChange([...translations, { language: newLang }]);
      setActiveTab(newLang);
    }
  };

  return (
    <div>
      <div className="flex flex-row items-center gap-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="overflow-x-auto">
            {translations.map((t) => (
              <TabsTrigger key={t.language} value={t.language}>
                {t.language}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button type="button" size="sm" variant="ghost" onClick={addLanguage}>
          + Language
        </Button>
      </div>
      <div className="flex flex-col gap-4 mt-4">
        <FieldRow htmlFor={`${idPrefix}-title`} label="Title">
          <Input
            id={`${idPrefix}-title`}
            value={activeTranslation.title ?? ""}
            onChange={(e) => updateField("title", e.target.value)}
          />
        </FieldRow>
        <FieldRow htmlFor={`${idPrefix}-subtitle`} label="Subtitle">
          <Input
            id={`${idPrefix}-subtitle`}
            value={activeTranslation.subtitle ?? ""}
            onChange={(e) => updateField("subtitle", e.target.value)}
          />
        </FieldRow>
        <FieldRow htmlFor={`${idPrefix}-summary`} label="Summary">
          <textarea
            id={`${idPrefix}-summary`}
            rows={2}
            value={activeTranslation.summary ?? ""}
            onChange={(e) => updateField("summary", e.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
        </FieldRow>
        <FieldRow htmlFor={`${idPrefix}-description`} label="Description">
          <textarea
            id={`${idPrefix}-description`}
            rows={4}
            value={activeTranslation.description ?? ""}
            onChange={(e) => updateField("description", e.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
        </FieldRow>
      </div>
    </div>
  );
};
