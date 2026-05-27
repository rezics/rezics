import { bookQueries } from "@rezics/api/book/book";
import { common_back, pages_review_page } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Button, Separator } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { releaseWorkUnitId } from "@/book-library/models/releaseWork";
import { Route as reviewByBookRoute } from "@/routes/_mainLayout/review/book/$bookId";
import { ReviewNewPage } from "./ReviewNewPage";
import { ReviewsPage } from "./ReviewsPage";

const i18nMessages = {
  common_back,
  pages_review_page,
};

export function ReviewByBookPage() {
  const m = useMessage(i18nMessages);
  const { bookId } = reviewByBookRoute.useParams();
  const { scope } = reviewByBookRoute.useSearch();
  const navigate = useNavigate();
  const { data: bookInfo } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const workUnitId =
    scope === "exact" ? undefined : releaseWorkUnitId(bookInfo);
  return (
    <div className="w-11/12 max-w-4xl mx-auto mt-16">
      <div className="flex items-center justify-between">
        <AccentBarWithText text={`${m.pages_review_page()}`} />
        <Button
          variant="outline"
          onClick={() => navigate({ to: `/book/${bookId}` })}
        >
          {m.common_back()}
        </Button>
      </div>
      <div className="mt-4">
        <ReviewNewPage bookUnitId={bookId || ""} />
        <div className="my-4">
          <Separator />
        </div>
        <ReviewsPage bookUnitId={bookId || ""} workUnitId={workUnitId} />
      </div>
    </div>
  );
}
