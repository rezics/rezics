import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useTranslation } from "react-i18next";
import { ExcerptList } from "@/excerpt";
import { excerptByBookRoute } from "@/router";
import UnitsPage from "@/unit/pages/UnitsPage";
import { ExcerptNewPage } from "./ExcerptNewPage";

export function ExcerptByBookPage() {
  const { bookId } = excerptByBookRoute.useParams();
  const { t } = useTranslation();
  return (
    <div className="mt-10 mx-auto max-w-4xl w-11/12">
      <ArrowForwardIcon size={16}>
        <AccentBarWithText text={t("excerpt.excerpts_title")} />
      </ArrowForwardIcon>
      <ExcerptNewPage bookUnitId={bookId || ""} />
      <UnitsPage type="QUOTE" targetUnitId={bookId || ""} mode="single">
        {(units: any[]) => <ExcerptList units={units} />}
      </UnitsPage>
    </div>
  );
}
