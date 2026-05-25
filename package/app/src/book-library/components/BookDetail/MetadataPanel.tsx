import type { BookDTO, LicenseSlug } from "@rezics/contract";
import { licenseLabel } from "@rezics/i18n";
import {
  book_fields_chapter_count,
  book_fields_format,
  book_fields_isbn,
  book_fields_page_count,
  book_fields_publication_license,
  book_fields_text_length,
  book_info_panel_title,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Separator } from "@rezics/ui/shadcn";
import type React from "react";

const i18nMessages = {
  book_fields_chapter_count,
  book_fields_format,
  book_fields_isbn,
  book_fields_page_count,
  book_fields_publication_license,
  book_fields_text_length,
  book_info_panel_title,
};

export type MetadataPanelProps = {
  bookInfo: BookDTO;
  variant?: "panel" | "inline";
};

/**
 * Compact book metadata: ISBN, text length, page count, format.
 * Used as a sidebar section on desktop and inline on mobile.
 */
export const MetadataPanel: React.FC<MetadataPanelProps> = ({
  bookInfo,
  variant = "panel",
}) => {
  const m = useMessage(i18nMessages);
  const publicationLicenseLabel = bookInfo.licenseSlug
    ? licenseLabel(bookInfo.licenseSlug as LicenseSlug)
    : undefined;

  const items = (
    <div className="flex flex-col gap-2">
      {bookInfo?.isbn13 && (
        <p className="text-sm">
          {m.book_fields_isbn()}：{bookInfo.isbn13}
        </p>
      )}
      <p className="text-sm">
        {m.book_fields_text_length()}：{bookInfo?.textLength ?? 0}
      </p>
      {typeof bookInfo?.chapterCount === "number" && (
        <p className="text-sm">
          {m.book_fields_chapter_count()}：{bookInfo.chapterCount}
        </p>
      )}
      {bookInfo?.pageCount != null && (
        <p className="text-sm">
          {m.book_fields_page_count()}：{bookInfo.pageCount}
        </p>
      )}
      {bookInfo?.formatKey && (
        <p className="text-sm">
          {m.book_fields_format()}：{bookInfo.formatKey}
        </p>
      )}
      {publicationLicenseLabel && (
        <p className="text-sm">
          {m.book_fields_publication_license()}：{publicationLicenseLabel}
        </p>
      )}
    </div>
  );

  if (variant === "inline") {
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2">
          {m.book_info_panel_title()}
        </h3>
        {items}
      </div>
    );
  }

  return (
    <div className="bg-surface-elevated p-4 border border-border-whisper rounded-md">
      <h3 className="text-base font-semibold mb-2">
        {m.book_info_panel_title()}
      </h3>
      <Separator className="mb-4" />
      {items}
    </div>
  );
};
