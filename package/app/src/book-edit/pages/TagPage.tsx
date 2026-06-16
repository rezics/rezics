import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Alert, AlertDescription } from "@rezics/ui/shadcn";
import type React from "react";
import { Route as bookEditLayoutRoute } from "@/routes/_editor/book/$bookId/edit/route";
import { TagListEdit } from "@/tag";

export const BookEditTagPage: React.FC = () => {
  const { t } = useTranslation("book");
  const { bookId } = bookEditLayoutRoute.useParams();
  return (
    <div className="mt-16 mx-auto w-11/12">
      <div className="pl-4">
        <div className="flex mb-4">
          <AccentBarWithText text={t("tag_edit_title")} />
        </div>
        <div className="text-sm text-muted-foreground mb-4">
          {t("tag_edit_description")}
        </div>
        <Alert className="mb-4">
          <AlertDescription>{t("tag_domain_alert")}</AlertDescription>
        </Alert>
        <TagListEdit objectUnitId={bookId} className="max-w-xl" />
      </div>
    </div>
  );
};
