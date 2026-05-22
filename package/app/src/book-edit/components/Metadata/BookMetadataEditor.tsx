import type { BookDTO, ContentRating, LicenseSlug } from "@rezics/contract";
import {
  LICENSE_SLUGS,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
} from "@rezics/contract";
import { licenseLabel } from "@rezics/i18n";
import { RatingSelector } from "@rezics/ui";
import {
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { Info as InfoOutlined } from "lucide-react";
import type React from "react";
import { BookCreditAttributionEditor } from "./BookCreditAttributionEditor";
import * as m from "@rezics/i18n/messages";

function TooltipIconTrigger(props: Record<string, unknown>) {
  const { ref: _ref, ...triggerProps } = props;
  return (
    <span {...(triggerProps as React.HTMLAttributes<HTMLSpanElement>)}>
      <InfoOutlined size={16} className="text-muted-foreground cursor-help" />
    </span>
  );
}

/**
 * BookMetadataValue — flat overlay of book unit-level fields (i.e. fields
 * that are NOT per-language). Per-language title/subtitle/summary/description
 * are edited via the translation editor instead.
 */
export type BookMetadataValue = Partial<BookDTO>;

interface BookMetadataEditorProps {
  value?: BookMetadataValue;
  bookUnitId?: string;
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
      <div className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={checked}
          onCheckedChange={(c) => onCheckedChange(!!c)}
          disabled={disabled}
          aria-label={label}
        />
        {label}
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={(props) => <TooltipIconTrigger {...props} />}
          />
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export const BookMetadataEditor: React.FC<BookMetadataEditorProps> = ({
  value,
  bookUnitId,
  onChange,
  disabled,
}) => {
  const currentIsbn = value?.isbn13 ?? "";
  const currentCoverUrl = value?.coverUrl ?? "";
  const currentPageCount = value?.pageCount ?? "";
  const currentTextLength = value?.textLength ?? "";
  const currentLicense =
    (value?.licenseSlug as LicenseSlug | null | undefined) ??
    DEFAULT_PUBLICATION_LICENSE_SLUG;

  return (
    <div className="flex flex-col gap-6">
      {/* ISBN-13 + Cover URL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm" htmlFor="book-isbn">
            {m.book_fields_isbn()}
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
            {m.book_fields_cover_url()}
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
            {m.book_fields_page_count()}
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
            {m.book_fields_text_length()}
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

      {bookUnitId ? (
        <BookCreditAttributionEditor
          bookUnitId={bookUnitId}
          disabled={disabled}
        />
      ) : null}

      {/* Rating + Flags */}
      <div className="flex flex-col gap-4">
        <div className="max-w-xs">
          <RatingSelector
            value={(value?.rating as ContentRating | undefined) ?? "GENERAL"}
            onChange={(rating) => onChange?.({ rating })}
            label={m.book_fields_rating()}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-wrap gap-8">
          <FlagWithTooltip
            label={m.book_flags_licensed()}
            tooltip={m.book_tooltips_licensed()}
            checked={value?.isLicensed ?? false}
            onCheckedChange={(checked) => onChange?.({ isLicensed: !!checked })}
            disabled={disabled}
          />
        </div>
        <div className="max-w-xs space-y-1">
          <label className="text-sm" htmlFor="book-publication-license">
            {m.book_fields_publication_license()}
          </label>
          <Select
            value={currentLicense}
            onValueChange={(licenseSlug) =>
              onChange?.({ licenseSlug: licenseSlug as LicenseSlug })
            }
            disabled={disabled}
          >
            <SelectTrigger id="book-publication-license">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LICENSE_SLUGS.map((slug) => (
                <SelectItem key={slug} value={slug}>
                  {licenseLabel(slug)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export function IsLicensedInfo({ tooltipTitle }: { tooltipTitle?: string }) {
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span>{m.book_flags_licensed()}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={(props) => <TooltipIconTrigger {...props} />}
          />
          <TooltipContent>
            {tooltipTitle ?? m.book_tooltips_licensed()}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default BookMetadataEditor;
