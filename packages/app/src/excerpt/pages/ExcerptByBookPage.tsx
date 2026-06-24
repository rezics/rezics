import { useTranslation } from "@rezics/i18n/react";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { ExcerptList } from "@/excerpt";
import { Route as excerptByBookRoute } from "@/routes/_mainLayout/excerpt/book/$bookId";
import { UnitsPage } from "@/unit";
import { ExcerptNewPage } from "./ExcerptNewPage";

/**
 * 按书籍显示摘录页面 - 显示所有摘录、新建摘录表单、摘录列表
 *
 * 布局结构：
 * - 移动端 (<640px)：w-full px-4（边距留出），max-w-4xl 约束，mt-16（顶部间距）
 * - 平板 (640-1023px)：mx-auto（中心），max-w-4xl，mt-16
 * - 桌面 (1024-1535px)：mx-auto（中心），max-w-4xl，mt-16
 * - 超宽 (>=1536px)：mx-auto（中心），max-w-4xl，mt-16
 *
 * ASCII 布局示意:
 *
 * All Viewports (centered with max-w-4xl)
 * +----------+
 * |TITLE BAR |
 * +----------+
 * +----------+
 * |NEW FORM  |
 * +----------+
 * +----------+
 * |EXCERPT   |
 * |LIST      |
 * +----------+
 */
export function ExcerptByBookPage() {
  const { t } = useTranslation(["community"]);
  const { bookId } = excerptByBookRoute.useParams();
  return (
    <div className="mt-16 mx-auto max-w-4xl w-full px-4">
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
