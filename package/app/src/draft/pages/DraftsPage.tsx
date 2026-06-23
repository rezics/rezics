import { useDrafts } from "@rezics/api/draft";
import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { DraftList } from "../components/DraftList";
import { useRequireAuth } from "@/user/pages/useAuth";
import { QueryBoundary } from "@/core";

/**
 * `u/me/drafts` — the unified cross-type draft inbox. Drafts are not part of
 * a shared aggregate (they change as the user edits), so this page reads them
 * through the dedicated `useDrafts` hook.
 *
 * 统一的跨类型草稿收件箱。草稿不是共享聚合的一部分（它们随用户编辑而变化），
 * 因此此页面通过专用的 `useDrafts` hook 读取它们。
 *
 * @layout
 *
 * Mobile <640px (p-4, single column):
 * +---------+
 * | Title   |
 * | Subtitle|
 * +---------+
 * | Status  |
 * | or List |
 * | Items   |
 * +---------+
 *
 * Tablet 640–1023px (md:p-6, single column, max-w-3xl):
 * +-----------+
 * | Title     |
 * | Subtitle  |
 * +-----------+
 * | Status    |
 * | or List   |
 * | Items     |
 * +-----------+
 *
 * Desktop 1024–1535px (md:p-6, centered, max-w-3xl):
 * Centered single column, constrained to max-w-3xl
 *
 * Ultra-wide ≥1536px:
 * Centered single column, constrained to max-w-3xl
 */
export const DraftsPage: React.FC = () => {
  useRequireAuth();
  const { t } = useTranslation(["page", "common"]);
  const draftQuery = useDrafts();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t("page:drafts_title")}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {t("page:drafts_subtitle")}
        </p>
      </div>

      <QueryBoundary
        query={draftQuery}
        isEmpty={(data) => (data?.drafts ?? []).length === 0}
        emptyTitle={t("page:drafts_empty")}
      >
        {(data) => <DraftList drafts={data.drafts ?? []} />}
      </QueryBoundary>
    </div>
  );
};
