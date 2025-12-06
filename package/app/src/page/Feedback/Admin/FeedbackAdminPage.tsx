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

const FeedbackAdminPage: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<'all' | 'mine' | 'user'>('all');
  const [userId, setUserId] = React.useState<string>('');

  // Prefetch general list for smoother UX
  useQuery(feedbackListQuery());

  return (
    <Box className="max-w-6xl mx-auto p-4">
      <Stack direction="row" className="items-center justify-between mb-4">
        <Typography variant="h5">反馈管理</Typography>
        <Button variant="outlined" onClick={() => setOpen(true)}>
          新建反馈
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} className="mb-4">
        <TextField
          label="视图"
          select
          value={type}
          onChange={e => setType(e.target.value as 'all' | 'mine' | 'user')}
          className="w-40"
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
          />
        )}
      </Stack>

      <FeedbackList queryType={type} userId={userId || undefined} />

      <FeedbackDrawer open={open} onClose={() => setOpen(false)} />
    </Box>
  );
};

export default FeedbackAdminPage;
