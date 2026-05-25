import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import type React from "react";
import type { BookDescriptionProps } from "./types";
import { useMessage } from "@rezics/i18n/react";
import { book_description } from "@rezics/i18n/messages";
const m = {
  book_description,
};

const i18nMessages = {
  book_description,
};

export const BookDescription: React.FC<BookDescriptionProps> = ({
  description,
}) => {
  const m = useMessage(i18nMessages);
  return (
    <div>
      <div>
        <div className="flex mb-4">
          <AccentBarWithText text={m.book_description()} />
        </div>{" "}
        <p className="whitespace-pre-line text-base">{description}</p>
      </div>{" "}
    </div>
  );
};
