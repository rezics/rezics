import { bookKeys } from "@rezics/api/book/book";
import { useSetTranslationSourceMutation } from "@rezics/api/unit/translation-source.mutations";
import type { BookDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import type React from "react";

export interface SetSourceUnitControlProps {
  book: BookDTO;
  language: string;
  currentSourceUnitId: string | null | undefined;
}

const NO_SOURCE = "__none__";

/**
 * Inline control that lets the user wire (or unwire) the current language's
 * `sourceUnitId`. Available even when no source is set yet — that's how
 * a user gets a sync target onto an existing translation.
 */
export const SetSourceUnitControl: React.FC<SetSourceUnitControlProps> = ({
  book,
  language,
  currentSourceUnitId,
}) => {
  const { t } = useTranslation(["page"]);
  const mutation = useSetTranslationSourceMutation({
    affectedDetailKeys: () => [bookKeys.detail(book.unitId)],
  });

  return (
    <div className="flex flex-row items-center gap-2 flex-wrap">
      <span className="text-xs text-text-secondary">
        {t("page:book_edit_info_translation_set_source_label")}
      </span>
      <Select
        value={currentSourceUnitId ?? NO_SOURCE}
        onValueChange={(v) =>
          mutation.mutate({
            unitId: book.unitId,
            lang: language,
            body: { sourceUnitId: v === NO_SOURCE ? null : v },
          })
        }
        disabled={mutation.isPending}
      >
        <SelectTrigger className="min-w-[240px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_SOURCE}>
            <span className="text-text-secondary">
              {t("page:book_edit_info_translation_set_source_none")}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
