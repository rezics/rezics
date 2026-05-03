import { Card, CardContent, Grid, Typography } from "@mui/material";
import { adminStatsQueryOptions } from "@rezics/api/stat/stats.queries";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Page } from "@/core/layouts/Page";
import { ContentTrendChart } from "../components/chart/ContentTrendChart";
import { HealthStrip } from "../components/HealthStrip";
import { StatCard } from "../components/StatCard";
import { MessageCircle as CommentIcon, MessageCircleQuestion as FeedbackIcon, BookOpen as MenuBookIcon, Users as PeopleIcon } from "lucide-react";

export default function DashboardPage() {
  const { data: stats } = useSuspenseQuery(adminStatsQueryOptions());

  return (
    <Page title="Dashboard" description="Platform overview and system health">
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Total Users"
            value={stats.counts.users}
            icon={<PeopleIcon />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Total Books"
            value={stats.counts.books}
            icon={<MenuBookIcon />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Comments"
            value={stats.counts.comments}
            icon={<CommentIcon />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Unresolved Feedback"
            value={stats.counts.unresolvedFeedback}
            icon={<FeedbackIcon />}
            color={
              stats.counts.unresolvedFeedback > 0 ? "warning.main" : undefined
            }
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <HealthStrip
            server={stats.health.server}
            meili={stats.health.meili}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                Content Created (Last 30 Days)
              </Typography>
              <div style={{ height: 320 }}>
                <ContentTrendChart trend={stats.contentTrend} />
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Page>
  );
}
