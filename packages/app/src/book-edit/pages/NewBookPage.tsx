import { useTranslation } from "@rezics/i18n/react";
import { BookEditMainPage } from "./InfoPage";

export function NewBookPage() {
  const { t } = useTranslation("book");
  return (
    <div>
      <BookEditMainPage newBook={true} pageTitle={t("create_book")} />
    </div>
  );
}
