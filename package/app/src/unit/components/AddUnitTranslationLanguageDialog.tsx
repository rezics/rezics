import { CONTENT_LANGUAGE_SLUGS, languageLabel } from "@rezics/contract";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

export interface AddUnitTranslationLanguageDialogProps {
  open: boolean;
  existingLanguages: string[];
  onClose: () => void;
  onSubmit: (language: string) => void;
  title: React.ReactNode;
  languageLabel: React.ReactNode;
  cancelLabel: React.ReactNode;
  submitLabel: React.ReactNode;
}

const ALL_LANGUAGES = CONTENT_LANGUAGE_SLUGS;

export const AddUnitTranslationLanguageDialog: React.FC<
  AddUnitTranslationLanguageDialogProps
> = ({
  open,
  existingLanguages,
  onClose,
  onSubmit,
  title,
  languageLabel: languageFieldLabel,
  cancelLabel,
  submitLabel,
}) => {
  const available = useMemo(
    () => ALL_LANGUAGES.filter((lang) => !existingLanguages.includes(lang)),
    [existingLanguages],
  );
  const [language, setLanguage] = useState<string>(available[0] ?? "");

  useEffect(() => {
    if (open) setLanguage(available[0] ?? "");
  }, [available, open]);

  const handleSubmit = () => {
    if (!language) return;
    onSubmit(language);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-1">
          <Label htmlFor="unit-translation-language">
            {languageFieldLabel}
          </Label>
          <Select
            value={language}
            onValueChange={setLanguage}
            disabled={available.length === 0}
          >
            <SelectTrigger id="unit-translation-language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {available.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {languageLabel(lang)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button onClick={handleSubmit} disabled={!language}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

