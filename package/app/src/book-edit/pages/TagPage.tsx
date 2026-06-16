import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import type React from "react";
import { Route as bookEditLayoutRoute } from "@/routes/_editor/book/$bookId/edit/route";
import { UnitTagVotingEditor } from "@/tag";

/**
 * 书籍标签编辑页面。当前页只提供页面标题与说明，实际 tag 投票与个人标识
 * 编辑由 tag feature 的 UnitTagVotingEditor 复用组件承载。
 *
 * Mobile
 * +------------------------------+
 * | Title                        |
 * | Description                  |
 * | Global tag vote section      |
 * | Realm tag vote section       |
 * | Personal marks section       |
 * +------------------------------+
 *
 * Tablet
 * +------------------------------------------+
 * | centered content max width               |
 * | section rows stretch to full width       |
 * +------------------------------------------+
 *
 * Desktop
 * +------------------------------------------------+
 * | w-full max-w-3xl mx-auto                       |
 * | editor sections separated by vertical rhythm   |
 * +------------------------------------------------+
 *
 * Ultra-wide
 * +------------------------------------------------+
 * | same centered max width; outer whitespace grows |
 * +------------------------------------------------+
 */
export const BookEditTagPage: React.FC = () => {
  const { t } = useTranslation("book");
  const { bookId } = bookEditLayoutRoute.useParams();
  return (
    <div className="mt-16 w-full px-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex mb-4">
          <AccentBarWithText text={t("tag_edit_title")} />
        </div>
        <div className="text-sm leading-ui text-text-secondary">
          {t("tag_edit_description")}
        </div>
        <UnitTagVotingEditor unitId={bookId} />
      </div>
    </div>
  );
};
