import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { LANGUAGE_META, LANGUAGES } from "@rezics/contract";
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
import { useTranslation } from "react-i18next";
import { getBookTitle } from "@/shared/utils/translation-helpers";

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
  const { t } = useTranslation();
  const available = ALL_LANGS.filter((l) => !existingLanguages.includes(l));
  const [language, setLanguage] = useState<string>(available[0] ?? "");
  const [sourceReleaseUnitId, setSourceReleaseUnitId] =
    useState<string>(NO_SOURCE);

  useEffect(() => {
    if (open) {
      setLanguage(available[0] ?? "");
      setSourceReleaseUnitId(NO_SOURCE);
    }
    // We intentionally only reset on open transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
            {t("page.book_edit.info.translation.add_dialog.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6 mt-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-trans-language">
              {t("page.book_edit.info.translation.add_dialog.language")}
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
              {t(
                "page.book_edit.info.translation.add_dialog.source_release",
              )}
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
                    {t(
                      "page.book_edit.info.translation.add_dialog.no_source",
                    )}
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
              {t(
                "page.book_edit.info.translation.add_dialog.source_release_help",
              )}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!language}>
            {t("page.book_edit.info.translation.add_dialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
