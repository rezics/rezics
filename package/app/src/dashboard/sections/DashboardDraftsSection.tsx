import { useDrafts } from "@rezics/api/draft";
import { useTranslation } from "@rezics/i18n/react";
import { Card, CardContent, CardHeader, CardTitle } from "@rezics/ui/shadcn";
import type React from "react";
import { DraftList } from "@/draft";
import { Link } from "@/shared/ui/link";

const DASHBOARD_DRAFTS_LIMIT = 5;

/**
 * Dashboard entry point into the drafts inbox. Drafts are not aggregated into
 * the dashboard summary, so this section fetches its own preview via
 * `useDrafts` and always exposes the "view all" link to `u/me/drafts`.
 */
export const DashboardDraftsSection: React.FC = () => {
  const { t } = useTranslation(["page"]);
  const { data } = useDrafts({ limit: DASHBOARD_DRAFTS_LIMIT });
  const drafts = data?.drafts ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>{t("page:dashboard_drafts")}</CardTitle>
        <Link
          to="/u/me/drafts"
          className="flex-none text-sm text-text-secondary hover:text-text-primary"
        >
          {t("page:dashboard_drafts_view_all")}
        </Link>
      </CardHeader>
      <CardContent>
        {drafts.length === 0 ? (
          <p className="text-sm text-text-secondary">
            {t("page:drafts_empty")}
          </p>
        ) : (
          <DraftList drafts={drafts} />
        )}
      </CardContent>
    </Card>
  );
};
