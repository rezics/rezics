import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Alert, AlertDescription } from "@rezics/ui/shadcn";
import type React from "react";
import { Route as bookEditLayoutRoute } from "@/routes/_editor/book/$bookId/edit/route";
import { TagListEdit } from "@/tag";

/**
 * 书籍标签编辑页面。展示书籍分类标签的编辑表单，支持添加、删除和管理分类标签。
 * Book Tag Edit Page: displays a form for managing book classification tags.
 *
 * Layout breakpoints:
 *
 * Mobile (<640px):
 * ┌─────────────────────┐
 * │ Tag Edit Title      │
 * │ [Accent Bar]        │
 * ├─────────────────────┤
 * │ Edit description    │
 * ├─────────────────────┤
 * │ [Alert Box]         │
 * │ Domain warning      │
 * ├─────────────────────┤
 * │ Tag Input Form      │
 * │ [Tag List]          │
 * └─────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌───────────────────────────────────┐
 * │ Tag Edit Title [Accent Bar]       │
 * ├───────────────────────────────────┤
 * │ Edit description text             │
 * ├───────────────────────────────────┤
 * │ [Alert Box] Domain warning        │
 * ├───────────────────────────────────┤
 * │ Tag Input Form (max-w-xl)         │
 * │ [Tag List Display]                │
 * └───────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────────┐
 * │ Tag Edit Title [Accent Bar]              │
 * ├──────────────────────────────────────────┤
 * │ Edit description text with more space    │
 * ├──────────────────────────────────────────┤
 * │ [Alert Box] Domain warning message       │
 * ├──────────────────────────────────────────┤
 * │ Tag Input Form (max-w-xl)                │
 * │ [Tag List with full display]             │
 * └──────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────────────────┐
 * │ Tag Edit Title [Accent Bar]                            │
 * ├────────────────────────────────────────────────────────┤
 * │ Edit description text with maximum comfortable width   │
 * ├────────────────────────────────────────────────────────┤
 * │ [Alert Box] Domain warning message                     │
 * ├────────────────────────────────────────────────────────┤
 * │ Tag Input Form (max-w-xl)  |  Extra info/guidance      │
 * │ [Tag List Display]         |  (if applicable)          │
 * └────────────────────────────────────────────────────────┘
 */
export const BookEditTagPage: React.FC = () => {
  const { t } = useTranslation("book");
  const { bookId } = bookEditLayoutRoute.useParams();
  return (
    <div className="mt-16 w-full px-4">
      <div className="pl-4">
        <div className="flex mb-4">
          <AccentBarWithText text={t("tag_edit_title")} />
        </div>
        <div className="text-sm text-muted-foreground mb-4">
          {t("tag_edit_description")}
        </div>
        <Alert className="mb-4">
          <AlertDescription>{t("tag_domain_alert")}</AlertDescription>
        </Alert>
        <TagListEdit objectUnitId={bookId} className="max-w-xl" />
      </div>
    </div>
  );
};
