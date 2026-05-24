import { bookKeys, bookQueries } from "@rezics/api/book/book";
import { useSetTranslationSourceMutation } from "@rezics/api/unit/translation-source.mutations";
import type { BookDTO } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { getBookTitle } from "@/shared/utils/translation-helpers";

const NO_SOURCE = "__none__";

export interface SetSourceReleaseControlProps {
  book: BookDTO;
  language: string;
  currentSourceReleaseUnitId: string | null | undefined;
}

/**
 * Inline control that lets the user wire (or unwire) the current language's
 * `sourceReleaseUnitId`. Available even when no source is set yet — that's how
 * a user gets a sync target onto an existing translation.
 */
export const SetSourceReleaseControl: React.FC<
  SetSourceReleaseControlProps
> = ({ book, language, currentSourceReleaseUnitId }) => {
  const siblingFilter = book.workUnitId
    ? { workUnitId: book.workUnitId }
    : { workUnitId: book.unitId };
  const { data: siblings } = useQuery({
    ...bookQueries.list({ ...siblingFilter, limit: 50 }),
    enabled: Boolean(book.unitId),
  });

  const mutation = useSetTranslationSourceMutation({
    affectedDetailKeys: () => [bookKeys.detail(book.unitId)],
  });

  const candidates = (siblings?.books ?? []).filter(
    (b) => b.unitId !== book.unitId,
  );

  return (
    <div className="flex flex-row items-center gap-2 flex-wrap">
      <span className="text-xs text-text-secondary">
        {m.page_book_edit_info_translation_set_source_label()}
      </span>
      <Select
        value={currentSourceReleaseUnitId ?? NO_SOURCE}
        onValueChange={(v) =>
          mutation.mutate({
            workId: book.unitId,
            lang: language,
            body: { sourceReleaseUnitId: v === NO_SOURCE ? null : v },
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
              {m.page_book_edit_info_translation_set_source_none()}
            </span>
          </SelectItem>
          {candidates.map((b) => (
            <SelectItem key={b.unitId} value={b.unitId}>
              {getBookTitle(b) || b.unitId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
