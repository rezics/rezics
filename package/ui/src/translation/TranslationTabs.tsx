import type React from "react";
import { Tabs, TabsList, TabsTrigger } from "#/shadcn/tabs";

interface TranslationTabsProps {
  languages: string[];
  selected: string;
  onChange: (lang: string) => void;
}

export const TranslationTabs: React.FC<TranslationTabsProps> = ({
  languages,
  selected,
  onChange,
}) => {
  if (languages.length <= 1) return null;

  return (
    <Tabs value={selected} onValueChange={onChange}>
      <TabsList className="overflow-x-auto">
        {languages.map((lang) => (
          <TabsTrigger key={lang} value={lang}>
            {lang}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};
