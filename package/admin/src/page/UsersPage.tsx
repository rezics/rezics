import {Card, CardContent, Typography} from '@mui/material';
import React from 'react';

import {Page} from '@/page/Page';

export default function UsersPage() {
  return (
    <Page title="Users" description="示例：管理用户（封禁/权限/资料）">
      <Card>
        <CardContent>
          <Typography variant="body1" fontWeight={700}>
            TODO: Users table
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
            这里后续可以加入 role-based access、批量操作、搜索等。
          </Typography>
        </CardContent>
      </Card>
    </Page>
  );
}

