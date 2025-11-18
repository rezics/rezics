import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import type {FC} from 'react';
import {useTranslation} from 'react-i18next';
import type {UserDTO} from '@package/contract';
import {useQuery} from '@tanstack/react-query';
import {userQueries} from '@/api/user/user.queries';
import {UserError, UserLoading} from './UserState';
import {useUserStore} from '@/global/userStore';

export interface UserProfilePageProps {
  unitId: string;
  isCurrentUser?: boolean;
  onEditClick?: () => void;
}

/**
 * UserProfilePage - 用户个人资料页面
 * 显示用户的详细信息，包括头像、名字、简介等
 */
export const UserProfilePage: FC<UserProfilePageProps> = ({
  unitId,
  isCurrentUser = false,
  onEditClick,
}) => {
  const currentUser = useUserStore(state => state.user);
  const {t} = useTranslation();

  console.log('isCurrentUser', isCurrentUser);

  const meQuery = useQuery({
    ...userQueries.me(currentUser?.unitId ?? ''),
    enabled: isCurrentUser,
  });
  const detailQuery = useQuery({
    ...userQueries.detail(unitId),
    enabled: !isCurrentUser && !!unitId,
  });

  const isLoading = meQuery.isLoading || detailQuery.isLoading;
  const queryError = (meQuery.error ?? detailQuery.error) as Error | null;
  const user = (isCurrentUser ? meQuery.data : detailQuery.data) as
    | UserDTO
    | undefined;

  if (isLoading) {
    return <UserLoading />;
  }

  if (queryError) {
    return <UserError message={queryError.message} />;
  }

  if (!user) {
    return (
      <Box className="flex items-center justify-center h-64">
        <Typography>User not found</Typography>
      </Box>
    );
  }

  return (
    <Box className="w-11/12 mx-auto mt-10">
      <Card className="shadow-lg rounded-2xl">
        <CardHeader
          avatar={
            <Avatar src={user.avatar} sx={{width: 80, height: 80}}>
              {user.name?.charAt(0).toUpperCase()}
            </Avatar>
          }
          title={
            <Typography variant="h4" className="font-semibold">
              {user.name}
            </Typography>
          }
          subheader={
            <Box>
              {user.joinDate && (
                <Typography variant="body2" color="textSecondary">
                  Joined on {new Date(user.joinDate).toLocaleDateString()}
                </Typography>
              )}
              {user.slug && (
                <Chip
                  label={`@${user.slug}`}
                  size="small"
                  variant="outlined"
                  sx={{mt: 1}}
                />
              )}
            </Box>
          }
          action={
            isCurrentUser ||
            currentUser?.permission?.role?.includes('ADMIN') ? (
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={onEditClick}
              >
                {t('common.edit')}
              </Button>
            ) : null
          }
        />
        <CardContent>
          {user.unitId && (
            <Box className="mb-4">
              <Typography variant="subtitle1" className="font-semibold mb-2">
                Unit ID
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {user.unitId}
              </Typography>
            </Box>
          )}
          {user.email && (
            <Box className="mb-4">
              <Typography variant="subtitle1" className="font-semibold mb-2">
                {t('common.email')}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {user.email}
              </Typography>
            </Box>
          )}
          {user.bio && (
            <Box className="mb-4">
              <Typography variant="subtitle1" className="font-semibold mb-2">
                Bio
              </Typography>
              <Typography variant="body1" className="text-gray-700">
                {user.bio}
              </Typography>
            </Box>
          )}
          {!user.bio && (
            <Typography
              variant="body2"
              color="textSecondary"
              className="italic"
            >
              No bio available
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
