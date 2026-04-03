import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Chip,
  Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import {useEffect, type FC} from 'react';
import {useTranslation} from 'react-i18next';
import type {UserDTO} from '@rezics/contract';
import {useQuery} from '@tanstack/react-query';
import {userQueries} from '@rezics/api/user/user.queries';
import {UserError, UserLoading} from './UserState';
import {useUserProfileStore} from '@/user/state';
import FollowButton from '@/engagement/component/FollowButton';
import {UserUnitsPage} from './UserUnitsPage';
import {Link} from '@rezics/ui/primitive/link/Link.tsx';

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
  unitId = '',
  isCurrentUser = false,
  onEditClick,
}) => {
  const currentUser = useUserProfileStore(state => state.user);
  const {setUser} = useUserProfileStore();
  const {t} = useTranslation();

  console.log('isCurrentUser', isCurrentUser);

  const meQuery = useQuery({
    ...userQueries.me(),
    enabled: isCurrentUser,
  });
  const detailQuery = useQuery({
    ...userQueries.detail(unitId),
    enabled: !isCurrentUser && unitId !== '',
  });

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, setUser, detailQuery.data]);

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
    <Box className="w-11/12 mx-auto max-w-4xl mt-10">
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
            <div>
              {!isCurrentUser && user.unitId !== currentUser?.unitId && (
                <FollowButton
                  userId={user.unitId}
                  size="medium"
                  className="!mr-2"
                />
              )}
              {isCurrentUser ||
              currentUser?.permission?.role?.includes('ADMIN') ? (
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={onEditClick}
                >
                  {t('common.edit')}
                </Button>
              ) : null}
            </div>
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
              <Typography variant="body1">{user.bio}</Typography>
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
      {(isCurrentUser || user.unitId == currentUser?.unitId) && (
        <Card className="shadow-lg rounded-2xl mt-4">
          <CardContent>
            <Typography variant="h6" className="font-semibold inline-block">
              导航：
            </Typography>
            <Link to={`/user/me/bookmark`}>
              <Button variant="text" color="primary">
                书签
              </Button>
            </Link>
            <Link to={`/user/me/follow`}>
              <Button variant="text" color="primary">
                关注
              </Button>
            </Link>
            <Link to={`/user/me/reaction`}>
              <Button variant="text" color="primary">
                反应
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
      <UserUnitsPage userId={user.unitId} />
    </Box>
  );
};
