import { adminStatsQueryOptions } from "@rezics/api/stat/stats.queries";
import * as m from "@rezics/i18n/messages";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  MessageCircle as CommentIcon,
  MessageCircleQuestion as FeedbackIcon,
  History as HistoryIcon,
  BookOpen as MenuBookIcon,
  Users as PeopleIcon,
} from "lucide-react";
import { Page } from "@/core/layouts/Page";
import { StatusOverviewCard } from "@/system-health";
import { ContentTrendChart } from "../components/chart/ContentTrendChart";
import { StatCard } from "../components/StatCard";

export default function DashboardPage() {
  const { data: stats } = useSuspenseQuery(adminStatsQueryOptions());

  return (
    <Page
      title={m.admin_dashboard_title()}
      description={m.admin_dashboard_description()}
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label={m.admin_dashboard_total_users()}
            value={stats.counts.users}
            icon={<PeopleIcon />}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label={m.admin_dashboard_total_books()}
            value={stats.counts.books}
            icon={<MenuBookIcon />}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label={m.admin_dashboard_comments()}
            value={stats.counts.comments}
            icon={<CommentIcon />}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label={m.admin_dashboard_unresolved_feedback()}
            value={stats.counts.unresolvedFeedback}
            icon={<FeedbackIcon />}
            color={
              stats.counts.unresolvedFeedback > 0
                ? "var(--colors-semantic-warning-fill)"
                : undefined
            }
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label={m.admin_dashboard_history_pending()}
            value={stats.counts.historyOutboxPending}
            icon={<HistoryIcon />}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label={m.admin_dashboard_history_failed()}
            value={stats.counts.historyOutboxFailed}
            icon={<HistoryIcon />}
            color={
              stats.counts.historyOutboxFailed > 0
                ? "var(--colors-semantic-error-fill)"
                : undefined
            }
          />
        </div>

        <div className="col-span-12">
          <StatusOverviewCard />
        </div>

        <div className="col-span-12">
          <Card>
            <CardContent>
              <h3 className="text-sm font-extrabold mb-2">
                {m.admin_dashboard_content_created_30d()}
              </h3>
              <div style={{ height: 320 }}>
                <ContentTrendChart trend={stats.contentTrend} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
