import { Box, Button, Stack, Tab, Tabs, TextField } from "@mui/material";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import type React from "react";
import { useState } from "react";

interface Translation {
  language: string;
  title?: string;
  subtitle?: string;
  summary?: string;
  description?: string;
}

interface TranslationEditorProps {
  translations: Translation[];
  onChange: (translations: Translation[]) => void;
}

export const TranslationEditor: React.FC<TranslationEditorProps> = ({
  translations,
  onChange,
}) => {
  const [activeTab, setActiveTab] = useState(
    translations[0]?.language ?? DEFAULT_LANGUAGE,
  );

  const activeTranslation = translations.find(
    (t) => t.language === activeTab,
  ) ?? {
    language: activeTab,
  };

  const updateField = (field: keyof Translation, value: string) => {
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
    <Box>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {translations.map((t) => (
            <Tab key={t.language} label={t.language} value={t.language} />
          ))}
        </Tabs>
        <Button size="small" onClick={addLanguage}>
          + Language
        </Button>
      </Stack>
      <Stack spacing={2} mt={2}>
        <TextField
          label="Title"
          value={activeTranslation.title ?? ""}
          onChange={(e) => updateField("title", e.target.value)}
          variant="standard"
          fullWidth
        />
        <TextField
          label="Subtitle"
          value={activeTranslation.subtitle ?? ""}
          onChange={(e) => updateField("subtitle", e.target.value)}
          variant="standard"
          fullWidth
        />
        <TextField
          label="Summary"
          value={activeTranslation.summary ?? ""}
          onChange={(e) => updateField("summary", e.target.value)}
          variant="standard"
          fullWidth
          multiline
          rows={2}
        />
        <TextField
          label="Description"
          value={activeTranslation.description ?? ""}
          onChange={(e) => updateField("description", e.target.value)}
          variant="standard"
          fullWidth
          multiline
          rows={4}
        />
      </Stack>
    </Box>
  );
};
