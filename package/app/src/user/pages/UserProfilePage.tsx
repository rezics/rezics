import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Typography,
} from "@mui/material";
import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import FollowButton from "@/engagement/components/FollowButton";
import { useUserProfileStore } from "@/user/states";
import { UserError, UserLoading } from "./UserState";
import { UserUnitsPage } from "./UserUnitsPage";
import { Pencil as EditIcon } from "lucide-react";

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
  unitId = "",
  isCurrentUser = false,
  onEditClick,
}) => {
  const currentUser = useUserProfileStore((state) => state.user);
  const { t } = useTranslation();

  const meQuery = useQuery({
    ...userQueries.me(),
    enabled: isCurrentUser,
  });
  const detailQuery = useQuery({
    ...userQueries.detail(unitId),
    enabled: !isCurrentUser && unitId !== "",
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
    <Box className="w-11/12 mx-auto max-w-4xl mt-16">
      <Card className="shadow-lg rounded-2xl">
        <CardHeader
          avatar={
            <Avatar
              src={user.avatar}
              variant="rounded"
              sx={{ width: 80, height: 80, borderRadius: 2 }}
            >
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
                  sx={{ mt: 1 }}
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
              currentUser?.permission?.role?.includes("ADMIN") ? (
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={onEditClick}
                >
                  {t("common.edit")}
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
                {t("common.email")}
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
      {(isCurrentUser || user.unitId === currentUser?.unitId) && (
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
