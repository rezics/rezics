import {Card, CardContent, Grid, Typography} from '@mui/material';
import {useSuspenseQuery} from '@tanstack/react-query';
import PeopleIcon from '@mui/icons-material/People';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CommentIcon from '@mui/icons-material/Comment';
import FeedbackIcon from '@mui/icons-material/Feedback';

import {Page} from '@/core/layout/Page';
import {adminStatsQueryOptions} from '@rezics/api/stats/stats.queries';
import {StatCard} from '../component/StatCard';
import {HealthStrip} from '../component/HealthStrip';
import {ContentTrendChart} from '../component/charts/ContentTrendChart';

export default function DashboardPage() {
  const {data: stats} = useSuspenseQuery(adminStatsQueryOptions());

  return (
    <Page title="Dashboard" description="Platform overview and system health">
      <Grid container spacing={2}>
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <StatCard
            label="Total Users"
            value={stats.counts.users}
            icon={<PeopleIcon />}
          />
        </Grid>
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <StatCard
            label="Total Books"
            value={stats.counts.books}
            icon={<MenuBookIcon />}
          />
        </Grid>
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <StatCard
            label="Comments"
            value={stats.counts.comments}
            icon={<CommentIcon />}
          />
        </Grid>
        <Grid size={{xs: 12, sm: 6, md: 3}}>
          <StatCard
            label="Unresolved Feedback"
            value={stats.counts.unresolvedFeedback}
            icon={<FeedbackIcon />}
            color={stats.counts.unresolvedFeedback > 0 ? 'warning.main' : undefined}
          />
        </Grid>

        <Grid size={{xs: 12}}>
          <HealthStrip
            server={stats.health.server}
            meili={stats.health.meili}
          />
        </Grid>

        <Grid size={{xs: 12}}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={800} sx={{mb: 1}}>
                Content Created (Last 30 Days)
              </Typography>
              <div style={{height: 320}}>
                <ContentTrendChart trend={stats.contentTrend} />
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Page>
  );
}
