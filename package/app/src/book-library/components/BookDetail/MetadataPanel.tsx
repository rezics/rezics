import type { AiDisclosureMode, BookDTO, LicenseSlug } from "@rezics/contract";
import { licenseLabel } from "@rezics/i18n";
import { useTranslation } from "@rezics/i18n/react";
import { AiDisclosureBadge } from "@rezics/ui";
import { Separator } from "@rezics/ui/shadcn";
import type React from "react";
import { aiDisclosureLabel } from "@/unit/models/aiDisclosureLabels";
import { resolveMetadataPanelUswn } from "../../models/bookMetadata";

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
  const { t } = useTranslation(["book"]);
  const publicationLicenseLabel = bookInfo.licenseSlug
    ? licenseLabel(bookInfo.licenseSlug as LicenseSlug)
    : undefined;
  const uswn = resolveMetadataPanelUswn(bookInfo);
  const aiDisclosureMode =
    (bookInfo.aiDisclosureMode as AiDisclosureMode | undefined) ?? "UNKNOWN";

  const items = (
    <div className="flex flex-col gap-2">
      {uswn && <p className="text-sm">USWN：{uswn}</p>}
      {bookInfo?.isbn13 && (
        <p className="text-sm">
          {t("book:fields_isbn")}：{bookInfo.isbn13}
        </p>
      )}
      <p className="text-sm">
        {t("book:fields_text_length")}：{bookInfo?.textLength ?? 0}
      </p>
      {typeof bookInfo?.chapterCount === "number" && (
        <p className="text-sm">
          {t("book:fields_chapter_count")}：{bookInfo.chapterCount}
        </p>
      )}
      {bookInfo?.pageCount != null && (
        <p className="text-sm">
          {t("book:fields_page_count")}：{bookInfo.pageCount}
        </p>
      )}
      {bookInfo?.formatKey && (
        <p className="text-sm">
          {t("book:fields_format")}：{bookInfo.formatKey}
        </p>
      )}
      {publicationLicenseLabel && (
        <p className="text-sm">
          {t("book:fields_publication_license")}：{publicationLicenseLabel}
        </p>
      )}
      <div className="flex items-center gap-2 text-sm">
        <span>{t("book:fields_ai_disclosure")}：</span>
        <AiDisclosureBadge
          mode={aiDisclosureMode}
          label={aiDisclosureLabel(aiDisclosureMode)}
        />
      </div>
    </div>
  );

  if (variant === "inline") {
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2">
          {t("book:info_panel_title")}
        </h3>
        {items}
      </div>
    );
  }

  return (
    <div className="bg-surface-elevated p-4 border border-border-whisper rounded-md">
      <h3 className="text-base font-semibold mb-2">
        {t("book:info_panel_title")}
      </h3>
      <Separator className="mb-4" />
      {items}
    </div>
  );
};
