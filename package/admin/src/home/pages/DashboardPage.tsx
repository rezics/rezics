import { adminStatsQueryOptions } from "@rezics/api/stat/stats.queries";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Page } from "@/core/layouts/Page";
import { ContentTrendChart } from "../components/chart/ContentTrendChart";
import { HealthStrip } from "../components/HealthStrip";
import { StatCard } from "../components/StatCard";
import {
  MessageCircle as CommentIcon,
  MessageCircleQuestion as FeedbackIcon,
  BookOpen as MenuBookIcon,
  History as HistoryIcon,
  Users as PeopleIcon,
} from "lucide-react";

export default function DashboardPage() {
  const { data: stats } = useSuspenseQuery(adminStatsQueryOptions());

  return (
    <Page title="Dashboard" description="Platform overview and system health">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label="Total Users"
            value={stats.counts.users}
            icon={<PeopleIcon />}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label="Total Books"
            value={stats.counts.books}
            icon={<MenuBookIcon />}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label="Comments"
            value={stats.counts.comments}
            icon={<CommentIcon />}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label="Unresolved Feedback"
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
            label="History Pending"
            value={stats.counts.historyOutboxPending}
            icon={<HistoryIcon />}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label="History Failed"
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
          <HealthStrip
            server={stats.health.server}
            meili={stats.health.meili}
          />
        </div>

        <div className="col-span-12">
          <Card>
            <CardContent>
              <h3 className="text-sm font-extrabold mb-2">
                Content Created (Last 30 Days)
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
