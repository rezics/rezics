import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { LANGUAGE_META, LANGUAGES } from "@rezics/contract";
import {
  common_cancel,
  page_book_edit_info_translation_add_dialog_language,
  page_book_edit_info_translation_add_dialog_no_source,
  page_book_edit_info_translation_add_dialog_source_release,
  page_book_edit_info_translation_add_dialog_source_release_help,
  page_book_edit_info_translation_add_dialog_submit,
  page_book_edit_info_translation_add_dialog_title,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
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
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { getBookTitle } from "@/shared/utils/translation-helpers";

const i18nMessages = {
  common_cancel,
  page_book_edit_info_translation_add_dialog_language,
  page_book_edit_info_translation_add_dialog_no_source,
  page_book_edit_info_translation_add_dialog_source_release,
  page_book_edit_info_translation_add_dialog_source_release_help,
  page_book_edit_info_translation_add_dialog_submit,
  page_book_edit_info_translation_add_dialog_title,
};

export interface AddTranslationDialogProps {
  open: boolean;
  book: BookDTO | null | undefined;
  existingLanguages: string[];
  onClose: () => void;
  onSubmit: (params: {
    language: string;
    sourceReleaseUnitId: string | null;
  }) => void;
}

const ALL_LANGS = Object.values(LANGUAGES);
const NO_SOURCE = "__none__";

export const AddTranslationDialog: React.FC<AddTranslationDialogProps> = ({
  open,
  book,
  existingLanguages,
  onClose,
  onSubmit,
}) => {
  const m = useMessage(i18nMessages);
  const available = ALL_LANGS.filter((l) => !existingLanguages.includes(l));
  const firstAvailableLanguage = available[0] ?? "";
  const [language, setLanguage] = useState<string>(firstAvailableLanguage);
  const [sourceReleaseUnitId, setSourceReleaseUnitId] =
    useState<string>(NO_SOURCE);

  useEffect(() => {
    if (open) {
      setLanguage(firstAvailableLanguage);
      setSourceReleaseUnitId(NO_SOURCE);
    }
  }, [open, firstAvailableLanguage]);

  // Sibling releases under the same work — also let the user pick the work
  // itself (for releases) or any release of this work (for works).
  const siblingFilter = book?.workUnitId
    ? { workUnitId: book.workUnitId }
    : { workUnitId: book?.unitId };
  const { data: siblings } = useQuery({
    ...bookQueries.list({ ...siblingFilter, limit: 50 }),
    enabled: open && Boolean(book?.unitId),
  });

  const candidates = (siblings?.books ?? []).filter(
    (b) => b.unitId !== book?.unitId,
  );

  const handleSubmit = () => {
    if (!language) return;
    onSubmit({
      language,
      sourceReleaseUnitId:
        sourceReleaseUnitId === NO_SOURCE ? null : sourceReleaseUnitId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {m.page_book_edit_info_translation_add_dialog_title()}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6 mt-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-trans-language">
              {m.page_book_edit_info_translation_add_dialog_language()}
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
              {m.page_book_edit_info_translation_add_dialog_source_release()}
            </Label>
            <Select
              value={sourceReleaseUnitId}
              onValueChange={(v) => setSourceReleaseUnitId(v)}
            >
              <SelectTrigger id="add-trans-source" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SOURCE}>
                  <span className="text-text-secondary">
                    {m.page_book_edit_info_translation_add_dialog_no_source()}
                  </span>
                </SelectItem>
                {candidates.map((b) => (
                  <SelectItem key={b.unitId} value={b.unitId}>
                    {getBookTitle(b) || b.unitId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-text-secondary">
              {m.page_book_edit_info_translation_add_dialog_source_release_help()}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button onClick={handleSubmit} disabled={!language}>
            {m.page_book_edit_info_translation_add_dialog_submit()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
