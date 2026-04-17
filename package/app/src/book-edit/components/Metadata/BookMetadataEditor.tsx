import { InfoOutlined } from "@mui/icons-material";
import {
  Checkbox,
  FormControlLabel,
  TextField as MuiTextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { BookDTO } from "@rezics/contract";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  getBookTitle,
  getBookDescription,
  getBookAuthorName,
  getBookPublisherName,
  getBookCoverUrl,
} from "@/shared/utils/translation-helpers";

/**
 * BookMetadataValue - editing state uses a flat overlay on top of BookDTO.
 * New fields: isbn13, coverUrl, pageCount, formatKey, publicationDate.
 * Title/description come from translations but we expose them as flat fields for editing.
 */
export type BookMetadataValue = Partial<BookDTO> & {
  // MOCK: flat editing fields that map to translations
  _editTitle?: string;
  _editDescription?: string;
};

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
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={(_, c) => onCheckedChange(c)}
            disabled={disabled}
            size="small"
          />
        }
        label={label}
        slotProps={{ typography: { variant: "body2" } }}
      />
      <Tooltip title={tooltip}>
        <InfoOutlined
          sx={{ fontSize: 16 }}
          className="text-muted-foreground cursor-help"
        />
      </Tooltip>
    </div>
  );
}

export const BookMetadataEditor: React.FC<BookMetadataEditorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation();

  // Resolve current display values from translations or override fields
  const currentTitle = value?._editTitle ?? getBookTitle(value as BookDTO);
  const currentIsbn = value?.isbn13 ?? '';
  const currentCoverUrl = value?.coverUrl ?? '';
  const currentPageCount = value?.pageCount ?? '';
  const currentTextLength = value?.textLength ?? '';

  return (
    <div className="flex flex-col gap-5">
      {/* Title (from translations) */}
      <div className="space-y-1">
        <Typography variant="body2" component="label" htmlFor="book-title">{t("book.fields.title")}</Typography>
        <input
          id="book-title"
          value={currentTitle}
          onChange={(e) => onChange?.({ _editTitle: e.target.value })}
          disabled={disabled}
          className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
        />
      </div>

      {/* ISBN-13 + Cover URL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Typography variant="body2" component="label" htmlFor="book-isbn">{t("book.fields.isbn")}</Typography>
          <input
            id="book-isbn"
            value={currentIsbn}
            onChange={(e) => onChange?.({ isbn13: e.target.value })}
            disabled={disabled}
            className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <Typography variant="body2" component="label" htmlFor="book-cover">{t("book.fields.cover_url")}</Typography>
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
          <Typography variant="body2" component="label" htmlFor="book-pagecount">{t("book.fields.page_count" as any)}</Typography>
          <input
            id="book-pagecount"
            type="number"
            value={currentPageCount}
            onChange={(e) => onChange?.({ pageCount: e.target.value ? Number(e.target.value) : undefined })}
            disabled={disabled}
            className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <Typography variant="body2" component="label" htmlFor="book-textlength">{t("book.fields.text_length")}</Typography>
          <input
            id="book-textlength"
            type="number"
            value={currentTextLength}
            onChange={(e) => onChange?.({ textLength: e.target.value ? Number(e.target.value) : undefined })}
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

      {/* Flags */}
      <div className="flex flex-wrap gap-6">
        <FlagWithTooltip
          label={t("book.flags.licensed")}
          tooltip={t("book.tooltips.licensed")}
          checked={value?.isLicensed ?? false}
          onCheckedChange={(checked) => onChange?.({ isLicensed: !!checked })}
          disabled={disabled}
        />
        <FlagWithTooltip
          label={t("book.flags.nsfw")}
          tooltip={t("book.tooltips.nsfw")}
          checked={value?.nsfw ?? false}
          onCheckedChange={(checked) => onChange?.({ nsfw: !!checked })}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

/**
 * Standalone flag info components for search and other features.
 */
export function NSFWInfo({ tooltipTitle }: { tooltipTitle?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <span>{t("book.flags.nsfw")}</span>
      <Tooltip title={tooltipTitle ?? t("book.tooltips.nsfw")}>
        <InfoOutlined
          sx={{ fontSize: 16 }}
          className="text-muted-foreground cursor-help"
        />
      </Tooltip>
    </div>
  );
}

export function IsLicensedInfo({ tooltipTitle }: { tooltipTitle?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span>{t("book.flags.licensed")}</span>
      <Tooltip title={tooltipTitle ?? t("book.tooltips.licensed")}>
        <InfoOutlined
          sx={{ fontSize: 16 }}
          className="text-muted-foreground cursor-help"
        />
      </Tooltip>
    </div>
  );
}

export default BookMetadataEditor;
