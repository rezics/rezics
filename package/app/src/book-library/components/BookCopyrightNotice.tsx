import { Copyright as CopyrightOutlined } from "lucide-react";
import type React from "react";
import { useTranslation } from "@rezics/i18n/react";

export const BookCopyrightNotice: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex flex-row gap-3 items-start">
        <CopyrightOutlined className="w-4 h-4 mt-[2px] flex-shrink-0 text-text-tertiary" />
        <div className="flex flex-col gap-1">
          <span
            className="block text-xs text-text-secondary"
            style={{ lineHeight: 1.55 }}
          >
            {t("book.copyright_notice.body")}
          </span>
          <span
            className="block text-xs text-text-tertiary"
            style={{ lineHeight: 1.55 }}
          >
            {t("book.copyright_notice.fair_use")}
          </span>
        </div>
      </div>
    </div>
  );
};
