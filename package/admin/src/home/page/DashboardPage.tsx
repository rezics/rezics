import {Card, CardContent, Grid, Typography} from '@mui/material';
import React from 'react';

import {Page} from '@/core/layout/Page';
import {DashboardLineChart} from '@/component/charts/DashboardLineChart';

export default function DashboardPage() {
  return (
    <Page
      title="Dashboard"
      description="Admin 后台基础示例页（可按需扩展统计卡片/表格/权限等）"
    >
      <Grid container spacing={2}>
        <Grid size={{xs: 12, md: 4}}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Total Users
              </Typography>
              <Typography variant="h4" fontWeight={800}>
                128
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{xs: 12, md: 4}}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Total Books
              </Typography>
              <Typography variant="h4" fontWeight={800}>
                2,431
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{xs: 12, md: 4}}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Health
              </Typography>
              <Typography variant="h4" fontWeight={800}>
                OK
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs: 12}}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={800} sx={{mb: 1}}>
                Visits (Last 7 days)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                示例图表：react-chartjs-2（后续可接入真实统计接口）
              </Typography>
              <div style={{height: 320}}>
                <DashboardLineChart />
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Page>
  );
}
