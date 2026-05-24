import * as m from "@rezics/i18n/messages";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import type React from "react";
import type { BookDescriptionProps } from "./types";

export const BookDescription: React.FC<BookDescriptionProps> = ({
  description,
}) => {
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
