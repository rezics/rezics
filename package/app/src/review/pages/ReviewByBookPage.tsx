import { bookQueries } from "@rezics/api/book/book";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Button, Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { resolveCatalogEntryInteractionContext } from "@/book-library/models/catalogEntryContext";
import { Route as reviewByBookRoute } from "@/routes/_mainLayout/review/book/$bookId";
import { ReviewNewPage } from "./ReviewNewPage";
import { ReviewsPage } from "./ReviewsPage";

export function ReviewByBookPage() {
  const { t } = useTranslation(["book", "common"]);
  const { bookId } = reviewByBookRoute.useParams();
  const navigate = useNavigate();
  const { data: bookInfo } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const catalogContext = bookInfo
    ? resolveCatalogEntryInteractionContext(bookInfo)
    : null;
  const primaryTargetUnitId = catalogContext?.primaryTargetUnitId ?? bookId;
  return (
    <div className="w-11/12 max-w-4xl mx-auto mt-16">
      <div className="flex items-center justify-between">
        <AccentBarWithText text={`${t("book:pages_review_page")}`} />
        <Button
          variant="outline"
          onClick={() => navigate({ to: `/book/${bookId}` })}
        >
          {t("common:back")}
        </Button>
      </div>
      <div className="mt-4">
        <ReviewNewPage bookUnitId={primaryTargetUnitId || ""} />
        <div className="my-4">
          <Separator />
        </div>
        <ReviewsPage
          bookUnitId={primaryTargetUnitId || ""}
          variantUnitId={catalogContext?.variantUnitId}
        />
      </div>
    </div>
  );
}
