import { Tab, Tabs } from "@mui/material";
import type React from "react";

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
    <Tabs
      value={selected}
      onChange={(_, v) => onChange(v)}
      variant="scrollable"
      scrollButtons="auto"
      sx={{ minHeight: 32 }}
    >
      {languages.map((lang) => (
        <Tab
          key={lang}
          label={lang}
          value={lang}
          sx={{ minHeight: 32, py: 0.5 }}
        />
      ))}
    </Tabs>
  );
};
