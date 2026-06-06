import { useTranslation } from "@rezics/i18n/react";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { ExcerptList } from "@/excerpt";
import { Route as excerptByBookRoute } from "@/routes/_mainLayout/excerpt/book/$bookId";
import UnitsPage from "@/unit/pages/UnitsPage";
import { ExcerptNewPage } from "./ExcerptNewPage";

export function ExcerptByBookPage() {
  const { t } = useTranslation(["community"]);
  const { bookId } = excerptByBookRoute.useParams();
  return (
    <div className="mt-16 mx-auto max-w-4xl w-11/12">
      <ArrowForwardIcon size={16}>
        <AccentBarWithText text={t("community:excerpt_excerpts_title")} />
      </ArrowForwardIcon>
      <ExcerptNewPage bookUnitId={bookId || ""} />
      <UnitsPage type="QUOTE" targetUnitId={bookId || ""} mode="single">
        {(units: any[]) => <ExcerptList units={units} />}
      </UnitsPage>
    </div>
  );
}
