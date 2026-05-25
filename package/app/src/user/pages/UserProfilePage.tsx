import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Pencil as EditIcon } from "lucide-react";
import type { FC } from "react";
import FollowButton from "@/engagement/components/FollowButton";
import { Link } from "@/shared/ui/link";
import { useUserProfileStore } from "@/user/states";
import { UserError, UserLoading } from "./UserState";
import { UserUnitsPage } from "./UserUnitsPage";
import { useMessage } from "@rezics/i18n/react";
import {
  common_edit,
  common_email,
  engagement_bookmark,
  profile_tab_followers,
  profile_tab_reactions,
  settings_profile_bio,
  user_id_label,
  user_joined_on,
  user_navigation_label,
  user_no_bio_available,
  user_not_found,
} from "@rezics/i18n/messages";
const i18nMessages = {
  common_edit,
  common_email,
  engagement_bookmark,
  profile_tab_followers,
  profile_tab_reactions,
  settings_profile_bio,
  user_id_label,
  user_joined_on,
  user_navigation_label,
  user_no_bio_available,
  user_not_found,
};

export interface UserProfilePageProps {
  userId: string;
  isCurrentUser?: boolean;
  onEditClick?: () => void;
}

/**
 * UserProfilePage - 用户个人资料页面
 * 显示用户的详细信息，包括头像、名字、简介等
 */
export const UserProfilePage: FC<UserProfilePageProps> = ({
  userId = "",
  isCurrentUser = false,
  onEditClick,
}) => {
  const m = useMessage(i18nMessages);
  const currentUser = useUserProfileStore((state) => state.user);
  const meQuery = useQuery({
    ...userQueries.me(),
    enabled: isCurrentUser,
  });
  const detailQuery = useQuery({
    ...userQueries.detail(userId),
    enabled: !isCurrentUser && userId !== "",
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
      <div className="flex items-center justify-center h-64">
        <p>{m.user_not_found()}</p>
      </div>
    );
  }

  return (
    <div className="w-11/12 mx-auto max-w-4xl mt-16">
      <Card className="shadow-lg rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className="w-20 h-20 rounded-lg">
              <AvatarImage
                src={user.avatar ?? undefined}
                alt={user.name ?? ""}
              />
              <AvatarFallback className="rounded-lg">
                {user.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h4 className="text-2xl font-semibold">{user.name}</h4>
              <div>
                {user.joinDate && (
                  <p className="text-sm text-text-secondary">
                    {m.user_joined_on({
                      date: new Date(user.joinDate).toLocaleDateString(),
                    })}
                  </p>
                )}
                {user.slug && (
                  <Badge variant="outline" className="mt-2">
                    @{user.slug}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isCurrentUser && user.unitId !== currentUser?.unitId && (
                <FollowButton
                  userId={user.unitId}
                  size="default"
                  className="!mr-2"
                />
              )}
              {isCurrentUser ||
              currentUser?.permission?.role?.includes("ADMIN") ? (
                <Button onClick={onEditClick}>
                  <EditIcon className="w-4 h-4 mr-2" />
                  {m.common_edit()}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-6">
            {user.unitId && (
              <div className="mb-4">
                <h6 className="text-base font-semibold mb-2">
                  {m.user_id_label()}
                </h6>
                <p className="text-sm text-text-secondary">{user.unitId}</p>
              </div>
            )}
            {user.email && (
              <div className="mb-4">
                <h6 className="text-base font-semibold mb-2">
                  {m.common_email()}
                </h6>
                <p className="text-sm text-text-secondary">{user.email}</p>
              </div>
            )}
            {user.bio && (
              <div className="mb-4">
                <h6 className="text-base font-semibold mb-2">
                  {m.settings_profile_bio()}
                </h6>
                <p className="text-base">{user.bio}</p>
              </div>
            )}
            {!user.bio && (
              <p className="text-sm text-text-secondary italic">
                {m.user_no_bio_available()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      {(isCurrentUser || user.unitId === currentUser?.unitId) && (
        <Card className="shadow-lg rounded-2xl mt-4">
          <CardContent>
            <h6 className="text-lg font-semibold inline-block">
              {m.user_navigation_label()}
            </h6>
            <Link to={`/user/me/bookmark`}>
              <Button variant="ghost" className="text-text-brand">
                {m.engagement_bookmark()}
              </Button>
            </Link>
            <Link to={`/user/me/follow`}>
              <Button variant="ghost" className="text-text-brand">
                {m.profile_tab_followers()}
              </Button>
            </Link>
            <Link to={`/user/me/reaction`}>
              <Button variant="ghost" className="text-text-brand">
                {m.profile_tab_reactions()}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
      <UserUnitsPage userId={user.unitId} />
    </div>
  );
};
