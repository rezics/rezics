import {Card, CardContent, FormControlLabel, Switch, Typography} from '@mui/material';
import React from 'react';

import {Page} from '@/page/Page';

export default function SettingsPage() {
  const [dark, setDark] = React.useState(false);

  return (
    <Page title="Settings" description="示例：后台设置（主题/语言/偏好）">
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{mb: 1}}>
            Appearance
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={dark}
                onChange={(e) => setDark(e.target.checked)}
              />
            }
            label="Dark mode（示例：后续可接入持久化 + ThemeProvider）"
          />
        </CardContent>
      </Card>
    </Page>
  );
}

