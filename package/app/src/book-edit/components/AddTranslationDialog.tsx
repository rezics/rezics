import type { BookDTO } from "@rezics/contract";
import { LANGUAGE_META, LANGUAGES } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import type React from "react";
import { useEffect, useState } from "react";

export interface AddTranslationDialogProps {
  open: boolean;
  book: BookDTO | null | undefined;
  existingLanguages: string[];
  onClose: () => void;
  onSubmit: (params: { language: string; sourceUnitId: string | null }) => void;
}

const ALL_LANGS = Object.values(LANGUAGES);
const NO_SOURCE = "__none__";

export const AddTranslationDialog: React.FC<AddTranslationDialogProps> = ({
  open,
  existingLanguages,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation(["common", "page"]);
  const available = ALL_LANGS.filter((l) => !existingLanguages.includes(l));
  const firstAvailableLanguage = available[0] ?? "";
  const [language, setLanguage] = useState<string>(firstAvailableLanguage);
  const [sourceUnitId, setSourceReleaseUnitId] = useState<string>(NO_SOURCE);

  useEffect(() => {
    if (open) {
      setLanguage(firstAvailableLanguage);
      setSourceReleaseUnitId(NO_SOURCE);
    }
  }, [open, firstAvailableLanguage]);

  const handleSubmit = () => {
    if (!language) return;
    onSubmit({
      language,
      sourceUnitId: sourceUnitId === NO_SOURCE ? null : sourceUnitId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("page:book_edit_info_translation_add_dialog_title")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6 mt-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-trans-language">
              {t("page:book_edit_info_translation_add_dialog_language")}
            </Label>
            <Select
              value={language}
              onValueChange={(v) => setLanguage(v)}
              disabled={available.length === 0}
            >
              <SelectTrigger id="add-trans-language" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {available.map((l) => (
                  <SelectItem key={l} value={l}>
                    {(LANGUAGE_META as Record<string, { nativeName?: string }>)[
                      l
                    ]?.nativeName ?? l}{" "}
                    ({l})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="add-trans-source">
              {t("page:book_edit_info_translation_add_dialog_source_release")}
            </Label>
            <Select
              value={sourceUnitId}
              onValueChange={(v) => setSourceReleaseUnitId(v)}
            >
              <SelectTrigger id="add-trans-source" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SOURCE}>
                  <span className="text-text-secondary">
                    {t("page:book_edit_info_translation_add_dialog_no_source")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-text-secondary">
              {t(
                "page:book_edit_info_translation_add_dialog_source_release_help",
              )}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common:cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!language}>
            {t("page:book_edit_info_translation_add_dialog_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
