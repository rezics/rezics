import React, {useEffect, useRef, useState} from 'react';
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
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {buildMeiliFeedbackQuery} from '@package/api/meili/meili.queries';
import {useSetFeedbackResolvedMutation} from '@package/api/feedback/feedback.mutations';
import type {
  FeedbackDTO,
  FeedbackType,
} from '@package/api/feedback/feedback.types';
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from '@package/ui/composite/pagination/Pagination.tsx';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@package/ui/shadcn/popover.tsx';
import {useAlertStore} from '@app/state/windowAlertStore';
import {Link} from '@package/ui/primitive/link/Link.tsx';

export type FeedbackResolvedFilter = boolean | undefined;

export type FeedbackListProps = {
  queryType: 'mine' | 'all' | 'user';
  userId?: string;
  /** Full-text search keyword. */
  search?: string;
  /** Filter by feedback type. */
  typeFilter?: FeedbackType;
  /** Filter by resolved status; `undefined` means all. */
  resolved?: FeedbackResolvedFilter;
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

const EXTERNAL_PAGE_SIZE = 50;

const FeedbackList: React.FC<FeedbackListProps> = ({
  queryType,
  userId,
  search,
  typeFilter,
  resolved,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [startAll, setStartAll] = useState<number>(0);
  const [startMine, setStartMine] = useState<number>(0);
  const [startUser, setStartUser] = useState<number>(0);
  const {show: showAlert} = useAlertStore();
  const queryClient = useQueryClient();
  const paginatorRef = useRef<UniversalPaginatorHandle | null>(null);

  const listResult = useQuery(
    buildMeiliFeedbackQuery(startAll, EXTERNAL_PAGE_SIZE, search ?? '', {
      type: typeFilter,
      resolved,
    }),
  );

  const myResult = useQuery(
    buildMeiliFeedbackQuery(startMine, EXTERNAL_PAGE_SIZE, search ?? '', {
      type: typeFilter,
      resolved,
    }),
  );

  const byUserResult = useQuery(
    buildMeiliFeedbackQuery(startUser, EXTERNAL_PAGE_SIZE, search ?? '', {
      userId: userId ?? undefined,
      type: typeFilter,
      resolved,
    }),
  );

  const resolveMutation = useSetFeedbackResolvedMutation();

  const handleResolve = (id: string) => {
    resolveMutation.mutate({id, resolved: true});
    showAlert('反馈已解决');
  };

  const activeResult =
    queryType === 'mine'
      ? myResult
      : queryType === 'user'
        ? byUserResult
        : listResult;

  const currentData = activeResult.data;
  const isLoading = activeResult.isLoading;
  const isError = activeResult.isError;

  useEffect(() => {
    setCurrentPage(1);
    if (queryType === 'all') {
      setStartAll(0);
    } else if (queryType === 'mine') {
      setStartMine(0);
    } else if (queryType === 'user') {
      setStartUser(0);
    }

    paginatorRef.current?.resetPaginationPageNumber?.();
  }, [queryType, userId, search, typeFilter, resolved]);

  const handleNeedMoreData = (externalPage: number) => {
    const offset = (externalPage - 1) * EXTERNAL_PAGE_SIZE;
    if (queryType === 'mine') {
      setStartMine(offset);
    } else if (queryType === 'user') {
      setStartUser(offset);
    } else {
      setStartAll(offset);
    }
  };

  const handlePreRequestData = async (externalPage: number) => {
    const offset = (externalPage - 1) * EXTERNAL_PAGE_SIZE;
    const limit = EXTERNAL_PAGE_SIZE;

    if (queryType === 'mine') {
      const {queryKey, queryFn} = buildMeiliFeedbackQuery(
        offset,
        limit,
        search ?? '',
        {
          type: typeFilter,
          resolved,
        },
      );
      const next = await queryClient.fetchQuery({queryKey, queryFn});
      return next?.items?.length ?? 0;
    }

    if (queryType === 'user') {
      if (!userId) return 0;
      const {queryKey, queryFn} = buildMeiliFeedbackQuery(
        offset,
        limit,
        search ?? '',
        {
          userId,
          type: typeFilter,
          resolved,
        },
      );
      const next = await queryClient.fetchQuery({queryKey, queryFn});
      return next?.items?.length ?? 0;
    }

    const {queryKey, queryFn} = buildMeiliFeedbackQuery(
      offset,
      limit,
      search ?? '',
      {
        type: typeFilter,
        resolved,
      },
    );
    const next = await queryClient.fetchQuery({queryKey, queryFn});
    return next?.items?.length ?? 0;
  };

  return (
    <Box className="">
      {isError && (
        <Typography variant="body2" color="error" className="px-2 py-1">
          加载反馈失败，请稍后重试。
        </Typography>
      )}

      <UniversalPaginator<FeedbackDTO>
        ref={paginatorRef}
        data={currentData?.items ?? []}
        totalExternalItems={currentData?.totalItems ?? 0}
        itemsPerPage={10}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
        sortType={undefined as any}
        sortOrder={undefined as any}
        onSortChange={() => {}}
        requestData={handleNeedMoreData}
        preRequestData={handlePreRequestData}
        isLoading={isLoading && (currentData?.items?.length ?? 0) === 0}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        disableSortControl={true}
      >
        {(currentPageItems: FeedbackDTO[]) => (
          <List>
            {currentPageItems.map((item: FeedbackDTO) => (
              <ListItem key={item.id} disableGutters className="mb-3">
                <Paper
                  variant="outlined"
                  className="w-full px-3 py-2"
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
                            <div className="text-base font-medium">
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
                    <Typography variant="caption">
                      用户ID：{item.userId}
                    </Typography>
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

                  <div>
                    {(() => {
                      const url = item.url ?? '';
                      if (!url) return null;
                      const isInternal = url.startsWith('/');
                      return isInternal ? (
                        <Link to={url}>{url}</Link>
                      ) : (
                        <a href={url} target="_blank" rel="noreferrer">
                          {url}
                        </a>
                      );
                    })()}
                  </div>
                  <Typography variant="body2">{item.content}</Typography>
                </Paper>
              </ListItem>
            ))}
          </List>
        )}
      </UniversalPaginator>
    </Box>
  );
};

export default FeedbackList;
