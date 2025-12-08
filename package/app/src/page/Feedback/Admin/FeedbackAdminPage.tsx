import React from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  MenuItem,
} from '@mui/material';
import FeedbackList from '@/component/Feedback/FeedbackList';
import FeedbackDrawer from '@/component/Feedback/FeedbackDrawer';
import {useQuery} from '@tanstack/react-query';
import {feedbackListQuery} from '@/api/feedback/feedback.queries';

export const FeedbackAdminPage: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<'all' | 'mine' | 'user'>('all');
  const [userId, setUserId] = React.useState<string>('');
  const [search, setSearch] = React.useState<string>('');

  // Prefetch general list for smoother UX
  useQuery(feedbackListQuery());

  return (
    <Box className="max-w-6xl mx-auto p-4">
      <Stack
        direction={{xs: 'column', sm: 'row'}}
        className="items-center justify-between mb-6 gap-4"
      >
        <Typography variant="h5" className="font-bold">
          反馈管理
        </Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          新建反馈
        </Button>
      </Stack>

      <Box className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6">
        <Stack direction={{xs: 'column', md: 'row'}} spacing={2}>
          <TextField
            label="搜索内容"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1"
            size="small"
            placeholder="搜索反馈内容..."
          />

          <Stack direction="row" spacing={2} className="min-w-[300px]">
            <TextField
              label="视图"
              select
              value={type}
              onChange={e => setType(e.target.value as 'all' | 'mine' | 'user')}
              className="w-32"
              size="small"
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="mine">我的</MenuItem>
              <MenuItem value="user">按用户</MenuItem>
            </TextField>

            {type === 'user' && (
              <TextField
                label="用户ID"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="输入用户ID"
                className="flex-1"
                size="small"
              />
            )}
          </Stack>
        </Stack>
      </Box>

      <FeedbackList
        queryType={type}
        userId={userId || undefined}
        search={search}
      />

      <FeedbackDrawer open={open} onClose={() => setOpen(false)} />
    </Box>
  );
};
