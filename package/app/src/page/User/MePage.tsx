import {Box, Typography} from '@mui/material';
import {useMemo, useEffect} from 'react';
import type {FC} from 'react';
import {UserPage} from './UserPage';
import {isAuthenticated} from '@/api/react-query/http';
import {useQuery} from '@tanstack/react-query';
import {userQueries} from '@/api/user/user.queries';
import {UserError, UserLoading} from './UserState';

/**
 * MePage - 当前用户的个人资料页面
 * 自动获取当前登录用户的信息并显示
 */
export const MePage: FC = () => {
  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = '/login';
    }
  }, []);

  const {data, isLoading, error} = useQuery(userQueries.me());

  const unitId = useMemo(() => data?.id ?? null, [data]);

  if (isLoading) {
    return <UserLoading />;
  }

  if (error) {
    return <UserError message={(error as Error).message} />;
  }

  if (!unitId) {
    return (
      <Box className="flex items-center justify-center h-64">
        <Typography>User not found</Typography>
      </Box>
    );
  }

  return <UserPage unitId={unitId} isCurrentUser={true} />;
};

export default MePage;
