import React, {useMemo, useRef, useState} from 'react';
import {
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  Typography,
  Button,
} from '@mui/material';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useUserProfileStore} from '@/user/state';
import {reactionQueries} from '@package/api/reaction/reaction.queries';
import type {ReactionDTO} from '@package/api/reaction/reaction.types';
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from '@package/ui/composite/pagination/Pagination.tsx';
import {useNavigate} from '@tanstack/react-router';

type ReactionInfoPageProps = {
  unitId?: string;
  isCurrentUser?: boolean;
};

type TabKey = 'mine' | 'bookmark';

const ITEMS_PER_PAGE = 20;
const EXTERNAL_ITEMS_PER_PAGE = 100;

function ReactionList({reactions}: {reactions: ReactionDTO[]}) {
  if (reactions.length === 0) {
    return <div className="py-10 text-center text-gray-500">暂无记录。</div>;
  }

  return (
    <List>
      {reactions.map(item => (
        <ListItem key={item.id} divider>
          <ListItemText
            primary={
              <span className="text-sm">
                <span className="font-medium mr-2">反应类型：</span>
                <span className="text-blue-600">{item.reaction}</span>
              </span>
            }
            secondary={
              <div className="mt-1 text-xs text-gray-500 space-y-1">
                <div>
                  <span className="font-medium mr-1">目标 ID:</span>
                  <span className="break-all">{item.targetId}</span>
                </div>
                <div>
                  <span className="font-medium mr-1">时间:</span>
                  <span>
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            }
          />
        </ListItem>
      ))}
    </List>
  );
}

export const ReactionInfoPage: React.FC<ReactionInfoPageProps> = ({
  unitId,
  isCurrentUser = false,
}) => {
  const navigate = useNavigate();
  const currentUser = useUserProfileStore(state => state.user);
  const resolvedUnitId = useMemo(
    () => unitId || (isCurrentUser ? currentUser?.unitId : unitId),
    [unitId, isCurrentUser, currentUser?.unitId],
  );

  const [tab, setTab] = useState<TabKey>('mine');
  const [currentPage, setCurrentPage] = useState(1);
  const [externalPage, setExternalPage] = useState(1);
  const paginatorRef = useRef<UniversalPaginatorHandle>(null);
  const queryClient = useQueryClient();

  const mineQuery = useQuery({
    ...reactionQueries.list({
      userId: resolvedUnitId || '',
      start: (externalPage - 1) * EXTERNAL_ITEMS_PER_PAGE,
      limit: EXTERNAL_ITEMS_PER_PAGE,
    }),
    enabled: !!resolvedUnitId,
  });

  const bookmarkQuery = useQuery({
    ...reactionQueries.list({
      userId: resolvedUnitId || '',
      reaction: 'bookmark',
      start: (externalPage - 1) * EXTERNAL_ITEMS_PER_PAGE,
      limit: EXTERNAL_ITEMS_PER_PAGE,
    }),
    enabled: !!resolvedUnitId,
  });

  const isLoading = mineQuery.isLoading || bookmarkQuery.isLoading;
  const error = (mineQuery.error ?? bookmarkQuery.error) as Error | null;

  const mineReactions = mineQuery.data?.reactions ?? [];
  const mineTotal = mineQuery.data?.total ?? 0;

  const bookmarkReactions = bookmarkQuery.data?.reactions ?? [];
  const bookmarkTotal = bookmarkQuery.data?.total ?? 0;

  const activeReactions = tab === 'mine' ? mineReactions : bookmarkReactions;
  const activeTotal = tab === 'mine' ? mineTotal : bookmarkTotal;

  const handleNeedMoreData = (page: number) => {
    setExternalPage(page);
  };

  const handlePreRequestData = async (page: number): Promise<number> => {
    if (!resolvedUnitId) return 0;

    const common = {
      userId: resolvedUnitId,
      start: (page - 1) * EXTERNAL_ITEMS_PER_PAGE,
      limit: EXTERNAL_ITEMS_PER_PAGE,
    } as const;

    if (tab === 'mine') {
      const data = await queryClient.fetchQuery(
        reactionQueries.list({
          ...common,
        }),
      );
      return data.reactions?.length ?? 0;
    }

    const data = await queryClient.fetchQuery(
      reactionQueries.list({
        ...common,
        reaction: 'bookmark',
      }),
    );
    return data.reactions?.length ?? 0;
  };

  if (!resolvedUnitId) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-16 text-center">
        <Typography variant="h6">无法确定用户信息</Typography>
        <Typography variant="body2" color="textSecondary">
          请先登录，或从用户详情页进入本页面。
        </Typography>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-16 text-center">
        <Typography variant="h6">加载互动信息失败</Typography>
        <Typography variant="body2" color="textSecondary">
          {error.message}
        </Typography>
      </div>
    );
  }

  return (
    <div className="w-11/12 mx-auto mt-10 px-4">
      <div className="flex items-center justify-between">
        <div className="mb-4">
          <Typography variant="h5" className="font-bold mb-2">
            互动信息
          </Typography>
          <Typography variant="body2" color="textSecondary">
            查看你对内容的互动记录，以及你的书签（bookmark）记录。
          </Typography>
        </div>
        <Button
          variant="text"
          color="primary"
          onClick={() => navigate({to: '/user/me'})}
        >
          返回
        </Button>
      </div>

      <Card className="shadow-sm rounded-xl">
        <div className="px-4">
          <Tabs
            value={tab}
            onChange={(_, value: TabKey) => {
              setTab(value);
              setCurrentPage(1);
              setExternalPage(1);
              paginatorRef.current?.resetPaginationPageNumber();
            }}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label={`我发出的 (${mineTotal})`} value="mine" />
            <Tab label={`我的书签 (${bookmarkTotal})`} value="bookmark" />
          </Tabs>
        </div>

        <CardContent>
          <UniversalPaginator<ReactionDTO>
            ref={paginatorRef}
            data={activeReactions}
            totalExternalItems={activeTotal}
            itemsPerPage={ITEMS_PER_PAGE}
            externalItemsPerPage={EXTERNAL_ITEMS_PER_PAGE}
            sortType="time"
            sortOrder="desc"
            onSortChange={() => {}}
            requestData={handleNeedMoreData}
            preRequestData={handlePreRequestData}
            isLoading={isLoading && activeReactions.length === 0}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            sortControl={(<div />) as React.ReactElement<any>}
          >
            {(items: ReactionDTO[]) => <ReactionList reactions={items} />}
          </UniversalPaginator>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReactionInfoPage;
