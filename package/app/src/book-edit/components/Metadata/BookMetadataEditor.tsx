import type { BookDTO, ContentRating } from "@rezics/contract";
import { RatingSelector } from "@rezics/ui";
import {
  Checkbox,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { Info as InfoOutlined } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";

/**
 * BookMetadataValue — flat overlay of book unit-level fields (i.e. fields
 * that are NOT per-language). Per-language title/subtitle/summary/description
 * are edited via the translation editor instead.
 */
export type BookMetadataValue = Partial<BookDTO>;

interface BookMetadataEditorProps {
  value?: BookMetadataValue;
  onChange?: (value: BookMetadataValue) => void;
  disabled?: boolean;
}

function FlagWithTooltip({
  label,
  tooltip,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  tooltip: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={checked}
          onCheckedChange={(c) => onCheckedChange(!!c)}
          disabled={disabled}
        />
        {label}
      </label>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <span {...props}>
                <InfoOutlined
                  size={16}
                  className="text-muted-foreground cursor-help"
                />
              </span>
            )}
          />
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export const BookMetadataEditor: React.FC<BookMetadataEditorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation();

  const currentIsbn = value?.isbn13 ?? "";
  const currentCoverUrl = value?.coverUrl ?? "";
  const currentPageCount = value?.pageCount ?? "";
  const currentTextLength = value?.textLength ?? "";

  return (
    <div className="flex flex-col gap-6">
      {/* ISBN-13 + Cover URL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm" htmlFor="book-isbn">
            {t("book.fields.isbn")}
          </label>
          <input
            id="book-isbn"
            value={currentIsbn}
            onChange={(e) => onChange?.({ isbn13: e.target.value })}
            disabled={disabled}
            className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm" htmlFor="book-cover">
            {t("book.fields.cover_url")}
          </label>
          <input
            id="book-cover"
            value={currentCoverUrl}
            onChange={(e) => onChange?.({ coverUrl: e.target.value })}
            disabled={disabled}
            placeholder="https://..."
            className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
          />
        </div>
      </div>

      {/* Page Count + Text Length */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm" htmlFor="book-pagecount">
            {t("book.fields.page_count" as any)}
          </label>
          <input
            id="book-pagecount"
            type="number"
            value={currentPageCount}
            onChange={(e) =>
              onChange?.({
                pageCount: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            disabled={disabled}
            className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm" htmlFor="book-textlength">
            {t("book.fields.text_length")}
          </label>
          <input
            id="book-textlength"
            type="number"
            value={currentTextLength}
            onChange={(e) =>
              onChange?.({
                textLength: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            disabled={disabled}
            className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
          />
        </div>
      </div>

      {/* MOCK: personCredits/orgCredits editing would need a separate credit editor component */}
      <div className="text-sm text-gray-500">
        {/* MOCK: credits editing UI placeholder - use the admin panel for now */}
        Credits (author, publisher, producer) are managed via the admin panel.
      </div>

      {/* Rating + Flags */}
      <div className="flex flex-col gap-4">
        <div className="max-w-xs">
          <RatingSelector
            value={(value?.rating as ContentRating | undefined) ?? "GENERAL"}
            onChange={(rating) => onChange?.({ rating })}
            label={t("book.fields.rating", "Content rating")}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-wrap gap-8">
          <FlagWithTooltip
            label={t("book.flags.licensed")}
            tooltip={t("book.tooltips.licensed")}
            checked={value?.isLicensed ?? false}
            onCheckedChange={(checked) => onChange?.({ isLicensed: !!checked })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

export function IsLicensedInfo({ tooltipTitle }: { tooltipTitle?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span>{t("book.flags.licensed")}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <span {...props}>
                <InfoOutlined
                  size={16}
                  className="text-muted-foreground cursor-help"
                />
              </span>
            )}
          />
          <TooltipContent>
            {tooltipTitle ?? t("book.tooltips.licensed")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default BookMetadataEditor;
