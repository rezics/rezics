import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useTranslation } from "react-i18next";
import { QuoteExcerptListContainer } from "@/review/component/QuoteExcerptList";
import { quoteByBookRoute } from "@/router";
import UnitsPage from "@/unit/page/UnitsPage";
import { QuoteNewPage } from "./QuoteNewPage";

export function QuoteByBookPage() {
  const { bookId } = quoteByBookRoute.useParams();
  const { t } = useTranslation();
  return (
    <div className="mt-10 mx-auto max-w-4xl w-11/12">
      <ArrowForwardIcon size={16}>
        <AccentBarWithText text={t("quote.excerpts_title")} />
      </ArrowForwardIcon>
      <QuoteNewPage bookUnitId={bookId || ""} />
      <UnitsPage type="QUOTE" targetUnitId={bookId || ""} mode="single">
        {(units: any[]) => <QuoteExcerptListContainer data={{ units }} />}
      </UnitsPage>
    </div>
  );
}
