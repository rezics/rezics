import { Copyright as CopyrightOutlined } from "lucide-react";
import type React from "react";
import { useMessage } from "@rezics/i18n/react";
import {
  book_copyright_notice_body,
  book_copyright_notice_fair_use,
} from "@rezics/i18n/messages";
const m = {
  book_copyright_notice_body,
  book_copyright_notice_fair_use,
};

const i18nMessages = {
  book_copyright_notice_body,
  book_copyright_notice_fair_use,
};

export const BookCopyrightNotice: React.FC = () => {
  const m = useMessage(i18nMessages);
  return (
    <div>
      <div className="flex flex-row gap-3 items-start">
        <CopyrightOutlined className="w-4 h-4 mt-[2px] flex-shrink-0 text-text-tertiary" />
        <div className="flex flex-col gap-1">
          <span
            className="block text-xs text-text-secondary"
            style={{ lineHeight: 1.55 }}
          >
            {m.book_copyright_notice_body()}
          </span>
          <span
            className="block text-xs text-text-tertiary"
            style={{ lineHeight: 1.55 }}
          >
            {m.book_copyright_notice_fair_use()}
          </span>
        </div>
      </div>
    </div>
  );
};
