import { bookQueries } from "@rezics/api/book/book";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Button, Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { resolveCatalogEntryInteractionContext } from "@/book-library";
import { Route as reviewByBookRoute } from "@/routes/_mainLayout/review/book/$bookId";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { ReviewNewPage } from "./ReviewNewPage";
import { ReviewsPage } from "./ReviewsPage";

/**
 * 按书籍显示评论页面 - 显示所有评论、新建评论表单、评论列表
 *
 * 布局结构：
 * - 移动端 (<640px)：w-11/12（边距留出），max-w-4xl 约束，mt-16（顶部间距）
 * - 平板 (640-1023px)：mx-auto（中心），max-w-4xl，mt-16
 * - 桌面 (1024-1535px)：mx-auto（中心），max-w-4xl，mt-16
 * - 超宽 (>=1536px)：mx-auto（中心），max-w-4xl，mt-16
 *
 * ASCII 布局示意:
 *
 * All Viewports (centered with max-w-4xl)
 * +----------+
 * |TITLE  BK |
 * +----------+
 * +----------+
 * |NEW FORM  |
 * +----------+
 * +__SPLIT___+
 * +----------+
 * |REVIEW    |
 * |LIST PAGE |
 * +----------+
 *
 * BK=BackButton
 */
export function ReviewByBookPage() {
  const { t } = useTranslation(["book", "common"]);
  const { bookId } = reviewByBookRoute.useParams();
  const navigate = useNavigate();
  const readContext = useReadLanguageContext();
  const { data: bookInfo } = useQuery({
    ...bookQueries.detail(bookId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: Boolean(bookId) && readContext.ready,
  });
  const catalogContext = bookInfo
    ? resolveCatalogEntryInteractionContext(bookInfo)
    : null;
  const primaryTargetUnitId = catalogContext?.primaryTargetUnitId ?? bookId;
  return (
    <div className="w-full px-4 max-w-4xl mx-auto mt-16">
      <div className="flex items-center justify-between">
        <AccentBarWithText text={`${t("book:pages_review_page")}`} />
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/book/$bookId", params: { bookId } })}
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
