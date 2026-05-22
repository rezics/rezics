import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Button, Separator } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "@rezics/i18n/react";
import { Route as reviewByBookRoute } from "@/routes/_mainLayout/review/book/$bookId";
import { ReviewNewPage } from "./ReviewNewPage";
import { ReviewsPage } from "./ReviewsPage";

export function ReviewByBookPage() {
  const { bookId } = reviewByBookRoute.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="w-11/12 max-w-4xl mx-auto mt-16">
      <div className="flex items-center justify-between">
        <AccentBarWithText text={`${t("pages.review_page")}`} />
        <Button
          variant="outline"
          onClick={() => navigate({ to: `/book/${bookId}` })}
        >
          {t("common.back")}
        </Button>
      </div>
      <div className="mt-4">
        <ReviewNewPage bookUnitId={bookId || ""} />
        <div className="my-4">
          <Separator />
        </div>
        <ReviewsPage bookUnitId={bookId || ""} />
      </div>
    </div>
  );
}
