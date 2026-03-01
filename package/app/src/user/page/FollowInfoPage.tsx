import React, {useMemo, useRef, useState} from 'react';
import {
  Avatar,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Tabs,
  Tab,
  Typography,
  Button,
} from '@mui/material';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import type {UserDTO} from '@package/contract';
import {userQueries} from '@package/api/user/user.queries';
import {useUserStore} from '@/user/state';
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from '@package/ui/composite/pagination/Pagination.tsx';
import {useNavigate} from '@tanstack/react-router';

type SimpleUser = Omit<UserDTO, 'email'>;

type FollowInfoPageProps = {
  unitId?: string;
  isCurrentUser?: boolean;
};

const ITEMS_PER_PAGE = 20;
const EXTERNAL_ITEMS_PER_PAGE = 20;

function FollowUserList({users}: {users: SimpleUser[]}) {
  if (users.length === 0) {
    return <div className="py-10 text-center text-gray-500">暂无用户。</div>;
  }

  return (
    <List>
      {users.map(user => (
        <ListItem key={user.unitId} divider>
          <ListItemAvatar>
            <Avatar src={user.avatar ?? undefined}>
              {user.name?.charAt(0).toUpperCase()}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={user.name || user.slug || user.unitId}
            secondary={
              user.slug ? (
                <span className="text-sm text-gray-500">@{user.slug}</span>
              ) : null
            }
          />
        </ListItem>
      ))}
    </List>
  );
}

export const FollowInfoPage: React.FC<FollowInfoPageProps> = ({
  unitId,
  isCurrentUser = false,
}) => {
  const navigate = useNavigate();
  const currentUser = useUserStore(state => state.user);
  const resolvedUnitId = useMemo(
    () => unitId || (isCurrentUser ? currentUser?.unitId : unitId),
    [unitId, isCurrentUser, currentUser?.unitId],
  );

  const [tab, setTab] = useState<'following' | 'followers'>('following');
  const [currentPage, setCurrentPage] = useState(1);
  const [externalPage, setExternalPage] = useState(1);
  const paginatorRef = useRef<UniversalPaginatorHandle>(null);
  const queryClient = useQueryClient();

  const followersQuery = useQuery({
    ...userQueries.followers(resolvedUnitId || '', {
      page: externalPage,
      limit: EXTERNAL_ITEMS_PER_PAGE,
    }),
    enabled: !!resolvedUnitId,
  });

  const followingsQuery = useQuery({
    ...userQueries.followings(resolvedUnitId || '', {
      page: externalPage,
      limit: EXTERNAL_ITEMS_PER_PAGE,
    }),
    enabled: !!resolvedUnitId,
  });

  const isLoading = followersQuery.isLoading || followingsQuery.isLoading;
  const error = (followersQuery.error ?? followingsQuery.error) as Error | null;

  const followers = followersQuery.data?.users ?? [];
  const followersTotal = followersQuery.data?.total ?? 0;

  const followings = followingsQuery.data?.users ?? [];
  const followingsTotal = followingsQuery.data?.total ?? 0;

  const activeUsers = tab === 'following' ? followings : followers;
  const activeTotal = tab === 'following' ? followingsTotal : followersTotal;

  const handleNeedMoreData = (page: number) => {
    setExternalPage(page);
  };

  const handlePreRequestData = async (page: number): Promise<number> => {
    if (!resolvedUnitId) return 0;

    if (tab === 'following') {
      const data = await queryClient.fetchQuery(
        userQueries.followings(resolvedUnitId, {
          page,
          limit: EXTERNAL_ITEMS_PER_PAGE,
        }),
      );
      return data.users?.length ?? 0;
    }

    const data = await queryClient.fetchQuery(
      userQueries.followers(resolvedUnitId, {
        page,
        limit: EXTERNAL_ITEMS_PER_PAGE,
      }),
    );
    return data.users?.length ?? 0;
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
        <Typography variant="h6">加载关注信息失败</Typography>
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
            关注信息
          </Typography>
          <Typography variant="body2" color="textSecondary">
            查看你关注的用户，以及关注你的用户列表。
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
            onChange={(_, value) => {
              setTab(value);
              setCurrentPage(1);
              paginatorRef.current?.resetPaginationPageNumber();
            }}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label={`我关注的 (${followingsTotal})`} value="following" />
            <Tab label={`关注我的 (${followersTotal})`} value="followers" />
          </Tabs>
        </div>

        <CardContent>
          <UniversalPaginator<SimpleUser>
            ref={paginatorRef}
            data={activeUsers}
            totalExternalItems={activeTotal}
            itemsPerPage={ITEMS_PER_PAGE}
            externalItemsPerPage={EXTERNAL_ITEMS_PER_PAGE}
            sortType="time"
            sortOrder="desc"
            onSortChange={() => {}}
            requestData={handleNeedMoreData}
            preRequestData={handlePreRequestData}
            isLoading={isLoading && activeUsers.length === 0}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            sortControl={(<div />) as React.ReactElement<any>}
          >
            {(items: SimpleUser[]) => <FollowUserList users={items} />}
          </UniversalPaginator>
        </CardContent>
      </Card>
    </div>
  );
};

export default FollowInfoPage;
