import {Card, CardContent, Typography} from '@mui/material';
import React from 'react';

import {Page} from '@/page/Page';

export default function BooksPage() {
  return (
    <Page title="Books" description="示例：管理书籍（列表/编辑/导入等）">
      <Card>
        <CardContent>
          <Typography variant="body1" fontWeight={700}>
            TODO: Books table
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
            这里后续可以接入接口 + react-query，添加筛选、分页、编辑抽屉等。
          </Typography>
        </CardContent>
      </Card>
    </Page>
  );
}

