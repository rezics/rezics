import type {
  AiDisclosureMode,
  BookDTO,
  ContentRating,
  LicenseSlug,
} from "@rezics/contract";
import {
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  LICENSE_SLUGS,
} from "@rezics/contract";
import { licenseLabel } from "@rezics/i18n";
import { useTranslation } from "@rezics/i18n/react";
import { AiDisclosureSelector, RatingSelector } from "@rezics/ui";
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
import { ImageUploadField } from "@/shared/ui/ImageUploadField";
import { aiDisclosureLabelMap } from "@/unit";
import { BookCreditAttributionEditor } from "./BookCreditAttributionEditor";

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
 * BookMetadataValue —— 书籍 unit 级字段的扁平覆盖层（即非按语言区分的字段）。
 * 按语言区分的 title/subtitle/summary/description 改由翻译编辑器编辑。
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
  const { t } = useTranslation(["book", "common"]);
  const currentIsbn = value?.isbn13 ?? "";
  const currentCoverUrl = value?.coverUrl ?? "";
  const currentPageCount = value?.pageCount ?? "";
  const currentTextLength = value?.textLength ?? "";
  const currentLicense =
    (value?.licenseSlug as LicenseSlug | null | undefined) ??
    DEFAULT_PUBLICATION_LICENSE_SLUG;
  const aiDisclosureLabels = aiDisclosureLabelMap();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm" htmlFor="book-isbn">
            {t("book:fields_isbn")}
          </label>
          <input
            id="book-isbn"
            value={currentIsbn}
            onChange={(e) => onChange?.({ isbn13: e.target.value })}
            disabled={disabled}
            className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
          />
        </div>
        <ImageUploadField
          value={currentCoverUrl || null}
          onChange={(url) => onChange?.({ coverUrl: url ?? "" })}
          label={t("book:fields_cover_url")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm" htmlFor="book-pagecount">
            {t("book:fields_page_count")}
          </label>
          <input
            id="book-pagecount"
            type="number"
            min={1}
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
            {t("book:fields_text_length")}
          </label>
          <input
            id="book-textlength"
            type="number"
            min={0}
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

      <div className="flex flex-col gap-4">
        <div className="max-w-xs">
          <RatingSelector
            value={(value?.rating as ContentRating | undefined) ?? "GENERAL"}
            onChange={(rating) => onChange?.({ rating })}
            label={t("book:fields_rating")}
            disabled={disabled}
          />
        </div>
        <div className="max-w-xs">
          <AiDisclosureSelector
            value={
              (value?.aiDisclosureMode as AiDisclosureMode | undefined) ??
              "UNKNOWN"
            }
            onChange={(aiDisclosureMode) => onChange?.({ aiDisclosureMode })}
            label={t("book:fields_ai_disclosure")}
            labels={aiDisclosureLabels}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-wrap gap-8">
          <FlagWithTooltip
            label={t("book:flags_licensed")}
            tooltip={t("book:tooltips_licensed")}
            checked={value?.isLicensed ?? false}
            onCheckedChange={(checked) => onChange?.({ isLicensed: !!checked })}
            disabled={disabled}
          />
        </div>
        <div className="max-w-xs space-y-1">
          <label className="text-sm" htmlFor="book-publication-license">
            {t("book:fields_publication_license")}
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
  const { t } = useTranslation(["book", "common"]);
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span>{t("book:flags_licensed")}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={(props) => <TooltipIconTrigger {...props} />}
          />
          <TooltipContent>
            {tooltipTitle ?? t("book:tooltips_licensed")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
