import type { BookDTO, LicenseSlug } from "@rezics/contract";
import { LICENSE_REGISTRY } from "@rezics/contract";
import { Separator } from "@rezics/ui/shadcn";
import type React from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const licenseLabel = bookInfo.licenseSlug
    ? t(
        LICENSE_REGISTRY[bookInfo.licenseSlug as LicenseSlug]?.i18nKey,
        bookInfo.licenseSlug,
      )
    : undefined;

  const items = (
    <div className="flex flex-col gap-2">
      {bookInfo?.isbn13 && (
        <p className="text-sm">
          {t("book.fields.isbn")}：{bookInfo.isbn13}
        </p>
      )}
      <p className="text-sm">
        {t("book.fields.text_length")}：{bookInfo?.textLength ?? 0}
      </p>
      {typeof bookInfo?.chapterCount === "number" && (
        <p className="text-sm">
          {t("book.fields.chapter_count", "章節數")}：{bookInfo.chapterCount}
        </p>
      )}
      {bookInfo?.pageCount != null && (
        <p className="text-sm">
          {t("book.fields.page_count" as any)}：{bookInfo.pageCount}
        </p>
      )}
      {bookInfo?.formatKey && (
        <p className="text-sm">
          {t("book.fields.format" as any)}：{bookInfo.formatKey}
        </p>
      )}
      {licenseLabel && (
        <p className="text-sm">
          {t("book.fields.publication_license", "Publication license")}：
          {licenseLabel}
        </p>
      )}
    </div>
  );

  if (variant === "inline") {
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2">
          {t("book.info_panel.title")}
        </h3>
        {items}
      </div>
    );
  }

  return (
    <div className="bg-surface-elevated p-4 border border-border-whisper rounded-md">
      <h3 className="text-base font-semibold mb-2">
        {t("book.info_panel.title")}
      </h3>
      <Separator className="mb-4" />
      {items}
    </div>
  );
};
