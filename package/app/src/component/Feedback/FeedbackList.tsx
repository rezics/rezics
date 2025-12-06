import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  Chip,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import DoneIcon from '@mui/icons-material/Done';
import {useQuery} from '@tanstack/react-query';
import {
  feedbackListQuery,
  myFeedbackListQuery,
  feedbacksByUserQuery,
} from '@/api/feedback/feedback.queries';
import {useSetFeedbackResolvedMutation} from '@/api/feedback/feedback.mutations';
import type {FeedbackDTO} from '@/api/feedback/feedback.types';

type FeedbackListProps = {
  queryType: 'mine' | 'all' | 'user';
  userId?: string;
};

const typeColor: Record<
  FeedbackDTO['type'],
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | undefined
> = {
  BUG: 'error',
  FEATURE: 'primary',
  REPORT: 'secondary',
  OTHER: 'default',
};

const FeedbackList: React.FC<FeedbackListProps> = ({queryType, userId}) => {
  const listResult = useQuery(feedbackListQuery());
  const myResult = useQuery(myFeedbackListQuery());
  const byUserResult = useQuery(feedbacksByUserQuery(userId ?? '', undefined));

  const resolveMutation = useSetFeedbackResolvedMutation();

  const handleResolve = (id: string) => {
    resolveMutation.mutate({id, resolved: true});
  };

  return (
    <Box className="">
      <List>
        {(queryType === 'mine'
          ? myResult.data
          : queryType === 'user'
          ? byUserResult.data
          : listResult.data
        )?.items?.map((item: FeedbackDTO) => (
          <ListItem key={item.id} className="border-b border-gray-100">
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} className="items-center">
                  <Chip
                    size="small"
                    label={item.type}
                    color={typeColor[item.type]}
                  />
                  <span className="font-medium">反馈 #{item.id}</span>
                  {item.resolved ? (
                    <Chip
                      size="small"
                      color="success"
                      label="已解决"
                      icon={<DoneIcon />}
                    />
                  ) : (
                    <Chip
                      size="small"
                      color="warning"
                      label="待处理"
                      icon={<HourglassEmptyIcon />}
                    />
                  )}
                </Stack>
              }
              secondary={
                <div className="text-gray-600 whitespace-pre-line">
                  {item.content}
                </div>
              }
            />
            {!item.resolved && (
              <Tooltip title="标记为已解决">
                <IconButton onClick={() => handleResolve(item.id)}>
                  <CheckCircleOutlineIcon />
                </IconButton>
              </Tooltip>
            )}
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default FeedbackList;
