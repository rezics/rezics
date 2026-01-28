import {
  Avatar,
  Box,
  Card,
  CardContent,
  Pagination,
  TextField,
  Typography,
  InputAdornment,
  Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import type { UserDTO } from '@package/contract';
import { useQuery } from '@tanstack/react-query';
import { userQueries } from '@package/api/user/user.queries';
import { UserError, UserLoading } from './UserState';

export interface UserListPageProps {
  onUserClick?: (unitId: string) => void;
}

/**
 * UserListPage - 用户列表页面
 * 显示所有用户，支持搜索和分页
 */
export const UserListPage: FC<UserListPageProps> = ({ onUserClick }) => {
  const [users, setUsers] = useState<Omit<UserDTO, 'email'>[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const itemsPerPage = 20;

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // Reset to first page on search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryParams = useMemo(() => {
    const query: Record<string, string> = {
      page: page.toString(),
      limit: itemsPerPage.toString(),
    };
    if (debouncedQuery) query.q = debouncedQuery;
    return query;
  }, [page, debouncedQuery]);

  const { data, isLoading, error } = useQuery(userQueries.list(queryParams));

  useEffect(() => {
    if (data) {
      setUsers(data.users);
      setTotal(data.total);
    }
  }, [data]);

  const handlePageChange = (_event: unknown, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUserClick = (unitId: string) => {
    if (onUserClick) {
      onUserClick(unitId);
    } else {
      window.location.href = `/users/${unitId}`;
    }
  };

  const totalPages = Math.ceil(total / itemsPerPage);

  return (
    <Box className="w-11/12 mx-auto mt-10">
      <Typography variant="h3" className="font-bold mb-6">
        Users
      </Typography>

      <Box className="mb-6">
        <TextField
          fullWidth
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          variant="outlined"
        />
      </Box>

      {isLoading && <UserLoading />}

      {error && <UserError message={(error as Error).message} />}

      {!isLoading && !error && users.length === 0 && (
        <Box className="flex items-center justify-center h-64">
          <Typography variant="h6" color="textSecondary">
            No users found
          </Typography>
        </Box>
      )}

      {!isLoading && !error && users.length > 0 && (
        <>
          <Box className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {users.map(user => (
              <Card
                key={user.id}
                className="shadow-md rounded-lg cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => handleUserClick(user.id)}
              >
                <CardContent className="text-center">
                  <Avatar
                    src={user.avatar}
                    sx={{ width: 64, height: 64, margin: '0 auto' }}
                    className="mb-3"
                  >
                    {user.name?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="h6" className="font-semibold mb-2">
                    {user.name}
                  </Typography>
                  {user.slug && (
                    <Chip
                      label={`@${user.slug}`}
                      size="small"
                      variant="outlined"
                      className="mb-2"
                    />
                  )}
                  {user.bio && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      className="line-clamp-2"
                    >
                      {user.bio}
                    </Typography>
                  )}
                  {!user.bio && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      className="italic"
                    >
                      No bio
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>

          {totalPages > 1 && (
            <Box className="flex justify-center mt-8">
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Box>
          )}

          <Box className="mt-4 text-center">
            <Typography variant="body2" color="textSecondary">
              Showing {(page - 1) * itemsPerPage + 1} -{' '}
              {Math.min(page * itemsPerPage, total)} of {total} users
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};
