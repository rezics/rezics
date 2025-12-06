import React from 'react';
import {Box, Button, Typography, Stack} from '@mui/material';
import FeedbackDrawer from '@/component/Feedback/FeedbackDrawer';
import FeedbackList from '@/component/Feedback/FeedbackList';

const FeedbackPage: React.FC = () => {
  const [open, setOpen] = React.useState(false);

  return (
    <Box className="max-w-5xl mx-auto p-4">
      <Stack direction="row" className="items-center justify-between mb-4">
        <Typography variant="h5">我的反馈</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          提交反馈
        </Button>
      </Stack>

      <FeedbackList queryType="mine" />

      <FeedbackDrawer open={open} onClose={() => setOpen(false)} />
    </Box>
  );
};

export default FeedbackPage;
