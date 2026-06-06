import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import type React from "react";
import type { BookDescriptionProps } from "./types";

export const BookDescription: React.FC<BookDescriptionProps> = ({
  description,
}) => {
  const { t } = useTranslation(["book"]);
  return (
    <div>
      <div>
        <div className="flex mb-4">
          <AccentBarWithText text={t("book:description")} />
        </div>{" "}
        <p className="whitespace-pre-line text-base">{description}</p>
      </div>{" "}
    </div>
  );
};
