import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Button, Separator } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Route as reviewByBookRoute } from "@/routes/_mainLayout/review/book/$bookId";
import { ReviewNewPage } from "./ReviewNewPage";
import { ReviewsPage } from "./ReviewsPage";
import { useMessage } from "@rezics/i18n/react";
import { common_back, pages_review_page } from "@rezics/i18n/messages";
const i18nMessages = {
  common_back,
  pages_review_page,
};

export function ReviewByBookPage() {
  const m = useMessage(i18nMessages);
  const { bookId } = reviewByBookRoute.useParams();
  const navigate = useNavigate();
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
        <ReviewsPage bookUnitId={bookId || ""} />
      </div>
    </div>
  );
}
