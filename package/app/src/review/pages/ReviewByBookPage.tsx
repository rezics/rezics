import { Button, Divider } from "@mui/material";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { reviewByBookRoute } from "@/router";
import { ReviewNewPage } from "./ReviewNewPage";
import { ReviewsPage } from "./ReviewsPage";

export function ReviewByBookPage() {
  const { bookId } = reviewByBookRoute.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="w-11/12 max-w-4xl mx-auto mt-10">
      <div className="flex items-center justify-between">
        <AccentBarWithText text={`${t("pages.review_page")}`} />
        <Button
          variant="outlined"
          color="primary"
          onClick={() => navigate({ to: `/book/${bookId}` })}
        >
          {t("common.back")}
        </Button>
      </div>
      <div className="mt-4">
        <ReviewNewPage bookUnitId={bookId || ""} />
        <div className="my-4">
          <Divider />
        </div>
        <ReviewsPage bookUnitId={bookId || ""} />
      </div>
    </div>
  );
}
