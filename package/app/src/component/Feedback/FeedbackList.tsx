import React from 'react';
import {
  Box,
  List,
  ListItem,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Paper,
  Typography,
  Divider,
  Button,
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

import {Popover, PopoverContent, PopoverTrigger} from '@/component/ui/popover';

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
    console.log('resolve', id);
    // resolveMutation.mutate({id, resolved: true});
  };

  const currentData =
    queryType === 'mine'
      ? myResult.data
      : queryType === 'user'
      ? byUserResult.data
      : listResult.data;

  const isLoading =
    listResult.isLoading || myResult.isLoading || byUserResult.isLoading;

  const isError =
    listResult.isError || myResult.isError || byUserResult.isError;

  return (
    <Box className="">
      {isLoading && (
        <Typography
          variant="body2"
          color="text.secondary"
          className="px-2 py-1"
        >
          正在加载反馈...
        </Typography>
      )}

      {isError && (
        <Typography variant="body2" color="error" className="px-2 py-1">
          加载反馈失败，请稍后重试。
        </Typography>
      )}

      <List>
        {currentData?.items?.map((item: FeedbackDTO) => (
          <ListItem key={item.id} disableGutters className="mb-3">
            <Paper
              variant="outlined"
              className="w-full px-3 py-2 border-gray-200"
              elevation={0}
            >
              <Stack
                direction="row"
                spacing={1}
                className="items-center justify-between mb-1"
              >
                <Stack direction="row" spacing={1} className="items-center">
                  <Chip
                    size="small"
                    label={item.type}
                    color={typeColor[item.type]}
                  />
                  <Typography variant="subtitle2" className="font-medium">
                    反馈 #{item.id}
                  </Typography>
                  {item.unitId && (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`单元 ${item.unitId}`}
                    />
                  )}
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

                {!item.resolved && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Tooltip title="标记为已解决">
                        <IconButton
                          size="small"
                          disabled={resolveMutation.isPending}
                        >
                          <CheckCircleOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </PopoverTrigger>
                    <PopoverContent>
                      <div className="flex flex-col gap-4 p-4">
                        <div className="text-base font-medium text-gray-800">
                          确定将此项目标记为已解决？
                        </div>

                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => handleResolve(item.id)}
                        >
                          确定
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </Stack>

              <Stack
                direction="row"
                spacing={2}
                className="text-xs text-gray-500 mb-1 flex-wrap"
              >
                <Typography variant="caption">用户ID：{item.userId}</Typography>
                <Typography variant="caption">
                  创建时间：{new Date(item.createdAt).toLocaleString()}
                </Typography>
                <Typography variant="caption">
                  更新时间：{new Date(item.updatedAt).toLocaleString()}
                </Typography>
                {item.resolvedAt && (
                  <Typography variant="caption">
                    解决时间：{new Date(item.resolvedAt).toLocaleString()}
                  </Typography>
                )}
              </Stack>

              <Divider className="my-1" />

              <Typography
                variant="body2"
                className="text-gray-700 whitespace-pre-line"
              >
                {item.content}
              </Typography>
            </Paper>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default FeedbackList;
